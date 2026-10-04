import './styles/main.css';
import Lenis from 'lenis';
import { state } from './state.js';
import { initTooltip } from './utils/tooltip.js';
import { renderChord } from './components/flow/chord.js';
import { renderODMatrix } from './components/flow/odMatrix.js';
import { renderJakartaRanking } from './components/flow/ranking.js';
import { renderPCAPlot } from './components/multivariate/pca.js';
import { renderParallelCoords } from './components/multivariate/parallelCoords.js';
import { renderClusteredHeatmap } from './components/multivariate/heatmap.js';
import { renderGeoMap } from './components/geospatial/map.js';
import { renderNetworkGraph } from './components/network/graph.js';
import { renderAdjacencyMatrix } from './components/network/adjacency.js';
import { renderLinkedMultivariate } from './components/multivariate/linked.js';
import { initScrollytelling } from './components/scrolly/story.js';
import { renderHeroMap } from './components/hero/heroMap.js';

// Loaded datasets cache
let data = {
  flow: null,
  jakarta: null,
  multivariate: null,
  pca: null,
  geoData: null,
  geoBoundary: null,
  commuter: null,
  network: null
};

// Chart controller references
let geoController = null;
let currentActiveView = 'chord';
let currentCleanup = null; // melepas listener state dari tampilan sebelumnya

async function loadAllData() {
  const loadingIndicator = document.getElementById('loading-overlay');
  try {
    const [
      flow,
      jakarta,
      multivariate,
      pca,
      geoData,
      commuter,
      network,
      geoBoundary
    ] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/flow.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/jakarta.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/multivariate.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/pca.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/geo_data.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/commuter.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/network.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/kabkot.geojson`).then(r => r.json())
    ]);

    data = { flow, jakarta, multivariate, pca, geoData, commuter, network, geoBoundary };

    if (loadingIndicator) {
      loadingIndicator.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => loadingIndicator.remove(), 400);
    }
  } catch (err) {
    console.error('Gagal memuat data:', err);
    if (loadingIndicator) {
      loadingIndicator.innerHTML = `
        <div class="text-rose-400 font-bold p-6 bg-slate-900 border border-rose-500 rounded-lg max-w-md">
          <div class="text-base mb-2">Gagal Memuat Dataset</div>
          <div class="text-xs text-slate-300">${err.message}</div>
        </div>
      `;
    }
  }
}

// Switch the sticky visualization panel with crossfade transition
let _switchTransitionId = 0;

function switchStageGraphic(viewName, skipTransition = false, afterRender = null) {
  const container = document.getElementById('sticky-graphic-stage');
  const stageHeader = document.getElementById('stage-graphic-title');
  const stageSubtitle = document.getElementById('stage-graphic-subtitle');
  if (!container) return;

  if (viewName === currentActiveView && !skipTransition) {
    if (afterRender) afterRender();
    return;
  }

  currentActiveView = viewName;
  const transitionId = ++_switchTransitionId;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.className = 'tab-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20';
    } else {
      btn.className = 'tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#3d1126] text-[#d8b4c8] hover:text-white border border-[#551935] transition-colors';
    }
  });

  const sliderContainer = document.getElementById('stage-slider-container');
  if (sliderContainer) {
    sliderContainer.style.display = ['chord', 'od_matrix'].includes(viewName) ? 'flex' : 'none';
  }
  const networkControls = document.getElementById('stage-network-controls');
  if (networkControls) {
    networkControls.style.display = viewName === 'network' ? 'flex' : 'none';
  }

  function renderNewView() {
    // Lepas listener tampilan lama (dan hancurkan peta Leaflet) sebelum menggambar ulang
    if (currentCleanup) {
      try { currentCleanup(); } catch (err) { console.error('Cleanup gagal:', err); }
      currentCleanup = null;
    }
    geoController = null;
    container.innerHTML = '';
    const meta = getViewMeta(viewName);
    if (stageHeader) stageHeader.textContent = meta.title;
    if (stageSubtitle) stageSubtitle.textContent = meta.subtitle;

    let result = null;
    switch (viewName) {
      case 'chord': result = renderChord('sticky-graphic-stage', data.flow); break;
      case 'ranking': result = renderJakartaRanking('sticky-graphic-stage', data.jakarta); break;
      case 'od_matrix': result = renderODMatrix('sticky-graphic-stage', data.flow); break;
      case 'linked': result = renderLinkedMultivariate('sticky-graphic-stage', data.multivariate, data.pca); break;
      case 'pca': result = renderPCAPlot('sticky-graphic-stage', data.multivariate, data.pca); break;
      case 'parallel': result = renderParallelCoords('sticky-graphic-stage', data.multivariate); break;
      case 'heatmap': result = renderClusteredHeatmap('sticky-graphic-stage', data.multivariate, data.pca); break;
      case 'map':
        result = renderGeoMap('sticky-graphic-stage', data.geoBoundary, data.geoData, data.commuter);
        geoController = result;
        break;
      case 'network': result = renderNetworkGraph('sticky-graphic-stage', data.network); break;
      // result = state.networkMode === 'matrix'
      //   ? renderAdjacencyMatrix('sticky-graphic-stage', data.network)
      //   : renderNetworkGraph('sticky-graphic-stage', data.network);
      // updateNetworkControls();
      // if (state.networkMode === 'matrix' && stageSubtitle) {
      //   stageHeader.textContent = 'Matriks Adjacency Jaringan Migrasi';
      //   stageSubtitle.textContent = 'Baris = asal, kolom = tujuan; urut menurut weighted strength, hanya edge di atas ambang';
      // }
      // break;
    }
    currentCleanup = typeof result === 'function' ? result : (result && result.destroy) || null;
    if (afterRender) afterRender();
  }

  if (skipTransition || !container.children.length) {
    renderNewView();
    container.classList.remove('stage-fade-out');
    container.classList.add('stage-fade-in');
    return;
  }

  // Crossfade: phase 1 fade out, phase 2 render, phase 3 fade in
  container.classList.remove('stage-fade-in');
  container.classList.add('stage-fade-out');
  if (stageHeader) stageHeader.classList.add('stage-header-transitioning');
  if (stageSubtitle) stageSubtitle.classList.add('stage-header-transitioning');

  setTimeout(() => {
    if (transitionId !== _switchTransitionId) return;
    renderNewView();
    container.classList.remove('stage-fade-out');
    container.classList.add('stage-fade-in');
    if (stageHeader) stageHeader.classList.remove('stage-header-transitioning');
    if (stageSubtitle) stageSubtitle.classList.remove('stage-header-transitioning');
  }, 250);
}

// View metadata lookup
function getViewMeta(viewName) {
  const meta = {
    chord: {
      title: 'Diagram Aliran Migrasi Risen',
      subtitle: 'Arah perpindahan penduduk antar provinsi',
    },
    ranking: {
      title: 'Distribusi Destinasi Migran Keluar DKI Jakarta',
      subtitle: '797.468 migran risen keluar dari DKI',
    },
    od_matrix: {
      title: 'Matriks Asal-Tujuan',
      subtitle: 'Heatmap provinsi',
    },
    linked: {
      title: 'PCA + Koordinat Paralel Terhubung (Brushing & Linking)',
      subtitle: 'Seret kotak di PCA untuk memilih',
    },
    pca: {
      title: 'PCA Biplot (PC1 vs PC2) 8 Indikator Pembangunan',
      subtitle: 'DKI Jakarta menjadi pencilan ekstrem di PC1 (+6,16): tertinggi pada beberapa indikator',
    },
    parallel: {
      title: 'Parallel Coordinates Plot (8 Indikator Terstandarisasi)',
      subtitle: 'Profil DKI Jakarta dibandingkan 33 provinsi lainnya',
    },
    heatmap: {
      title: 'Heatmap Terklaster (Hierarchical Ward)',
      subtitle: 'Pengelompokan 34 provinsi berdasarkan kemiripan struktur indikator multivariat',
    },
    map: {
      title: 'Peta Geospasial & Mobilitas Jabodetabek',
      subtitle: 'Wilayah penyangga Jakarta dan arus komuter 2019',
    },
    network: {
      title: 'Graf Jaringan Force-Directed & Hub Migrasi',
      subtitle: 'Ukuran node mencerminkan total arus masuk + keluar',
    },
  };
  return meta[viewName] || { title: '', subtitle: '' };
}


// Step → visualization mapping
const stepViewMap = [
  'chord',
  'ranking',
  'od_matrix',
  'map',
  'linked',
  'parallel',
  'heatmap',
  'map',
  'network'
];

// Key insight data per step
const stepInsights = [
  { label: 'Migran Risen Nasional', text: '4,14 juta jiwa' },
  { label: 'Keluar DKI Jakarta', text: '797.468 jiwa' },
  { label: 'Pasangan Aktif', text: '1.061 dari 1.122' },
  { label: 'Arus ke Jabar + Banten', text: '55,5%' },
  { label: 'Variansi PC1', text: '55,6%' },
  { label: 'Kepadatan DKI', text: '15.907 jiwa/km²' },
  { label: 'Silhouette Score', text: '0,28 (lemah)' },
  { label: 'Komuter Masuk DKI', text: '1,26 juta/hari' },
  { label: 'Pelepas Terbesar', text: 'DKI Jakarta' },
];

// Update progress dots
function updateProgressDots(stepIndex) {
  document.querySelectorAll('.progress-dot').forEach(dot => {
    const dotIndex = parseInt(dot.dataset.dot, 10);
    if (dotIndex === stepIndex) {
      dot.classList.add('is-active');
    } else {
      dot.classList.remove('is-active');
    }
  });
}

function updateInsightBadge(stepIndex) {
  const badge = document.getElementById('stage-insight-badge');
  const labelEl = document.getElementById('stage-insight-label');
  const textEl = document.getElementById('stage-insight-text');
  if (!badge || !labelEl || !textEl) return;

  const insight = stepInsights[stepIndex];
  if (insight) {
    labelEl.textContent = insight.label;
    textEl.textContent = insight.text;
    badge.classList.remove('is-visible');
    requestAnimationFrame(() => requestAnimationFrame(() => badge.classList.add('is-visible')));
  }
}

function onStepEnter(stepIndex) {
  const targetView = stepViewMap[stepIndex] || 'chord';
  const afterRender = targetView === 'map'
    ? () => {
      if (!geoController) return;
      if (stepIndex === 3) {
        geoController.flyToJava();
        geoController.setMetric('poverty');
        geoController.setSymbols(false); // fokus ke choropleth kuantil
      } else if (stepIndex === 7) {
        geoController.flyToJabodetabek();
        geoController.setMetric('poverty');
        geoController.setSymbols(true); // tambah simbol proporsional penduduk
      }
    }
    : null;

  switchStageGraphic(targetView, false, afterRender);
  updateProgressDots(stepIndex);
  updateInsightBadge(stepIndex);
}

// Sinkronkan tombol mode dan hitungan edge pada kontrol jaringan
function updateNetworkControls() {
  document.querySelectorAll('.net-mode-btn').forEach(btn => {
    const active = btn.dataset.mode === state.networkMode;
    btn.className = 'net-mode-btn px-2 py-0.5 rounded-md font-bold ' + (active
      ? 'bg-amber-400 text-slate-950'
      : 'bg-[#280718] border border-[#5a1b38] text-[#d8b4c8] hover:text-white');
    btn.setAttribute('aria-pressed', String(active));
  });
  const countEl = document.getElementById('network-edge-count');
  if (countEl && data.network) {
    const n = data.network.links.filter(l => l.value >= state.networkThreshold).length;
    countEl.textContent = `${n.toLocaleString('id-ID')} edge · ${data.network.nodes.length} node`;
  }
}

// Isi dropdown asal/tujuan dari daftar provinsi pada data aliran
function populateFlowFilters() {
  if (!data.flow) return;
  const nodes = [...data.flow.nodes].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  [['flow-origin-select', 'origin'], ['flow-dest-select', 'dest']].forEach(([id, kind]) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Semua</option>' +
      nodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
    sel.addEventListener('change', (e) => {
      if (kind === 'origin') state.setFlowOrigin(e.target.value);
      else state.setFlowDest(e.target.value);
      if (currentActiveView === 'chord') switchStageGraphic('chord', true);
    });
  });
}

// UI controls: tabs, sliders, buttons
function setupUIControls() {
  populateFlowFilters();

  document.querySelectorAll('.net-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.setNetworkMode(btn.dataset.mode);
      updateNetworkControls();
      if (currentActiveView === 'network') switchStageGraphic('network', true);
    });
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      if (view) switchStageGraphic(view);
    });
  });

  const flowSlider = document.getElementById('flow-threshold-slider');
  const flowValDisplay = document.getElementById('flow-threshold-value');
  if (flowSlider && flowValDisplay) {
    flowSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      flowValDisplay.textContent = val.toLocaleString('id-ID') + ' jiwa';
      state.setFlowThreshold(val);
      if (currentActiveView === 'chord') switchStageGraphic(currentActiveView, true);
    });
  }

  const netSlider = document.getElementById('network-threshold-slider');
  const netValDisplay = document.getElementById('network-threshold-value');
  if (netSlider && netValDisplay) {
    netSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      netValDisplay.textContent = val.toLocaleString('id-ID') + ' jiwa';
      state.setNetworkThreshold(val);
      updateNetworkControls();
      if (currentActiveView === 'network') switchStageGraphic('network', true);
    });
  }

  const resetFocusBtn = document.getElementById('btn-reset-focus');
  if (resetFocusBtn) {
    resetFocusBtn.addEventListener('click', () => {
      state.setFlowOrigin(null);
      state.setFlowDest(null);
      ['flow-origin-select', 'flow-dest-select'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      state.setSelectedProvince('31');
      state.setHoveredProvince(null);
      if (currentActiveView === 'chord') switchStageGraphic('chord', true);
    });
  }

  const menuBtn = document.getElementById('menu-toggle-btn');
  const navDropdown = document.getElementById('nav-dropdown');
  if (menuBtn && navDropdown) {
    menuBtn.addEventListener('click', () => navDropdown.classList.toggle('hidden'));
    navDropdown.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navDropdown.classList.add('hidden'));
    });
  }
}

// Lenis smooth scroll
function initSmoothScroll() {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 0.8,
    touchMultiplier: 1.5,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) lenis.scrollTo(target, { offset: -80, duration: 1.5 });
    });
  });

  return lenis;
}

// Scroll reveal + navbar scroll effect + progress dots
function initScrollReveal() {
  document.querySelectorAll('[data-reveal-stagger]').forEach(parent => {
    const children = parent.querySelectorAll('[data-reveal]');
    children.forEach((child, i) => {
      child.style.setProperty('--reveal-i', i);
      if (!child.hasAttribute('data-reveal-delay')) {
        child.style.transitionDelay = `${i * 0.1}s`;
      }
    });
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { root: null, rootMargin: '0px 0px -50px 0px', threshold: 0.15 });

  document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('is-scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  const scrollySection = document.getElementById('scrolly-section');
  const progressDots = document.getElementById('scrolly-progress');
  if (scrollySection && progressDots) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        progressDots.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { threshold: 0.05 });
    sectionObserver.observe(scrollySection);

    progressDots.querySelectorAll('.progress-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const stepEl = document.querySelector(`.step[data-step="${dot.dataset.dot}"]`);
        if (stepEl) stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }
}

// App entry point
async function initApp() {
  initTooltip();
  initSmoothScroll();
  await loadAllData();
  setupUIControls();
  switchStageGraphic('chord', true);
  renderHeroMap('hero-flow-map-container');
  initScrollytelling(onStepEnter);
  initScrollReveal();
}

document.addEventListener('DOMContentLoaded', initApp);
