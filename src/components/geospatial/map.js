import L from 'leaflet';
import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderGeoMap(containerId, geoBoundary, geoData, commuterData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  // Controls bar + map container
  const controlBar = document.createElement('div');
  controlBar.className = 'absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#3a0e22]/95 backdrop-blur-md border border-[#5a1b38] shadow-xl text-xs font-sans text-white';
  controlBar.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-[#c9a0b5] font-bold uppercase tracking-wider text-[11px]">Layer Choropleth:</span>
      <select id="geo-metric-select" class="bg-[#280718] border border-[#5a1b38] text-white font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-400 shadow-xs cursor-pointer">
        <option value="poverty">Tingkat Kemiskinan (%)</option>
        <option value="ipm">Indeks Pembangunan Manusia (IPM)</option>
        <option value="pdrb_per_capita">PDRB per Kapita (Juta Rp)</option>
        <option value="population">Jumlah Penduduk (Jiwa)</option>
      </select>
    </div>
    <div class="flex items-center gap-2">
      <label class="flex items-center gap-1.5 cursor-pointer text-[#d8b4c8] font-semibold">
        <input type="checkbox" id="toggle-commuter-arcs" checked class="rounded bg-[#280718] border-[#5a1b38] text-amber-500 focus:ring-0">
        <span>Arus Komuter 2019</span>
      </label>
      <button id="btn-zoom-jabodetabek" class="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-3 py-1 rounded-lg transition-colors shadow-xs cursor-pointer">
        Fokus Jabodetabek
      </button>
      <button id="btn-zoom-java" class="bg-[#280718] hover:bg-[#45122b] border border-[#5a1b38] text-[#d8b4c8] hover:text-white font-bold px-3 py-1 rounded-lg transition-colors shadow-xs cursor-pointer">
        Pulau Jawa
      </button>
    </div>
  `;

  const mapDiv = document.createElement('div');
  mapDiv.id = 'leaflet-map-element';
  mapDiv.className = 'w-full h-full min-h-[500px] max-h-[620px] rounded-xl overflow-hidden';

  container.appendChild(controlBar);
  container.appendChild(mapDiv);

  // Leaflet map
  const map = L.map('leaflet-map-element', {
    center: [-6.25, 106.85],
    zoom: 9.5,
    minZoom: 5,
    maxZoom: 13,
    zoomControl: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // No tile layer ,  dark background via CSS, zero external requests
  map.attributionControl.setPrefix('Data: BPS RI · LF SP2020');

  const dataLookup = new Map();
  if (geoData && geoData.features_data) {
    geoData.features_data.forEach(item => {
      dataLookup.set(String(item.code), item);
    });
  }

  // Code alias map: Kemendagri post-pemekaran → BPS SP2020
  const codeAliasMap = {
    '912': '9428', '1472': '1473', '6407': '6402', '6408': '6404',
    '7324': '7325', '9115': '9426', '9119': '9427', '9128': '9436',
    '9201': '9171', '9202': '9105', '9203': '9101', '9204': '9106',
    '9205': '9108', '9206': '9104', '9207': '9103', '9208': '9102',
    '9209': '9109', '9210': '9110', '9211': '9111', '9212': '9112',
    '9271': '9171', '9301': '9401', '9302': '9413', '9303': '9414',
    '9304': '9415', '9405': '9433', '9406': '9434', '9407': '9435',
    '9501': '9402', '9502': '9417', '9503': '9416', '9504': '9418',
    '9505': '9431', '9506': '9432', '9507': '9430', '9508': '9429'
  };

  function resolveKabKotaCode(feature) {
    const raw = feature.properties.kode
      ? String(feature.properties.kode).replace('.', '')
      : String(feature.properties.idkab || feature.properties.code || '');
    return codeAliasMap[raw] || raw;
  }

  let currentMetric = 'poverty';
  let geojsonLayer = null;
  let commuterArcLayer = null;

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

  // Color Scale Generator (Colorblind safe Cividis & Viridis for light mode)
  function getMetricColor(val, metric) {
    if (val === undefined || val === null) return '#f1f5f9';

    if (metric === 'poverty') {
      const scale = d3.scaleSequential(d3.interpolateCividis).domain([3, 20]);
      return scale(val);
    } else if (metric === 'ipm') {
      const scale = d3.scaleSequential(d3.interpolateViridis).domain([60, 85]);
      return scale(val);
    } else if (metric === 'pdrb_per_capita') {
      const scale = d3.scaleSequentialLog(d3.interpolateViridis).domain([15000000, 300000000]);
      return scale(val);
    } else {
      const scale = d3.scaleSequentialLog(d3.interpolateCividis).domain([50000, 4000000]);
      return scale(val);
    }
  }

  // Draw GeoJSON Choropleth
  function drawChoropleth() {
    if (geojsonLayer) {
      map.removeLayer(geojsonLayer);
    }

    geojsonLayer = L.geoJSON(geoBoundary, {
      style: (feature) => {
        const idkab = resolveKabKotaCode(feature);
        const data = dataLookup.get(idkab);
        const val = data ? data[currentMetric] : null;
        const isJabodetabek = Boolean(centroids[idkab]);

        return {
          fillColor: getMetricColor(val, currentMetric),
          weight: isJabodetabek ? 2.2 : 0.7,
          opacity: 0.9,
          color: isJabodetabek ? '#f59e0b' : '#5a1c38',
          fillOpacity: 0.75
        };
      },
      onEachFeature: (feature, layer) => {
        const idkab = resolveKabKotaCode(feature);
        const data = dataLookup.get(idkab);
        const name = data ? data.name : (feature.properties.nama || feature.properties.nmkab);
        const provName = data ? data.province_name : (feature.properties.prov || feature.properties.nmprov);

        layer.on({
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({
              weight: 3.5,
              color: '#fbbf24',
              fillOpacity: 0.92
            });
            l.bringToFront();

            if (data) {
              showTooltip(`
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
                    <span class="font-bold text-amber-400">${data.population.toLocaleString()} jiwa</span>
                  </div>
                </div>
              `, e.originalEvent);
            }
          },
          mousemove: (e) => moveTooltip(e.originalEvent),
          mouseout: (e) => {
            geojsonLayer.resetStyle(e.target);
            hideTooltip();
          }
        });
      }
    }).addTo(map);
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
  drawCommuterArcs();

  // Controls Event Listeners
  document.getElementById('geo-metric-select').addEventListener('change', (e) => {
    currentMetric = e.target.value;
    drawChoropleth();
    drawCommuterArcs();
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
      currentMetric = metric;
      const sel = document.getElementById('geo-metric-select');
      if (sel) sel.value = metric;
      drawChoropleth();
      drawCommuterArcs();
    }
  };
}
