from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
import networkx as nx

from scipy.cluster.hierarchy import linkage, fcluster, leaves_list
from sklearn.metrics import silhouette_score


# ============================================================
# 1. PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR
OUT_DIR = BASE_DIR / "output"

OUT_DIR.mkdir(parents=True, exist_ok=True)

XLSX = RAW_DIR / "template_data.xlsx"
BOUNDARY = RAW_DIR / "Adm_Kabupaten.json"

# Fallback nama file Excel
if not XLSX.exists():
    for name in [
        "template_data(2).xlsx",
        "template_data (2).xlsx",
    ]:
        candidate = RAW_DIR / name
        if candidate.exists():
            XLSX = candidate
            break

# Fallback nama file boundary
if not BOUNDARY.exists():
    for name in [
        "Adm_Kabupaten(1).json",
        "Adm_Kabupaten (1).json",
    ]:
        candidate = RAW_DIR / name
        if candidate.exists():
            BOUNDARY = candidate
            break


# ============================================================
# 2. HELPER
# ============================================================

log = []


def log_msg(msg: str):
    print(msg)
    log.append(msg)


def dump_json(filename, obj, pretty=False):
    path = OUT_DIR / filename

    with path.open("w", encoding="utf-8") as f:
        if pretty:
            json.dump(
                obj,
                f,
                ensure_ascii=False,
                indent=2,
            )
        else:
            json.dump(
                obj,
                f,
                ensure_ascii=False,
                separators=(",", ":"),
            )

    return path


def clean_code_series(s):
    """
    Kode numerik -> integer -> string.
    Digunakan agar konsisten untuk JavaScript.
    """
    return (
        pd.to_numeric(s, errors="raise")
        .astype(int)
        .astype(str)
    )


def finite_float(x):
    x = float(x)
    return None if not math.isfinite(x) else x


def normalize_columns(df):
    """
    Memastikan seluruh nama kolom menjadi lowercase.
    """
    df = df.copy()

    df.columns = (
        df.columns
        .astype(str)
        .str.strip()
        .str.lower()
    )

    return df


# ============================================================
# 3. CEK FILE
# ============================================================

if not XLSX.exists():
    raise FileNotFoundError(
        f"Excel tidak ditemukan: {XLSX}"
    )

if not BOUNDARY.exists():
    raise FileNotFoundError(
        f"Boundary tidak ditemukan: {BOUNDARY}"
    )

log_msg(f"RAW Excel    : {XLSX}")
log_msg(f"RAW boundary : {BOUNDARY}")


# ============================================================
# 4. BACA EXCEL
# ============================================================

sheets = pd.read_excel(
    XLSX,
    sheet_name=None,
)

# Normalisasi nama kolom seluruh sheet
for sheet_name in sheets:
    sheets[sheet_name] = normalize_columns(
        sheets[sheet_name]
    )


required = [
    "FLOW_OD",
    "MULTIVARIAT_PROVINSI",
    "GEO_KABKOTA",
    "KOMUTER_JABODETABEK",
]

missing = [
    s for s in required
    if s not in sheets
]

if missing:
    raise KeyError(
        f"Sheet wajib tidak ditemukan: {missing}"
    )


flow = sheets["FLOW_OD"].copy()
multi = sheets["MULTIVARIAT_PROVINSI"].copy()
geo = sheets["GEO_KABKOTA"].copy()
commuter = sheets["KOMUTER_JABODETABEK"].copy()


# ============================================================
# 5. AUDIT AWAL
# ============================================================

audit = {
    "raw_excel": str(XLSX),
    "raw_boundary": str(BOUNDARY),
    "sheets": {},
    "transformations": [],
    "checks": {},
}

for name, df in sheets.items():
    audit["sheets"][name] = {
        "rows": int(len(df)),
        "columns": list(df.columns),
        "missing_cells": int(
            df.isna().sum().sum()
        ),
        "duplicate_rows": int(
            df.duplicated().sum()
        ),
    }


# ============================================================
# 6. REKONSILIASI KODE PROVINSI
# ============================================================

# Data yang sebelumnya menggunakan kode 93
# direkonsiliasi menjadi kode 94.
for df, cols, label in [
    (
        flow,
        ["kode_asal", "kode_tujuan"],
        "FLOW_OD",
    ),
    (
        multi,
        ["kode_provinsi"],
        "MULTIVARIAT_PROVINSI",
    ),
]:

    for col in cols:

        mask = (
            pd.to_numeric(
                df[col],
                errors="coerce",
            )
            == 93
        )

        n = int(mask.sum())

        if n:
            df.loc[mask, col] = 94

            audit["transformations"].append(
                f"{label}.{col}: "
                f"kode 93 -> 94 pada {n} baris"
            )

            log_msg(
                f"T1: {label}.{col} "
                f"93 -> 94 ({n} baris)"
            )


# ============================================================
# 7. REKONSILIASI KODE KAB/KOTA
# ============================================================

code_fix = {
    "Sorong Selatan": 9106,
    "Sorong": 9107,
    "Tambrauw": 9109,
    "Maybrat": 9110,
    "Manokwari Selatan": 9111,
    "Pegunungan Arfak": 9112,
    "Luwu Timur": 7325,
}

geo["kode_provinsi"] = (
    pd.to_numeric(
        geo["kode_provinsi"],
        errors="raise",
    )
    .astype(int)
)

geo["kode_bps"] = (
    pd.to_numeric(
        geo["kode_bps"],
        errors="raise",
    )
    .astype(int)
)

for name, new_code in code_fix.items():

    idx = geo.index[
        geo["nama_kabkota"]
        .astype(str)
        .str.strip()
        == name
    ]

    if len(idx) != 1:
        raise ValueError(
            f"Rekonsiliasi {name}: "
            f"ditemukan {len(idx)} baris, "
            f"seharusnya tepat 1."
        )

    old_code = int(
        geo.loc[idx[0], "kode_bps"]
    )

    if old_code != new_code:

        geo.loc[idx, "kode_bps"] = new_code

        audit["transformations"].append(
            f"GEO_KABKOTA: "
            f"{name} {old_code} -> {new_code}"
        )

        log_msg(
            f"T2: {name} "
            f"{old_code} -> {new_code}"
        )


# ============================================================
# 8. BACA BOUNDARY JSONL
# ============================================================

features = []
bad_lines = []

with BOUNDARY.open(
    "r",
    encoding="utf-8",
) as f:

    for line_no, line in enumerate(
        f,
        start=1,
    ):

        if not line.strip():
            continue

        try:
            features.append(
                json.loads(line)
            )

        except json.JSONDecodeError as e:
            bad_lines.append(
                {
                    "line": line_no,
                    "error": str(e),
                }
            )


if bad_lines:
    raise ValueError(
        f"Boundary memiliki "
        f"{len(bad_lines)} baris JSON invalid. "
        f"Contoh: {bad_lines[:2]}"
    )


boundary_codes = {
    int(
        ft["properties"]["idkab"]
    )
    for ft in features
    if ft.get("properties", {}).get("idkab")
    is not None
}

geo_codes = set(
    geo["kode_bps"].astype(int)
)


if len(features) != 514:
    raise ValueError(
        "Boundary seharusnya 514 fitur "
        f"sesuai data UAS, tetapi ditemukan "
        f"{len(features)}."
    )


if boundary_codes != geo_codes:
    raise ValueError(
        "Kode kab/kota tidak cocok 1:1 "
        "antara GEO_KABKOTA dan boundary. "
        f"Geo-only={sorted(geo_codes - boundary_codes)}, "
        f"Boundary-only="
        f"{sorted(boundary_codes - geo_codes)}"
    )


if not geo["kode_bps"].is_unique:
    raise ValueError(
        "kode_bps tidak unik."
    )


audit["checks"]["boundary"] = {
    "features": len(features),
    "unique_codes": len(boundary_codes),
    "join_exact": True,
}

log_msg(
    f"JOIN: {len(boundary_codes)} "
    "kode kab/kota cocok 1:1."
)


# ============================================================
# 9. FLOW MIGRASI
# ============================================================

flow["kode_asal"] = clean_code_series(
    flow["kode_asal"]
)

flow["kode_tujuan"] = clean_code_series(
    flow["kode_tujuan"]
)

flow_off = flow[
    flow["kode_asal"]
    != flow["kode_tujuan"]
].copy()

flow_off["jumlah_migran"] = (
    pd.to_numeric(
        flow_off["jumlah_migran"],
        errors="raise",
    )
    .astype(int)
)


if (
    flow_off["jumlah_migran"] < 0
).any():
    raise ValueError(
        "FLOW_OD mengandung "
        "jumlah migran negatif."
    )


# ------------------------------------------------------------
# Node
# ------------------------------------------------------------

flow_nodes_codes = sorted(
    set(flow_off["kode_asal"])
    | set(flow_off["kode_tujuan"]),
    key=int,
)


# PENTING:
# Data yang digunakan memang 34 provinsi.
EXPECTED_PROVINCES = 34

if len(flow_nodes_codes) != EXPECTED_PROVINCES:
    raise ValueError(
        "Jumlah provinsi pada FLOW_OD tidak sesuai. "
        f"Diharapkan {EXPECTED_PROVINCES}, "
        f"ditemukan {len(flow_nodes_codes)}."
    )


node_name = {}

for _, r in flow_off.iterrows():

    node_name[
        str(r["kode_asal"])
    ] = str(r["nama_asal"])

    node_name[
        str(r["kode_tujuan"])
    ] = str(r["nama_tujuan"])


flow_nodes = [
    {
        "id": code,
        "name": node_name[code],
    }
    for code in flow_nodes_codes
]


# ------------------------------------------------------------
# Links
# ------------------------------------------------------------

flow_links = [
    {
        "source": str(r["kode_asal"]),
        "target": str(r["kode_tujuan"]),
        "value": int(r["jumlah_migran"]),
        "year": int(r["tahun_data"]),
        "type": str(r["jenis_migrasi"]),
    }
    for _, r in flow_off.iterrows()
]


# ------------------------------------------------------------
# OD Matrix
# ------------------------------------------------------------

od_matrix = {
    a: {
        b: 0
        for b in flow_nodes_codes
    }
    for a in flow_nodes_codes
}


for _, r in flow_off.iterrows():

    od_matrix[
        str(r["kode_asal"])
    ][
        str(r["kode_tujuan"])
    ] = int(
        r["jumlah_migran"]
    )


# ------------------------------------------------------------
# Threshold
# ------------------------------------------------------------

flow_positive = flow_off[
    flow_off["jumlah_migran"] > 0
].copy()


flow_thresholds = sorted(
    set(
        [0]
        + [
            int(x)
            for x in (
                flow_positive[
                    "jumlah_migran"
                ]
                .quantile(
                    [0.50, 0.75, 0.90, 0.95]
                )
                .tolist()
            )
        ]
    )
)


dump_json(
    "flow.json",
    {
        "year": int(
            flow_off["tahun_data"].iloc[0]
        ),
        "migration_type": str(
            flow_off[
                "jenis_migrasi"
            ].iloc[0]
        ),
        "nodes": flow_nodes,
        "links": flow_links,
        "matrix": od_matrix,
        "thresholds": flow_thresholds,
        "threshold_note": (
            "Frontend dapat memfilter "
            "links berdasarkan value >= "
            "threshold. Diagonal/self-flow "
            "telah dikeluarkan."
        ),
        "source_ids": sorted(
            set(
                flow_off[
                    "id_sumber"
                ]
                .dropna()
                .astype(str)
            )
        ),
    },
)


audit["checks"]["flow"] = {
    "raw_rows": int(len(flow)),
    "diagonal_rows": int(
        len(flow) - len(flow_off)
    ),
    "off_diagonal_rows": int(
        len(flow_off)
    ),
    "positive_edges": int(
        len(flow_positive)
    ),
    "zero_edges": int(
        (
            flow_off[
                "jumlah_migran"
            ]
            == 0
        ).sum()
    ),
    "nodes": int(
        len(flow_nodes)
    ),
    "expected_nodes": EXPECTED_PROVINCES,
    "matrix_size": (
        f"{len(flow_nodes)}x"
        f"{len(flow_nodes)}"
    ),
}


log_msg(
    f"FLOW: {len(flow_nodes)} node, "
    f"{len(flow_off)} off-diagonal records, "
    f"{len(flow_positive)} "
    "positive-flow edges."
)


# ============================================================
# 10. FOKUS DKI JAKARTA
# ============================================================

JAKARTA = "31"

outgoing = (
    flow_off[
        flow_off["kode_asal"]
        == JAKARTA
    ]
    .sort_values(
        "jumlah_migran",
        ascending=False,
    )
)

incoming = (
    flow_off[
        flow_off["kode_tujuan"]
        == JAKARTA
    ]
    .sort_values(
        "jumlah_migran",
        ascending=False,
    )
)


jakarta_json = {
    "focus_code": JAKARTA,
    "focus_name": "DKI Jakarta",
    "year": int(
        flow_off[
            "tahun_data"
        ].iloc[0]
    ),
    "migration_type": str(
        flow_off[
            "jenis_migrasi"
        ].iloc[0]
    ),
    "outgoing": [
        {
            "code": str(
                r["kode_tujuan"]
            ),
            "name": str(
                r["nama_tujuan"]
            ),
            "value": int(
                r["jumlah_migran"]
            ),
        }
        for _, r in outgoing.iterrows()
    ],
    "incoming": [
        {
            "code": str(
                r["kode_asal"]
            ),
            "name": str(
                r["nama_asal"]
            ),
            "value": int(
                r["jumlah_migran"]
            ),
        }
        for _, r in incoming.iterrows()
    ],
    "source_ids": sorted(
        set(
            flow_off[
                "id_sumber"
            ]
            .dropna()
            .astype(str)
        )
    ),
}


dump_json(
    "jakarta.json",
    jakarta_json,
)


audit["checks"]["jakarta"] = {
    "outgoing_rows": len(outgoing),
    "incoming_rows": len(incoming),
    "outgoing_total": int(
        outgoing[
            "jumlah_migran"
        ].sum()
    ),
    "incoming_total": int(
        incoming[
            "jumlah_migran"
        ].sum()
    ),
    "net": int(
        incoming[
            "jumlah_migran"
        ].sum()
        -
        outgoing[
            "jumlah_migran"
        ].sum()
    ),
}


# ============================================================
# 11. MULTIVARIAT
# ============================================================

VARS = [
    "ipm",
    "uhh",
    "hls",
    "rls",
    "pengeluaran_per_kapita",
    "persentase_miskin",
    "tpt",
    "kepadatan_penduduk",
]


multi["kode_provinsi"] = (
    clean_code_series(
        multi["kode_provinsi"]
    )
)


if len(multi) != EXPECTED_PROVINCES:
    raise ValueError(
        "Jumlah observasi multivariat "
        "tidak sesuai. "
        f"Diharapkan {EXPECTED_PROVINCES}, "
        f"ditemukan {len(multi)}."
    )


# ------------------------------------------------------------
# Penduduk provinsi dari kab/kota
# ------------------------------------------------------------

geo_pop = geo.copy()

geo_pop["kode_provinsi"] = (
    geo_pop["kode_provinsi"]
    .astype(int)
    .astype(str)
)


population_by_province = (
    geo_pop
    .groupby("kode_provinsi")
    ["jumlah_penduduk"]
    .sum()
)


multi["penduduk"] = (
    multi["kode_provinsi"]
    .map(
        population_by_province
    )
)


if multi["penduduk"].isna().any():
    raise ValueError(
        "Ada provinsi tanpa data "
        "penduduk turunan kab/kota."
    )


# ------------------------------------------------------------
# Migrasi masuk / keluar
# ------------------------------------------------------------

out_mig = (
    flow_off
    .groupby("kode_asal")
    ["jumlah_migran"]
    .sum()
)

in_mig = (
    flow_off
    .groupby("kode_tujuan")
    ["jumlah_migran"]
    .sum()
)


multi["migran_keluar"] = (
    multi["kode_provinsi"]
    .map(out_mig)
    .fillna(0)
)

multi["migran_masuk"] = (
    multi["kode_provinsi"]
    .map(in_mig)
    .fillna(0)
)

multi["neto"] = (
    multi["migran_masuk"]
    -
    multi["migran_keluar"]
)


multi["laju_keluar_per1000"] = (
    multi["migran_keluar"]
    /
    multi["penduduk"]
    * 1000
)

multi["laju_masuk_per1000"] = (
    multi["migran_masuk"]
    /
    multi["penduduk"]
    * 1000
)

multi["laju_neto_per1000"] = (
    multi["neto"]
    /
    multi["penduduk"]
    * 1000
)


# ------------------------------------------------------------
# PCA
# ------------------------------------------------------------

X = multi[VARS].astype(float).copy()

# Transformasi kepadatan
X["kepadatan_penduduk"] = np.log10(
    X["kepadatan_penduduk"]
    .clip(lower=1e-12)
)


if not np.isfinite(
    X.to_numpy()
).all():
    raise ValueError(
        "Variabel multivariat "
        "mengandung NaN/Inf."
    )


# Standardisasi
Z = (
    X - X.mean()
) / X.std(
    ddof=0
)


if not np.isfinite(
    Z.to_numpy()
).all():
    raise ValueError(
        "Z-score menghasilkan NaN/Inf."
    )


# SVD
U, S, Vt = np.linalg.svd(
    Z.to_numpy(),
    full_matrices=False,
)


eigenvalues = (
    S ** 2
) / len(Z)


explained_ratio = (
    eigenvalues
    /
    eigenvalues.sum()
)


scores = U * S


# Orientasi PC1
if (
    Vt[
        0,
        VARS.index("ipm")
    ] < 0
):

    Vt[0, :] *= -1
    scores[:, 0] *= -1


for i in range(3):

    multi[
        f"pc{i + 1}"
    ] = (
        Z.to_numpy()
        @ Vt[i, :]
    )


# ============================================================
# 12. HIERARCHICAL CLUSTERING
# ============================================================

Z_link = linkage(
    Z.to_numpy(),
    method="ward",
)


leaf_order_idx = leaves_list(
    Z_link
)


candidate_silhouette = {}

for k_cluster in range(
    2,
    min(
        6,
        len(multi) - 1,
    ) + 1,
):

    labels = fcluster(
        Z_link,
        k_cluster,
        criterion="maxclust",
    )

    candidate_silhouette[
        str(k_cluster)
    ] = float(
        silhouette_score(
            Z.to_numpy(),
            labels,
        )
    )


best_k = int(
    max(
        candidate_silhouette,
        key=candidate_silhouette.get,
    )
)


cluster_labels = fcluster(
    Z_link,
    best_k,
    criterion="maxclust",
)


multi["cluster"] = (
    cluster_labels
)

multi["heatmap_order"] = np.arange(
    len(multi)
)


for rank, row_idx in enumerate(
    leaf_order_idx
):

    multi.loc[
        row_idx,
        "heatmap_order"
    ] = rank


# ------------------------------------------------------------
# PCA loadings
# ------------------------------------------------------------

loadings = {
    var: [
        float(
            Vt[j, i]
        )
        for j in range(3)
    ]
    for i, var in enumerate(VARS)
}


# ------------------------------------------------------------
# Multivariate points
# ------------------------------------------------------------

mult_points = []

for _, r in (
    multi
    .sort_values(
        "heatmap_order"
    )
    .iterrows()
):

    mult_points.append(
        {
            "code": str(
                r["kode_provinsi"]
            ),
            "name": str(
                r["nama_provinsi"]
            ),
            "pc1": float(
                r["pc1"]
            ),
            "pc2": float(
                r["pc2"]
            ),
            "cluster": int(
                r["cluster"]
            ),
            "heatmap_order": int(
                r["heatmap_order"]
            ),
            "z": {
                v: float(
                    Z.loc[
                        r.name,
                        v,
                    ]
                )
                for v in VARS
            },
            "raw": {
                v: float(
                    r[v]
                )
                for v in VARS
            },
            "migration": {
                "masuk": int(
                    r["migran_masuk"]
                ),
                "keluar": int(
                    r["migran_keluar"]
                ),
                "neto": int(
                    r["neto"]
                ),
                "rate_masuk_per1000": float(
                    r[
                        "laju_masuk_per1000"
                    ]
                ),
                "rate_keluar_per1000": float(
                    r[
                        "laju_keluar_per1000"
                    ]
                ),
                "rate_neto_per1000": float(
                    r[
                        "laju_neto_per1000"
                    ]
                ),
            },
        }
    )


multivariate_json = {
    "year": (
        int(
            multi[
                "tahun_data"
            ].iloc[0]
        )
        if "tahun_data" in multi
        else 2020
    ),
    "expected_provinces": EXPECTED_PROVINCES,
    "variables": VARS,
    "points": mult_points,
    "pca": {
        "method": (
            "SVD on standardized variables"
        ),
        "transformation": {
            "kepadatan_penduduk": (
                "log10"
            ),
            "standardization": (
                "z-score, "
                "population std ddof=0"
            ),
        },
        "explained_variance_ratio": [
            float(x)
            for x in explained_ratio[:3]
        ],
        "explained_variance_percent": [
            float(x * 100)
            for x in explained_ratio[:3]
        ],
        "loadings_pc1_pc3": loadings,
    },
    "clustering": {
        "method": (
            "Hierarchical Ward"
        ),
        "selected_k": best_k,
        "candidate_silhouette": (
            candidate_silhouette
        ),
        "silhouette_selected": (
            candidate_silhouette[
                str(best_k)
            ]
        ),
        "purpose": (
            "clustered heatmap dan grouping; "
            "label cluster dapat dipakai "
            "untuk highlight/linking"
        ),
    },
    "interaction_contract": {
        "brush_key": "code",
        "linked_views": [
            "pca_scatter",
            "parallel_coordinates",
            "clustered_heatmap",
        ],
    },
    "source_ids": sorted(
        set(
            multi[
                "id_sumber"
            ]
            .dropna()
            .astype(str)
        )
    ),
}


dump_json(
    "multivariate.json",
    multivariate_json,
)


dump_json(
    "pca.json",
    {
        "variables": VARS,
        "explained_variance_ratio": [
            float(x)
            for x in explained_ratio
        ],
        "loadings": loadings,
        "cluster_method": (
            "Hierarchical Ward"
        ),
        "selected_k": best_k,
        "candidate_silhouette": (
            candidate_silhouette
        ),
        "heatmap_order": [
            str(
                multi.iloc[i][
                    "kode_provinsi"
                ]
            )
            for i in leaf_order_idx
        ],
    },
)


audit["checks"]["multivariate"] = {
    "observations": len(multi),
    "expected_observations": EXPECTED_PROVINCES,
    "numeric_variables": len(VARS),
    "pc1_explained": float(
        explained_ratio[0]
    ),
    "pc2_explained": float(
        explained_ratio[1]
    ),
    "cluster_method": (
        "Hierarchical Ward"
    ),
    "selected_k": best_k,
    "selected_silhouette": (
        candidate_silhouette[
            str(best_k)
        ]
    ),
}


# ============================================================
# 13. GEOSPATIAL
# ============================================================

geo_records = []

for _, r in (
    geo
    .sort_values("kode_bps")
    .iterrows()
):

    geo_records.append(
        {
            "code": int(
                r["kode_bps"]
            ),
            "name": str(
                r["nama_kabkota"]
            ),
            "province_code": str(
                int(
                    r["kode_provinsi"]
                )
            ),
            "province_name": str(
                r["nama_provinsi"]
            ),
            "poverty": float(
                r["persentase_miskin"]
            ),
            "ipm": float(
                r["ipm"]
            ),
            "pdrb_per_capita": float(
                r["pdrb_per_kapita"]
            ),
            "tpt": float(
                r["tpt"]
            ),
            "population": int(
                r["jumlah_penduduk"]
            ),
            "source_ids": str(
                r["id_sumber"]
            ).split(";"),
        }
    )


if len(geo_records) != 514:
    raise ValueError(
        "Data kab/kota harus 514 unit, "
        f"ditemukan {len(geo_records)}."
    )


dump_json(
    "geo_data.json",
    {
        "year": 2020,
        "features_data": geo_records,
        "map_contract": {
            "choropleth": {
                "variable": "poverty",
                "unit": "percent",
                "classification": (
                    "Jenks/quantile dapat "
                    "dipilih di frontend"
                ),
                "note": (
                    "Kemiskinan adalah "
                    "rasio/persentase, "
                    "bukan angka absolut."
                ),
            },
            "proportional_symbols": {
                "variable": "population",
                "encoding": "area/radius",
            },
            "tooltip": [
                "name",
                "province_name",
                "poverty",
                "population",
                "ipm",
                "pdrb_per_capita",
                "tpt",
            ],
            "controls": [
                "zoom",
                "pan",
                "layer",
            ],
        },
        "source_ids": sorted(
            {
                sid.strip()
                for r in geo_records
                for sid in r[
                    "source_ids"
                ]
                if sid.strip()
            }
        ),
    },
)


# Boundary -> FeatureCollection
fc = {
    "type": "FeatureCollection",
    "features": features,
}


dump_json(
    "kabkota_boundary.geojson",
    fc,
)


audit["checks"]["geospatial"] = {
    "kabkota": len(geo_records),
    "boundary_features": len(features),
    "join_exact": True,
}


# ============================================================
# 14. KOMUTER JABODETABEK
# ============================================================

commuter["kode_asal"] = clean_code_series(
    commuter["kode_asal"]
)

commuter["kode_tujuan"] = clean_code_series(
    commuter["kode_tujuan"]
)


commuter["jumlah_komuter"] = (
    pd.to_numeric(
        commuter["jumlah_komuter"],
        errors="raise",
    )
    .astype(int)
)


commuter_links = [
    {
        "source": str(
            r["kode_asal"]
        ),
        "source_name": str(
            r["nama_asal"]
        ),
        "target": str(
            r["kode_tujuan"]
        ),
        "target_name": str(
            r["nama_tujuan"]
        ),
        "value": int(
            r["jumlah_komuter"]
        ),
    }
    for _, r in commuter.iterrows()
]


commuter_nodes = {}

for _, r in commuter.iterrows():

    commuter_nodes[
        str(r["kode_asal"])
    ] = str(r["nama_asal"])

    commuter_nodes[
        str(r["kode_tujuan"])
    ] = str(r["nama_tujuan"])


dump_json(
    "commuter.json",
    {
        "year": 2019,
        "dataset_type": "commuter",
        "unit_note": (
            "Komuter Jabodetabek 2019; "
            "bukan migrasi antarprovinsi 2020."
        ),
        "nodes": [
            {
                "code": code,
                "name": name,
            }
            for code, name in sorted(
                commuter_nodes.items(),
                key=lambda x: int(x[0]),
            )
        ],
        "links": commuter_links,
        "source_ids": sorted(
            set(
                commuter[
                    "id_sumber"
                ]
                .dropna()
                .astype(str)
            )
        ),
    },
)


audit["checks"]["commuter"] = {
    "year": 2019,
    "rows": len(commuter),
    "nodes": len(commuter_nodes),
    "explicitly_separate_from_migration_2020": True,
}


# ============================================================
# 15. NETWORK
# ============================================================

network_edges_df = flow_off[
    flow_off["jumlah_migran"] > 0
].copy()


G = nx.DiGraph()


for code in flow_nodes_codes:

    G.add_node(
        code,
        name=node_name[code],
    )


for _, r in (
    network_edges_df.iterrows()
):

    G.add_edge(
        str(r["kode_asal"]),
        str(r["kode_tujuan"]),
        weight=float(
            r["jumlah_migran"]
        ),
    )


# Validasi network
if len(G.nodes) != EXPECTED_PROVINCES:
    raise ValueError(
        "Jumlah node network tidak sesuai. "
        f"Diharapkan {EXPECTED_PROVINCES}, "
        f"ditemukan {len(G.nodes)}."
    )


# ------------------------------------------------------------
# Weighted strength
# ------------------------------------------------------------

weighted_strength = {}

for n in G.nodes:

    outgoing_strength = sum(
        d.get("weight", 0)
        for _, _, d
        in G.out_edges(
            n,
            data=True,
        )
    )

    incoming_strength = sum(
        d.get("weight", 0)
        for _, _, d
        in G.in_edges(
            n,
            data=True,
        )
    )

    weighted_strength[n] = (
        outgoing_strength
        +
        incoming_strength
    )


# ------------------------------------------------------------
# Distance untuk betweenness
# ------------------------------------------------------------

for a, b, d in G.edges(
    data=True
):

    d["distance"] = (
        1.0
        /
        max(
            float(
                d["weight"]
            ),
            1e-12,
        )
    )


betweenness = (
    nx.betweenness_centrality(
        G,
        weight="distance",
        normalized=True,
    )
)


# ------------------------------------------------------------
# Network nodes
# ------------------------------------------------------------

network_nodes = []

for n in G.nodes:

    network_nodes.append(
        {
            "id": str(n),
            "name": node_name[n],

            "strength_keluar": int(
                sum(
                    d.get("weight", 0)
                    for _, _, d
                    in G.out_edges(
                        n,
                        data=True,
                    )
                )
            ),

            "strength_masuk": int(
                sum(
                    d.get("weight", 0)
                    for _, _, d
                    in G.in_edges(
                        n,
                        data=True,
                    )
                )
            ),

            "weighted_strength": int(
                weighted_strength[n]
            ),

            "degree_total": int(
                G.in_degree(n)
                +
                G.out_degree(n)
            ),

            "betweenness": float(
                betweenness[n]
            ),
        }
    )


# ------------------------------------------------------------
# Network links
# ------------------------------------------------------------

network_links = [
    {
        "source": str(a),
        "target": str(b),
        "value": int(
            d["weight"]
        ),
    }
    for a, b, d
    in G.edges(data=True)
]


# ------------------------------------------------------------
# Network thresholds
# ------------------------------------------------------------

network_values = [
    e["value"]
    for e in network_links
]


network_thresholds = sorted(
    set(
        [0]
        + [
            int(x)
            for x in (
                pd.Series(
                    network_values
                )
                .quantile(
                    [
                        0.50,
                        0.75,
                        0.90,
                        0.95,
                    ]
                )
                .tolist()
            )
        ]
    )
)


dump_json(
    "network.json",
    {
        "year": 2020,
        "directed": True,

        # PENTING:
        # Network menggunakan 34 node.
        "expected_nodes": EXPECTED_PROVINCES,

        "nodes": network_nodes,
        "links": network_links,

        "metrics": [
            "weighted_strength",
            "betweenness",
        ],

        "edge_filter": {
            "variable": "value",
            "operator": ">=",
            "thresholds": network_thresholds,
            "note": (
                "Frontend dapat menyaring "
                "edge berdasarkan threshold; "
                "node dapat dibuat draggable "
                "dengan D3 force simulation."
            ),
        },

        "interaction_contract": {
            "force_directed": True,
            "draggable_nodes": True,
            "highlight_neighbors": True,
            "edge_threshold_filter": True,
        },

        "betweenness_definition": (
            "Directed graph; "
            "distance = 1 / migration weight; "
            "normalized=True."
        ),

        "source_ids": sorted(
            set(
                flow_off[
                    "id_sumber"
                ]
                .dropna()
                .astype(str)
            )
        ),
    },
)


audit["checks"]["network"] = {
    "nodes": len(G.nodes),
    "expected_nodes": EXPECTED_PROVINCES,
    "positive_edges": len(G.edges),
    "zero_edges_excluded": int(
        (
            flow_off[
                "jumlah_migran"
            ]
            == 0
        ).sum()
    ),
    "metrics": [
        "weighted_strength",
        "betweenness",
    ],
    "betweenness_distance": (
        "1 / weight"
    ),
}


# ============================================================
# 16. SOURCES
# ============================================================

source_ids = set()

for df in [
    flow,
    multi,
    geo,
    commuter,
]:

    if "id_sumber" in df.columns:

        source_ids.update(
            df[
                "id_sumber"
            ]
            .dropna()
            .astype(str)
            .str.strip()
            .tolist()
        )


dump_json(
    "sources.json",
    {
        "raw_files": [
            XLSX.name,
            BOUNDARY.name,
        ],
        "source_ids_used": sorted(
            source_ids
        ),
        "note": (
            "Data utama statistik berasal "
            "dari BPS sesuai ketentuan UAS; "
            "boundary merupakan data "
            "pendukung non-BPS."
        ),
    },
    pretty=True,
)


# ============================================================
# 17. CODEBOOK
# ============================================================

codebook = {

    "flow": {
        "source": "FLOW_OD",
        "expected_nodes": EXPECTED_PROVINCES,
        "visuals": [
            "chord diagram",
            "OD matrix",
        ],
        "filter": (
            "threshold on migration volume"
        ),
        "diagonal": (
            "excluded from visualization"
        ),
    },

    "jakarta": {
        "source": "FLOW_OD",
        "visuals": [
            "outgoing bar ranking",
            "incoming bar ranking",
        ],
        "focus_code": "31",
    },

    "multivariate": {
        "source": (
            "MULTIVARIAT_PROVINSI"
        ),
        "observations": EXPECTED_PROVINCES,
        "variables": VARS,
        "pca": (
            "SVD on z-score; "
            "density log10"
        ),
        "other_methods": [
            "parallel coordinates",
            "hierarchical Ward "
            "clustered heatmap",
        ],
        "linking_key": "kode_provinsi",
    },

    "geospatial": {
        "source": (
            "GEO_KABKOTA + "
            "Adm_Kabupaten boundary"
        ),
        "units": 514,
        "choropleth": (
            "poverty percentage"
        ),
        "symbols": "population",
        "interaction": [
            "tooltip",
            "zoom/pan",
            "layer control",
        ],
    },

    "commuter": {
        "source": (
            "KOMUTER_JABODETABEK"
        ),
        "year": 2019,
        "warning": (
            "NOT migration 2020"
        ),
    },

    "network": {
        "source": "FLOW_OD",
        "nodes": EXPECTED_PROVINCES,
        "edge_rule": (
            "positive migration only"
        ),
        "metrics": [
            "weighted_strength",
            "betweenness",
        ],
        "interaction": [
            "edge threshold",
            "neighbor highlight",
            "draggable nodes",
        ],
    },
}


dump_json(
    "codebook.json",
    {
        "variables": codebook
    },
    pretty=True,
)


# ============================================================
# 18. MANIFEST
# ============================================================

manifest = {

    "project": (
        "Jakarta Dilepas, "
        "Bodetabek Dihuni"
    ),

    "data_contract_version": "2.0.0",

    "generated_by": (
        "preprocess_uas_windows.py"
    ),

    "raw_files": [
        XLSX.name,
        BOUNDARY.name,
    ],

    "expected_provinces": EXPECTED_PROVINCES,

    "expected_kabkota": 514,

    "periods": {
        "migration": 2020,
        "multivariate": 2020,
        "geospatial": 2020,
        "commuter": 2019,
    },

    "files": {
        "flow": "flow.json",
        "jakarta": "jakarta.json",
        "multivariate": (
            "multivariate.json"
        ),
        "pca": "pca.json",
        "geo_data": "geo_data.json",
        "geo_boundary": (
            "kabkota_boundary.geojson"
        ),
        "commuter": "commuter.json",
        "network": "network.json",
        "sources": "sources.json",
        "codebook": "codebook.json",
        "audit": "audit_report.json",
        "transform_log": (
            "transform_log.txt"
        ),
    },

    "rules": [
        "Raw data tidak diubah.",

        "FLOW_OD diagonal/self-flow "
        "dikeluarkan dari visualisasi.",

        "OD matrix tetap mempertahankan "
        "seluruh pasangan off-diagonal.",

        "Network hanya menggunakan edge "
        "dengan migration weight > 0.",

        "Network terdiri dari 34 node "
        "sesuai data yang digunakan.",

        "Threshold edge diterapkan "
        "di frontend agar interaktif.",

        "Komuter 2019 dipisahkan eksplisit "
        "dari migrasi 2020.",

        "Boundary JSONL hanya dikonversi "
        "menjadi FeatureCollection; "
        "geometry tidak disederhanakan.",

        "PCA menggunakan 8 variabel numerik.",

        "Kepadatan Penduduk ditransformasi "
        "log10 sebelum z-score.",

        "Clustering/heatmap menggunakan "
        "hierarchical Ward.",

        "Tidak ada causal interpretation "
        "yang disimpan dalam data contract.",
    ],
}


dump_json(
    "manifest.json",
    manifest,
    pretty=True,
)


# ============================================================
# 19. AUDIT SUMMARY
# ============================================================

audit["summary"] = {

    "expected_provinces": EXPECTED_PROVINCES,

    "flow_nodes": len(flow_nodes),

    "flow_off_diagonal": len(flow_off),

    "network_nodes": len(G.nodes),

    "network_positive_edges": (
        len(network_links)
    ),

    "multivariate_observations": (
        len(multi)
    ),

    "multivariate_variables": (
        len(VARS)
    ),

    "kabkota": len(geo_records),

    "boundary_features": len(features),

    "commuter_year": 2019,

    "migration_year": 2020,
}


# ============================================================
# 20. VALIDASI AKHIR
# ============================================================

if (
    audit["summary"]["flow_nodes"]
    != EXPECTED_PROVINCES
):
    raise ValueError(
        "FINAL CHECK gagal: "
        "jumlah flow node bukan 34."
    )


if (
    audit["summary"]["network_nodes"]
    != EXPECTED_PROVINCES
):
    raise ValueError(
        "FINAL CHECK gagal: "
        "jumlah network node bukan 34."
    )


if (
    audit["summary"][
        "multivariate_observations"
    ]
    != EXPECTED_PROVINCES
):
    raise ValueError(
        "FINAL CHECK gagal: "
        "jumlah observasi multivariat "
        "bukan 34."
    )


if (
    audit["summary"]["kabkota"]
    != 514
):
    raise ValueError(
        "FINAL CHECK gagal: "
        "jumlah kab/kota bukan 514."
    )


if (
    audit["summary"]["boundary_features"]
    != 514
):
    raise ValueError(
        "FINAL CHECK gagal: "
        "jumlah boundary bukan 514."
    )


dump_json(
    "audit_report.json",
    audit,
    pretty=True,
)


# ============================================================
# 21. TRANSFORM LOG
# ============================================================

(
    OUT_DIR / "transform_log.txt"
).write_text(
    "\n".join(log),
    encoding="utf-8",
)


# ============================================================
# 22. FINAL OUTPUT
# ============================================================

print()
print("=" * 70)
print("PREPROCESSING SELESAI")
print("=" * 70)

print(f"Output          : {OUT_DIR}")
print(
    f"Flow nodes      : "
    f"{len(flow_nodes)}"
)
print(
    f"Flow records    : "
    f"{len(flow_off)} off-diagonal"
)
print(
    f"Network nodes   : "
    f"{len(G.nodes)}"
)
print(
    f"Network edges   : "
    f"{len(network_links)} positive-weight"
)
print(
    f"Multivariate    : "
    f"{len(multi)} x {len(VARS)}"
)
print(
    f"Kab/kota        : "
    f"{len(geo_records)}"
)
print(
    f"Boundary        : "
    f"{len(features)}"
)
print(
    "Commuter        : 2019"
)
print(
    "Migration       : 2020"
)
print("=" * 70)