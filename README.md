# Jakarta Dilepas, Bodetabek Dihuni

**UAS Visualisasi Data**
Raihan Taufiqurrahman Zaki 3SD1

---

## Deskripsi

Website data storytelling interaktif yang menganalisis pola migrasi risen penduduk Indonesia berdasarkan Sensus Penduduk dan aLong Form 2020 (BPS RI). Fokus utama adalah fenomena **suburbanisasi DKI Jakarta**: 797.468 orang tercatat pindah domisili keluar Jakarta, namun mayoritas hanya berpindah ke wilayah penyangga (Bodetabek), sementara 1,26 juta orang justru berkomuter masuk ke Jakarta setiap hari.

Narasi disajikan dalam format **scrollytelling** yaitu pembaca dapat menggulir halaman dan visualisasi berubah secara otomatis mengikuti alur cerita.

## Visualisasi yang Digunakan

| No | Visualisasi | Keterangan |
|----|-------------|------------|
| 1 | **Chord Diagram** | Aliran migrasi risen antarprovinsi (34×34) |
| 2 | **Horizontal Bar Chart** | Top 10 destinasi migran keluar DKI Jakarta |
| 3 | **OD Matrix Heatmap** | Matriks asal-tujuan 34 provinsi (skala logaritmik) |
| 4 | **PCA Biplot** | Analisis komponen utama 8 indikator pembangunan |
| 5 | **Parallel Coordinates** | Profil z-score DKI Jakarta vs 33 provinsi lain |
| 6 | **Clustered Heatmap** | Pengelompokan provinsi (hierarchical Ward) |
| 7 | **Choropleth Map + Komuter** | Peta kab/kota Jabodetabek dengan garis arus komuter 2019 |
| 8 | **Force-Directed Network** | Graf jaringan hub migrasi nasional |

## Teknikal

- **Vite**: build tool & dev server
- **D3.js v7**: seluruh visualisasi SVG (chord, heatmap, PCA, parallel coords, bar chart, network graph)
- **Leaflet**: peta geospasial choropleth + arus komuter
- **Scrollama**: scrollytelling (step trigger)
- **Lenis**: smooth scroll
- **Tailwind CSS v4**: styling utility-first
- **Vanilla JS (ES Modules)**

## Sumber Data

Seluruh angka utama berasal dari **Badan Pusat Statistik (BPS) RI**:

| Kode | Sumber | Tahun |
|------|--------|-------|
| SRC001 | Statistik Migrasi Indonesia Hasil Long Form SP 2020 | 2020 |
| SRC002 | Indeks Pembangunan Manusia 2020 | 2020 |
| SRC003 | Statistik Demografi Indonesia (Hasil SP 2020) | 2020 |
| SRC004 | Persentase Penduduk Miskin (P0) menurut Kab/Kota | 2020 |
| SRC005 | IPM [Metode Baru], tabel nasional | 2020 |
| SRC006-007 | IPM Papua & Papua Barat | 2020 |
| SRC008 | PDRB Kabupaten/Kota di Indonesia 2020-2024 | 2020 |
| SRC009 | Tingkat Pengangguran Terbuka menurut Kab/Kota | 2020 |
| SRC010 | Jumlah Penduduk menurut Kab/Kota dan Kelompok Umur | 2020 |
| SRC011 | Statistik Komuter Jabodetabek 2019 | 2019 |

Batas wilayah kab/kota (GeoJSON) adalah data pendukung non-BPS.

## Cara Menjalankan

```bash
# Install dependencies
npm install

# Jalankan dev server
npm run dev

# Build production
npm run build
```

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
| Mata Kuliah | Visualisasi Data |
| Semester | Genap 2025/2026 |
| Dosen | Siti Mariyah, S.S.T., M.T., Ph.D |