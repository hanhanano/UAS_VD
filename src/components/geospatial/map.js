import L from 'leaflet';
import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderGeoMap(containerId, geoBoundary, geoData, commuterData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  // Controls bar + map container
  // Wrapper khusus agar control dan peta tersusun vertikal
  const mapWrapper = document.createElement('div');
  mapWrapper.className = 'w-full h-full flex flex-col gap-2';

  // Controls bar
  const controlBar = document.createElement('div');
  controlBar.className =
    'shrink-0 w-full flex flex-wrap items-center justify-between gap-2 ' +
    'px-3 py-2.5 rounded-xl ' +
    'bg-[#3a0e22]/95 backdrop-blur-md ' +
    'border border-[#5a1b38] shadow-xl ' +
    'text-xs font-sans text-white';

  controlBar.innerHTML = `
    <div class="flex items-center gap-2">
      <label for="geo-metric-select"
        class="text-[#c9a0b5] font-bold uppercase tracking-wider text-[11px]">
        Choropleth (rasio):
      </label>

      <select id="geo-metric-select"
        class="bg-[#280718] border border-[#5a1b38] text-white
              font-bold rounded-lg px-2.5 py-1
              focus:outline-none focus:border-amber-400
              shadow-xs cursor-pointer">

        <option value="poverty">Tingkat Kemiskinan (%)</option>
        <option value="ipm">Indeks Pembangunan Manusia (IPM)</option>
        <option value="pdrb_per_capita">PDRB per Kapita (Juta Rp)</option>
      </select>
    </div>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">

      <label class="flex items-center gap-1.5 cursor-pointer
                    text-[#d8b4c8] font-semibold">
        <input type="checkbox"
          id="toggle-choropleth"
          checked
          class="rounded bg-[#280718] border-[#5a1b38]
                text-amber-500 focus:ring-0">
        <span>Choropleth</span>
      </label>

      <label class="flex items-center gap-1.5
                    text-[#d8b4c8] font-semibold"
            title="Opasitas choropleth">

        <input type="range"
          id="choropleth-opacity"
          min="20"
          max="100"
          step="5"
          value="78"
          class="w-16 accent-amber-400 cursor-pointer"
          aria-label="Opasitas choropleth">
      </label>

      <label class="flex items-center gap-1.5 cursor-pointer
                    text-[#d8b4c8] font-semibold">

        <input type="checkbox"
          id="toggle-pop-symbols"
          checked
          class="rounded bg-[#280718] border-[#5a1b38]
                text-rose-400 focus:ring-0">

        <span>Simbol proporsional: penduduk</span>
      </label>

      <label class="flex items-center gap-1.5 cursor-pointer
                    text-[#d8b4c8] font-semibold">

        <input type="checkbox"
          id="toggle-commuter-arcs"
          checked
          class="rounded bg-[#280718] border-[#5a1b38]
                text-amber-500 focus:ring-0">

        <span>Arus komuter 2019</span>
      </label>

      <button id="btn-zoom-jabodetabek"
        class="bg-[#280718] hover:bg-[#45122b]
              border border-[#5a1b38]
              text-[#d8b4c8] hover:text-white
              font-bold px-3 py-1 rounded-lg
              transition-colors shadow-xs cursor-pointer">
        Jabodetabek
      </button>

      <button id="btn-zoom-java"
        class="bg-[#280718] hover:bg-[#45122b]
              border border-[#5a1b38]
              text-[#d8b4c8] hover:text-white
              font-bold px-3 py-1 rounded-lg
              transition-colors shadow-xs cursor-pointer">
        Pulau Jawa
      </button>

    </div>
  `;

  // Map
  const mapDiv = document.createElement('div');
  mapDiv.id = 'leaflet-map-element';

  mapDiv.className =
    'flex-1 min-h-0 w-full rounded-xl overflow-hidden';

  // Susun vertikal
  mapWrapper.appendChild(controlBar);
  mapWrapper.appendChild(mapDiv);

  // Hanya satu child dari sticky-graphic-stage
  container.appendChild(mapWrapper);

  // Leaflet map
  const map = L.map('leaflet-map-element', {
    center: [-6.25, 106.85],
    zoom: 9.5,
    minZoom: 5,
    maxZoom: 13,
    zoomControl: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Urutan lapisan tetap: choropleth < simbol proporsional < garis komuter
  map.createPane('choroPane').style.zIndex = 400;
  map.createPane('symPane').style.zIndex = 450;
  map.createPane('arcPane').style.zIndex = 500;

  // No tile layer ,  dark background via CSS, zero external requests
  map.attributionControl.setPrefix('Data: BPS RI · LF SP2020');

  const dataLookup = new Map();
  if (geoData && geoData.features_data) {
    geoData.features_data.forEach(item => {
      dataLookup.set(String(item.code), item);
    });
  }

  // ---------------------------------------------------------------------
  // Pencocokan poligon ke data berdasarkan NAMA, bukan kode.
  // Kode di batas wilayah (pemekaran terbaru) dan di data indikator (SP2020)
  // berbeda; pemetaan berbasis kode sebelumnya memasangkan nilai ke wilayah
  // yang salah (mis. poligon Kutai Kartanegara memakai data Kutai Barat,
  // Jayapura memakai data Teluk Wondama, DKI Jakarta tertukar antar kota).
  // Kunci = [kota/kab] + nama ternormalisasi. Sisanya adalah selisih penamaan
  // yang dipetakan manual berdasarkan kode poligon.
  // ---------------------------------------------------------------------
  const normName = (n) => String(n || '')
    .toLowerCase()
    .replace(/^(kota|kabupaten|kab\.?)\s+/, '')
    .replace(/[^a-z]/g, '');
  const nameKey = (isKota, n) => `${isKota ? 'K' : 'B'}:${normName(n)}`;

  const dataByName = new Map();
  dataLookup.forEach((item, code) => {
    dataByName.set(nameKey(/^kota\s/i.test(item.name), item.name), code);
  });

  // kode poligon (tanpa titik) -> kode data, untuk nama yang berbeda ejaan/istilah
  const polygonToDataCode = {
    '6302': '6302', // Kotabaru (kabupaten) vs "Kota Baru" di data
    '6201': '6201', // Kotawaringin Barat (bendera "kota" di batas wilayah keliru)
    '6202': '6202', // Kotawaringin Timur (idem)
    '8103': '8101', // Kepulauan Tanimbar = Maluku Tenggara Barat
    '7601': '7605', // Pasangkayu = Mamuju Utara
    '1212': '1206', // Toba = Toba Samosir
    '7109': '7108', // Kep. Siau Tagulandang Biaro
    '1277': '1277', // Padang Sidempuan (ejaan)
    '3101': '3101', // Adm. Kepulauan Seribu
    '3171': '3173', // Jakarta Pusat
    '3172': '3175', // Jakarta Utara
    '3173': '3174', // Jakarta Barat
    '3174': '3171', // Jakarta Selatan
    '3175': '3172'  // Jakarta Timur
  };

  function resolveKabKotaCode(feature) {
    const p = feature.properties || {};
    const raw = p.kode ? String(p.kode).replace('.', '') : String(p.idkab || p.code || '');
    if (polygonToDataCode[raw] && dataLookup.has(polygonToDataCode[raw])) return polygonToDataCode[raw];
    const byName = dataByName.get(nameKey(Boolean(p.kota), p.nama || p.nmkab));
    return byName || null; // tanpa kecocokan: tidak ada data (bukan data wilayah lain)
  }

  let currentMetric = 'poverty';
  let geojsonLayer = null;
  let commuterArcLayer = null;
  let symbolLayer = null;
  let legendEl = null;
  let choroOpacity = 0.78;
  let choroVisible = true;

  // Jabodetabek Centroids lookup
  const centroids = {
    '3171': [-6.2615, 106.8106], // Jaksel
    '3172': [-6.2250, 106.9004], // Jaktim
    '3173': [-6.1805, 106.8284], // Jakpus
    '3174': [-6.1683, 106.7588], // Jakbar
    '3175': [-6.1384, 106.8640], // Jakut
    '3201': [-6.5518, 106.6291], // Bogor
    '3216': [-6.2494, 107.1557], // Bekasi
    '3271': [-6.5971, 106.8060], // Kota Bogor
    '3275': [-6.2383, 106.9756], // Kota Bekasi
    '3276': [-6.4025, 106.7942], // Kota Depok
    '3603': [-6.1783, 106.4674], // Tangerang
    '3671': [-6.1783, 106.6319], // Kota Tangerang
    '3674': [-6.2886, 106.7179]  // Kota Tangsel
  };

  // ---------------------------------------------------------------------
  // Klasifikasi: kuantil 5 kelas.
  // Alasan: sebaran ketiga indikator tidak simetris (menceng kanan untuk
  // kemiskinan dan PDRB per kapita, menceng kiri untuk IPM). Pada interval
  // sama, mayoritas kab/kota menumpuk di satu-dua kelas sehingga peta nyaris
  // satu warna. Kuantil menjaga tiap kelas berisi ±20% kab/kota, jadi
  // perbedaan antardaerah tetap terbaca. Palet berurutan Cividis/Viridis
  // (seragam secara persepsi, aman buta warna) cocok untuk data berurutan.
  // Hanya variabel rasio yang dipetakan sebagai choropleth; jumlah penduduk
  // (angka absolut) ditampilkan sebagai simbol proporsional.
  // ---------------------------------------------------------------------
  const N_CLASSES = 5;
  const metricConfig = {
    poverty: {
      label: 'Tingkat Kemiskinan (%)',
      interp: d3.interpolateCividis,
      scale: v => v,
      fmt: v => v.toFixed(1).replace('.', ',')
    },
    ipm: {
      label: 'Indeks Pembangunan Manusia (IPM)',
      interp: d3.interpolateViridis,
      scale: v => v,
      fmt: v => v.toFixed(1).replace('.', ',')
    },
    pdrb_per_capita: {
      label: 'PDRB per Kapita (Juta Rp)',
      interp: d3.interpolateViridis,
      scale: v => v / 1e6,
      fmt: v => (v >= 100 ? v.toFixed(0) : v.toFixed(1)).replace('.', ',')
    }
  };

  const classScales = {};
  Object.entries(metricConfig).forEach(([key, cfg]) => {
    const values = (geoData.features_data || [])
      .map(d => d[key])
      .filter(v => v !== null && v !== undefined && !Number.isNaN(v));
    const colors = d3.quantize(t => cfg.interp(0.1 + 0.85 * t), N_CLASSES);
    const quantile = d3.scaleQuantile().domain(values).range(colors);

    // Bandingkan dengan interval sama: berapa persen kab/kota di kelas terpadat?
    const [lo, hi] = d3.extent(values);
    const step = (hi - lo) / N_CLASSES;
    const eqCounts = new Array(N_CLASSES).fill(0);
    values.forEach(v => { eqCounts[Math.min(N_CLASSES - 1, Math.floor((v - lo) / step))]++; });
    const mean = d3.mean(values);
    const sd = d3.deviation(values) || 1;
    const skew = d3.mean(values, v => Math.pow((v - mean) / sd, 3));

    classScales[key] = {
      quantile, colors, min: lo, max: hi, n: values.length,
      eqMaxShare: Math.max(...eqCounts) / values.length,
      skew
    };
  });

  function getMetricColor(val, metric) {
    if (val === undefined || val === null) return '#3a1a2b';
    return classScales[metric].quantile(val);
  }

  // Gaya choropleth + sorotan provinsi terpilih (linking dengan tampilan lain)
  function featureStyle(feature) {
    const idkab = resolveKabKotaCode(feature);
    const data = dataLookup.get(idkab);
    const val = data ? data[currentMetric] : null;
    const isJabodetabek = Boolean(centroids[idkab]);
    const sel = state.selectedProvinces;
    const isSelected = data && sel.has(String(data.province_code));

    return {
      fillColor: getMetricColor(val, currentMetric),
      weight: isSelected ? 2.4 : (isJabodetabek ? 2.2 : 0.7),
      opacity: 0.95,
      color: isSelected ? '#f43f5e' : (isJabodetabek ? '#f59e0b' : '#5a1c38'),
      fillOpacity: choroOpacity
    };
  }

  function tooltipHtml(data, name, provName) {
    return `
      <div class="font-serif font-bold text-sm text-white mb-0.5">${name}</div>
      <div class="text-[11px] text-[#c9a0b5] mb-2 font-semibold">${provName}</div>
      <div class="space-y-1 text-xs">
        <div class="flex justify-between gap-4">
          <span class="text-[#c9a0b5]">Kemiskinan:</span>
          <span class="font-bold text-[#f1e5ed]">${data.poverty}%</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-[#c9a0b5]">IPM:</span>
          <span class="font-bold text-sky-400">${data.ipm}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-[#c9a0b5]">PDRB per Kapita:</span>
          <span class="font-bold text-[#f1e5ed]">Rp ${(data.pdrb_per_capita / 1000000).toFixed(1)} Jt</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-[#c9a0b5]">Penduduk:</span>
          <span class="font-bold text-amber-400">${data.population.toLocaleString('id-ID')} jiwa</span>
        </div>
      </div>
    `;
  }

  // Centroid tiap kab/kota (untuk simbol proporsional), dihitung dari batas wilayah
  const featureCentroids = new Map();
  const planarPath = d3.geoPath(d3.geoIdentity()); // centroid luas pada koordinat lon/lat
  (geoBoundary.features || []).forEach(f => {
    const c = planarPath.centroid(f); // [lon, lat]
    if (Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      featureCentroids.set(resolveKabKotaCode(f), [c[1], c[0]]);
    }
  });

  const maxPopulation = d3.max(geoData.features_data || [], d => d.population) || 1;
  const MAX_SYMBOL_RADIUS = 26;
  // Skala akar kuadrat: LUAS lingkaran sebanding dengan jumlah penduduk
  const symbolRadius = d3.scaleSqrt().domain([0, maxPopulation]).range([0, MAX_SYMBOL_RADIUS]);

  // Draw GeoJSON Choropleth
  function drawChoropleth() {
    if (geojsonLayer) {
      map.removeLayer(geojsonLayer);
    }

    geojsonLayer = L.geoJSON(geoBoundary, {
      pane: 'choroPane',
      style: featureStyle,
      onEachFeature: (feature, layer) => {
        const idkab = resolveKabKotaCode(feature);
        const data = dataLookup.get(idkab);
        const name = data ? data.name : (feature.properties.nama || feature.properties.nmkab);
        const provName = data ? data.province_name : (feature.properties.prov || feature.properties.nmprov);

        layer.on({
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({ weight: 3.5, color: '#fbbf24', fillOpacity: Math.min(1, choroOpacity + 0.14) });
            l.bringToFront();
            if (data) showTooltip(tooltipHtml(data, name, provName), e.originalEvent);
          },
          mousemove: (e) => moveTooltip(e.originalEvent),
          mouseout: (e) => {
            geojsonLayer.resetStyle(e.target);
            hideTooltip();
          },
          click: (e) => {
            if (data) {
              state.setSelectedProvince(String(data.province_code));

              // Zoom ke kab/kota yang diklik
              map.flyToBounds(e.target.getBounds(), {
                padding: [40, 40],
                maxZoom: 11,
                duration: 0.8
              });
            }
          }
        });
      }
    }).addTo(map);
  }

  // Lapisan simbol proporsional: lingkaran di titik tengah kab/kota
  function drawSymbols() {
    if (symbolLayer) {
      map.removeLayer(symbolLayer);
      symbolLayer = null;
    }
    const toggle = document.getElementById('toggle-pop-symbols');
    if (!toggle || !toggle.checked) return;

    symbolLayer = L.layerGroup();
    const items = [];
    dataLookup.forEach((data, code) => {
      const ll = featureCentroids.get(code);
      if (ll) items.push({ data, ll });
    });
    // Gambar yang terbesar dahulu agar lingkaran kecil tidak tertutup
    items.sort((p, q) => q.data.population - p.data.population);

    items.forEach(({ data, ll }) => {
      const marker = L.circleMarker(ll, {
        pane: 'symPane',
        radius: Math.max(1.5, symbolRadius(data.population)),
        fillColor: '#fb7185',
        fillOpacity: 0.5,
        color: '#fff1f2',
        weight: 0.9,
        opacity: 0.9
      });
      marker.on('mouseover', (e) => {
        marker.setStyle({ weight: 2.2, fillOpacity: 0.75 });
        showTooltip(tooltipHtml(data, data.name, data.province_name), e.originalEvent);
      });
      marker.on('mousemove', (e) => moveTooltip(e.originalEvent));
      marker.on('mouseout', () => {
        marker.setStyle({ weight: 0.9, fillOpacity: 0.5 });
        hideTooltip();
      });
      marker.on('click', () => state.setSelectedProvince(String(data.province_code)));
      symbolLayer.addLayer(marker);
    });
    symbolLayer.addTo(map);
  }

  // Legenda: kelas kuantil + simbol proporsional + catatan metode
  const LegendControl = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd() {
      legendEl = L.DomUtil.create('div', 'geo-legend');
      legendEl.style.cssText = 'background:rgba(58,14,34,0.94);border:1px solid #5a1b38;border-radius:12px;padding:10px 12px;color:#f1e5ed;font:12px/1.35 Montserrat,sans-serif;max-width:250px;box-shadow:0 8px 24px rgba(0,0,0,.4)';
      L.DomEvent.disableClickPropagation(legendEl);
      L.DomEvent.disableScrollPropagation(legendEl);
      return legendEl;
    }
  });
  const legendControl = new LegendControl().addTo(map);

  function updateLegend() {
    if (!legendEl) return;
    const cfg = metricConfig[currentMetric];
    const cs = classScales[currentMetric];
    const breaks = [cs.min, ...cs.quantile.quantiles(), cs.max].map(cfg.scale);
    const symbolsOn = Boolean(symbolLayer);

    const rows = cs.colors.map((color, i) => {
      const lo = breaks[i];
      const hi = breaks[i + 1];
      return `
        <div style="display:flex;align-items:center;gap:8px;margin:2px 0">
          <span style="width:22px;height:12px;background:${color};border:1px solid rgba(255,255,255,.35);border-radius:2px;flex:none"></span>
          <span>${cfg.fmt(lo)} – ${cfg.fmt(hi)}</span>
        </div>`;
    }).join('');

    const symbolSamples = [100000, 1000000, 3000000].map(v => {
      const r = symbolRadius(v);
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="display:block;width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:rgba(251,113,133,.5);border:1px solid #fff1f2"></span>
          <span style="font-size:10px;color:#c9a0b5">${v >= 1e6 ? (v / 1e6) + ' jt' : (v / 1e3) + ' rb'}</span>
        </div>`;
    }).join('');

    const choroHtml = choroVisible ? `
      <div style="font-weight:800;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#fbbf24;margin-bottom:4px">${cfg.label}</div>
      <div style="font-size:10px;color:#c9a0b5;margin-bottom:3px">Kuantil, ${N_CLASSES} kelas (±${Math.round(cs.n / N_CLASSES)} kab/kota per kelas)</div>
      ${rows}
      <div style="display:flex;align-items:center;gap:8px;margin:2px 0">
        <span style="width:22px;height:12px;background:#3a1a2b;border:1px solid rgba(255,255,255,.35);border-radius:2px;flex:none"></span>
        <span style="color:#c9a0b5">Tidak ada data</span>
      </div>` : '';

    legendEl.style.display = (choroVisible || symbolsOn) ? '' : 'none';
    legendEl.innerHTML = `
      ${choroHtml}
      ${symbolsOn ? `
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid #5a1b38">
          <div style="font-weight:800;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#fb7185;margin-bottom:4px">Jumlah penduduk</div>
          <div style="display:flex;align-items:flex-end;gap:12px">${symbolSamples}</div>
          <div style="font-size:10px;color:#c9a0b5;margin-top:3px">Luas lingkaran sebanding jumlah penduduk</div>
        </div>` : ''}
      ${choroVisible ? `<details style="margin-top:8px;padding-top:6px;border-top:1px solid #5a1b38">
        <summary style="cursor:pointer;font-size:10px;font-weight:700;color:#d8b4c8">Mengapa kuantil?</summary>
        <div style="font-size:10px;color:#c9a0b5;margin-top:4px">
          Sebaran tidak simetris (kemencengan ${cs.skew.toFixed(1).replace('.', ',')}). Dengan interval sama,
          ${Math.round(cs.eqMaxShare * 100)}% kab/kota menumpuk di satu kelas sehingga peta nyaris satu warna.
          Kuantil menjaga tiap kelas tetap terisi. Palet berurutan ${currentMetric === 'poverty' ? 'Cividis' : 'Viridis'}
          seragam secara persepsi dan aman bagi buta warna.
        </div>
      </details>` : ''}
    `;
  }

  // Draw Commuter Flow Arcs (Die Zeit Radiant Gold & Cyan)
  function drawCommuterArcs() {
    if (commuterArcLayer) {
      map.removeLayer(commuterArcLayer);
    }

    if (!document.getElementById('toggle-commuter-arcs').checked) return;

    commuterArcLayer = L.layerGroup();
    const majorLinks = commuterData.links.filter(l => l.value >= 12000);

    majorLinks.forEach(link => {
      const srcCoord = centroids[link.source];
      const tgtCoord = centroids[link.target];
      if (!srcCoord || !tgtCoord) return;

      const latlngs = [srcCoord, tgtCoord];
      const isIntoJakarta = link.target.startsWith('31');

      const polyline = L.polyline(latlngs, {
        pane: 'arcPane',
        color: isIntoJakarta ? '#fbbf24' : '#38bdf8',
        weight: Math.max(2, Math.min(7, link.value / 22000)),
        opacity: 0.85,
        dashArray: isIntoJakarta ? null : '4, 4'
      });

      polyline.on('mouseover', (e) => {
        polyline.setStyle({ weight: 6, opacity: 1, color: '#ffffff' });
        showTooltip(`
          <div class="text-[10px] text-amber-400 uppercase tracking-wider font-extrabold mb-1">Arus Komuter Harian 2019</div>
          <div class="font-serif font-bold text-white text-xs">${link.source_name} &rarr; ${link.target_name}</div>
          <div class="mt-1 text-sm font-extrabold text-amber-300">${link.value.toLocaleString()} <span class="text-xs font-normal text-[#c9a0b5]">komuter/hari</span></div>
          <div class="text-[10px] text-[#a57b92] mt-1 font-medium">Survei Komuter Jabodetabek 2019</div>
        `, e.originalEvent);
      });
      polyline.on('mousemove', (e) => moveTooltip(e.originalEvent));
      polyline.on('mouseout', () => {
        polyline.setStyle({
          color: isIntoJakarta ? '#fbbf24' : '#38bdf8',
          weight: Math.max(2, Math.min(7, link.value / 22000)),
          opacity: 0.85
        });
        hideTooltip();
      });

      commuterArcLayer.addLayer(polyline);
    });

    // Add node markers with labels
    Object.entries(centroids).forEach(([code, coord]) => {
      const nodeInfo = commuterData.nodes.find(n => n.code === code);
      const isJakarta = code.startsWith('31');

      const circle = L.circleMarker(coord, {
        pane: 'arcPane',
        radius: isJakarta ? 6.5 : 5.5,
        fillColor: isJakarta ? '#e11d48' : '#0d9488',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.95
      });

      circle.bindTooltip(nodeInfo ? nodeInfo.name.replace('Kota ', '') : code, {
        permanent: false,
        direction: 'top',
        className: 'bg-white text-slate-800 font-sans font-bold border border-slate-200 text-[10.5px] px-1.5 py-0.5 rounded-md shadow-sm'
      });

      commuterArcLayer.addLayer(circle);
    });

    commuterArcLayer.addTo(map);
  }

  // Initial draw
  drawChoropleth();
  drawSymbols();
  drawCommuterArcs();
  updateLegend();

  function refreshChoropleth() {
    if (geojsonLayer) geojsonLayer.setStyle(featureStyle);
    updateLegend();
  }

  // Linking: peta ikut bereaksi terhadap seleksi dari PCA, graf, dsb.
  const unsubSelect = state.on('selection:change', () => {
    if (geojsonLayer) geojsonLayer.setStyle(featureStyle);
  });

  // Controls Event Listeners
  document.getElementById('geo-metric-select').addEventListener('change', (e) => {
    currentMetric = e.target.value;
    refreshChoropleth();
  });

  document.getElementById('toggle-choropleth').addEventListener('change', (e) => {
    if (e.target.checked) {
      geojsonLayer.addTo(map);
    } else {
      map.removeLayer(geojsonLayer);
      hideTooltip();
    }
    choroVisible = e.target.checked;
    updateLegend();
  });

  document.getElementById('choropleth-opacity').addEventListener('input', (e) => {
    choroOpacity = parseInt(e.target.value, 10) / 100;
    if (geojsonLayer) geojsonLayer.setStyle(featureStyle);
  });

  document.getElementById('toggle-pop-symbols').addEventListener('change', () => {
    drawSymbols();
    updateLegend();
  });

  document.getElementById('toggle-commuter-arcs').addEventListener('change', () => {
    drawCommuterArcs();
  });

  document.getElementById('btn-zoom-jabodetabek').addEventListener('click', () => {
    map.flyTo([-6.25, 106.85], 10, { duration: 1.2 });
  });

  document.getElementById('btn-zoom-java').addEventListener('click', () => {
    map.flyTo([-7.3, 109.8], 7, { duration: 1.2 });
  });

  return {
    flyToJabodetabek: () => map.flyTo([-6.25, 106.85], 10, { duration: 1.2 }),
    flyToJava: () => map.flyTo([-7.3, 109.8], 7, { duration: 1.2 }),
    setMetric: (metric) => {
      if (!metricConfig[metric]) return; // hanya variabel rasio yang bisa dijadikan choropleth
      currentMetric = metric;
      const sel = document.getElementById('geo-metric-select');
      if (sel) sel.value = metric;
      refreshChoropleth();
    },
    // Dipakai pengujian: kode data yang dipasangkan ke sebuah poligon
    resolveCode: resolveKabKotaCode,
    setSymbols: (on) => {
      const cb = document.getElementById('toggle-pop-symbols');
      if (cb) cb.checked = Boolean(on);
      drawSymbols();
      updateLegend();
    },
    destroy: () => {
      unsubSelect();
      map.remove();
    }
  };
}
