# Jakarta Dilepas, Bodetabek Dihuni

**UAS Visualisasi Data**

Raihan Taufiqurrahman Zaki - 222313332 - 3SD1

---

## Deskripsi

## Deskripsi

**Jakarta Dilepas, Bodetabek Dihuni** adalah website data storytelling interaktif
yang menganalisis pola migrasi risen penduduk Indonesia berdasarkan data BPS, dengan fokus pada fenomena perpindahan penduduk keluar DKI Jakarta dan keterkaitannya dengan wilayah penyangga Bodetabek.

Proyek ini menggabungkan visualisasi aliran/pergerakan, data berdimensi tinggi, jaringan, dan geospasial untuk menunjukkan pola asal-tujuan migrasi, karakteristik sosial-ekonomi antarprovinsi, serta hubungan Jakarta dengan wilayah penyangga.

Narasi disajikan dalam format **scrollytelling**, yaitu pembaca menggulir halaman dan visualisasi berubah mengikuti alur cerita.

## Visualisasi yang Digunakan

| No | Visualisasi | Topik | Keterangan |
|---|---|---|---|
| 1 | **Chord Diagram** | Flow/Movement | Aliran migrasi risen antarprovinsi (34×34) |
| 2 | **Horizontal Bar Chart** | Flow/Movement | Top 10 destinasi migran keluar DKI Jakarta |
| 3 | **OD Matrix Heatmap** | Flow/Movement | Matriks asal-tujuan 34 provinsi |
| 4 | **PCA Biplot** | Multivariat | Analisis komponen utama 8 indikator pembangunan |
| 5 | **Parallel Coordinates** | Multivariat | Profil z-score 34 provinsi |
| 6 | **Clustered Heatmap** | Multivariat | Pengelompokan provinsi dengan hierarchical clustering |
| 7 | **Choropleth Map** | Geospasial | Tingkat kemiskinan kab/kota |
| 8 | **Proportional Symbol + Komuter** | Geospasial | Penduduk dan arus komuter Jabodetabek |
| 9 | **Force-Directed Network** | Network | Jaringan migrasi antarprovinsi |

## Teknikal

- **Vite**: build tool & dev server
- **D3.js v7**: seluruh visualisasi SVG (chord, heatmap, PCA, parallel coords, bar chart, network graph)
- **Leaflet**: peta geospasial choropleth + arus komuter
- **Scrollama**: scrollytelling (step trigger)
- **Lenis**: smooth scroll
- **Tailwind CSS v4**: styling utility-first
- **Vanilla JS (ES Modules)**

## Proses Pengumpulan Data

Data yang digunakan dalam proyek ini tidak tersedia dalam format siap pakai. Seluruh data dikumpulkan secara manual dari berbagai sumber mentah (raw data), antara lain:

- **Query Builder BPS**: fitur tabel dinamis di situs [bps.go.id](https://www.bps.go.id) untuk mengunduh data statistik per indikator, provinsi, dan tahun.
- **Dokumen Publikasi BPS**: file PDF/publikasi resmi seperti *Statistik Migrasi Indonesia*, *PDRB Kabupaten/Kota*, dan *Statistik Komuter Jabodetabek*.

Dari berbagai sumber tersebut, data diekstrak secara manual ke dalam satu file Excel tunggal yaitu [`template_data.xlsx`](public/data/template_data.xlsx). File ini berfungsi sebagai *single source of truth* yang kemudian diolah dan dipecah menjadi dataset-dataset CSV/JSON final yang digunakan oleh setiap visualisasi.

## Pengolahan Data

Tahapan pengolahan data secara umum:

1. Mengumpulkan data mentah dari sumber BPS.
2. Mengekstraksi data dari tabel statistik dan publikasi BPS.
3. Menyatukan data ke dalam `template_data.xlsx`.
4. Membersihkan dan menyeragamkan nama wilayah serta kode wilayah.
5. Melakukan transformasi dan perhitungan indikator yang diperlukan.
6. Membentuk dataset CSV/JSON sesuai kebutuhan masing-masing visualisasi.
7. Menggabungkan data indikator dengan batas wilayah digital untuk visualisasi geospasial.
8. Dataset final digunakan oleh aplikasi melalui modul visualisasi masing-masing.

**Alur**: Raw Data (Query Builder + Dokumen PDF) -> Ekstraksi Manual -> `template_data.xlsx` -> Pengolahan -> Dataset Final (CSV/JSON)

## Sumber Data

Seluruh data utama dalam proyek ini bersumber dari **Badan Pusat Statistik (BPS) Republik Indonesia**. Data batas wilayah merupakan data pendukung non-BPS.

| Kode | Sumber | Tahun Data | URL | Tanggal Akses |
|---|---|---:|---|---|
| SRC001 | Statistik Migrasi Indonesia Hasil Long Form SP 2020 | 2020 | [\[URL sumber\]](https://www.bps.go.id/id/publication/2023/07/20/97c956dd7ff3ece924911115/statistik-migrasi-indonesia-hasil-long-form-sensus-penduduk-2020.html) | 2 Oktober 2026 |
| SRC002 | Indeks Pembangunan Manusia 2020 | 2020 | [\[URL sumber\]](https://www.bps.go.id/id/publication/2021/04/30/8e777ce2d7570ced44197a37/indeks-pembangunan-manusia-2020.html) | 2 Oktober 2026 |
| SRC003 | Statistik Demografi Indonesia Hasil SP 2020 | 2020 | [\[URL sumber\]](https://www.bps.go.id/id/publication/2025/01/31/29a40174e02f20a7a31b5bc3/statistik-demografi-indonesia--hasil-sensus-penduduk-2020-.html) | 3 Oktober 2026 |
| SRC004 | Persentase Penduduk Miskin (P0) menurut Kab/Kota | 2020 | [\[URL sumber\]](https://www.bps.go.id/id/query-builder) | 3 Oktober 2026 |
| SRC005 | IPM Metode Baru, tabel nasional | 2020 | [\[URL sumber\]](https://www.bps.go.id/id/query-builder) | 3 Oktober 2026 |
| SRC006 | IPM Papua | 2020 | [\[URL sumber\]](https://papua.bps.go.id/id/query-builder) | 3 Oktober 2026 |
| SRC007 | IPM Papua Barat | 2020 | [\[URL sumber\]](https://papuabarat.bps.go.id/id/query-builder) | 3 Oktober 2026 |
| SRC008 | PDRB Kabupaten/Kota di Indonesia 2020–2024 | 2020–2024 | [\[URL sumber\]](https://www.bps.go.id/id/publication/2025/06/10/ca543e942579ced46afd603b/produk-domestik-regional-bruto-kabupaten-kota-di-indonesia-2020-2024.html) | 3 Oktober 2026 |
| SRC009 | Tingkat Pengangguran Terbuka menurut Kab/Kota | 2020 | [\[URL sumber\]](https://www.bps.go.id/id/query-builder) | 3 Oktober 2026 |
| SRC010 | Jumlah Penduduk menurut Kab/Kota dan Kelompok Umur | 2020 | [\[URL sumber\]](https://www.bps.go.id/id/query-builder) | 3 Oktober 2026 |
| SRC011 | Statistik Komuter Jabodetabek | 2019 | [\[URL sumber\]](https://www.bps.go.id/id/publication/2019/12/04/eab87d14d99459f4016bb057/statistik-komuter-jabodetabek-2019.html) | 3 Oktober 2026 |

## Cara Menjalankan

```bash
# Install dependencies
npm install

# Jalankan dev server
npm run dev

# Build production
npm run build
```

## Deployment

**Project URL:** [\[URL website\]](https://hanhanano.github.io/UAS_VD/)

**Repository:** [\[URL GitHub/GitLab\]](https://github.com/hanhanano/UAS_VD)

Aplikasi di-deploy sebagai website publik dan dapat diakses tanpa login
maupun instalasi tambahan.

URL proyek dan repository akan dipertahankan aktif sampai proses penilaian
akhir selesai.

## Struktur Proyek

```
├── index.html                  # Halaman utama
├── src/
│   ├── main.js                 # Kontrol awal
│   ├── state.js                # Global state
│   ├── styles/
│   │   └── main.css            # Styling
│   ├── components/
│   │   ├── flow/
│   │   │   ├── chord.js        # Chord diagram
│   │   │   ├── ranking.js      # Bar chart ranking DKI
│   │   │   └── odMatrix.js     # OD matrix heatmap
│   │   ├── multivariate/
│   │   │   ├── pca.js          # PCA biplot
│   │   │   ├── parallelCoords.js
│   │   │   └── heatmap.js      # Clustered heatmap
│   │   ├── geospatial/
│   │   │   └── map.js          # Leaflet choropleth + komuter
│   │   ├── network/
│   │   │   └── graph.js        # Force-directed network
│   │   ├── hero/
│   │   │   └── heroMap.js      # Hero section
│   │   └── scrolly/
│   │       └── story.js        # Scrollama initialization
│   └── utils/
│       └── tooltip.js          # D3 tooltip helper
├── public/data/                # Dataset
├── vite.config.js
└── package.json
```

## Informasi Mata Kuliah

| Info | Detail |
|------|--------|
| Mata Kuliah | Visualisasi Data dan Informasi |
| Semester | Genap 2025/2026 |
| Dosen | Siti Mariyah, S.S.T., M.T., Ph.D |