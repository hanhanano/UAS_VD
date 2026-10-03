import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderPCAPlot(containerId, multivarData, pcaData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const margin = { top: 40, right: 40, bottom: 55, left: 60 };
  const width = (container.clientWidth || 650) - margin.left - margin.right;
  const height = (container.clientHeight || 520) - margin.top - margin.bottom;

  const points = multivarData.points;
  const variancePC1 = (pcaData.explained_variance_ratio[0] * 100).toFixed(1).replace('.', ',');
  const variancePC2 = (pcaData.explained_variance_ratio[1] * 100).toFixed(1).replace('.', ',');

  const xExtent = d3.extent(points, d => d.pc1);
  const yExtent = d3.extent(points, d => d.pc2);

  const x = d3.scaleLinear()
    .domain([xExtent[0] - 1, xExtent[1] + 1])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([yExtent[0] - 1, yExtent[1] + 1])
    .range([height, 0]);

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr('class', 'w-full h-full max-h-[550px]')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Origin reference crosshair
  svg.append('line')
    .attr('x1', x(0)).attr('x2', x(0))
    .attr('y1', 0).attr('y2', height)
    .attr('stroke', '#521836')
    .attr('stroke-dasharray', '3,3');

  svg.append('line')
    .attr('y1', y(0)).attr('y2', y(0))
    .attr('x1', 0).attr('x2', width)
    .attr('stroke', '#521836')
    .attr('stroke-dasharray', '3,3');

  // Axes
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .attr('class', 'text-xs text-[#c9a0b5] font-sans')
    .call(d3.axisBottom(x).ticks(8))
    .selectAll('path, line')
    .attr('stroke', '#6b2548');

  svg.append('g')
    .attr('class', 'text-xs text-[#c9a0b5] font-sans')
    .call(d3.axisLeft(y).ticks(8))
    .selectAll('path, line')
    .attr('stroke', '#6b2548');

  // Axis Labels
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + 42)
    .attr('text-anchor', 'middle')
    .attr('class', 'text-xs font-bold fill-[#f1e5ed] font-sans')
    .text(`Principal Component 1 (${variancePC1}% Varians - Tingkat Pembangunan & Kepadatan) →`);

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -45)
    .attr('text-anchor', 'middle')
    .attr('class', 'text-xs font-bold fill-[#f1e5ed] font-sans')
    .text(`Principal Component 2 (${variancePC2}% Varians - Pendidikan / Harapan Sekolah) →`);

  // PCA Loadings Vectors (Arrows in Die Zeit Radiant Gold)
  const loadings = pcaData.loadings;
  const vectorScale = Math.min(width, height) * 0.38;
  const vectorGroup = svg.append('g').attr('class', 'loadings-vectors');

  // Arrow marker definition
  svg.append('defs').append('marker')
    .attr('id', 'arrow-gold')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 8)
    .attr('refY', 5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#f59e0b');

  const variableLabels = {
    ipm: 'IPM',
    uhh: 'UHH',
    hls: 'HLS',
    rls: 'RLS',
    pengeluaran_per_kapita: 'Pengeluaran',
    persentase_miskin: 'Kemiskinan',
    tpt: 'Pengangguran (TPT)',
    kepadatan_penduduk: 'Kepadatan'
  };

  Object.entries(loadings).forEach(([key, vec]) => {
    const vx = x(0) + vec[0] * vectorScale;
    const vy = y(0) - vec[1] * vectorScale;

    vectorGroup.append('line')
      .attr('x1', x(0))
      .attr('y1', y(0))
      .attr('x2', vx)
      .attr('y2', vy)
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.8)
      .attr('marker-end', 'url(#arrow-gold)');

    vectorGroup.append('text')
      .attr('x', vx + (vec[0] > 0 ? 6 : -6))
      .attr('y', vy + (vec[1] > 0 ? -6 : 12))
      .attr('text-anchor', vec[0] > 0 ? 'start' : 'end')
      .attr('class', 'text-[10px] font-bold fill-amber-300 font-sans')
      .text(variableLabels[key] || key);
  });

  // Points (Provinces)
  const dots = svg.append('g')
    .attr('class', 'pca-dots')
    .selectAll('g')
    .data(points)
    .join('g')
    .attr('class', 'cursor-pointer')
    .attr('transform', d => `translate(${x(d.pc1)},${y(d.pc2)})`);

  dots.append('circle')
    .attr('r', d => d.code === '31' ? 9 : 6)
    .attr('fill', d => {
      if (d.code === '31') return '#f43f5e'; // DKI Jakarta
      if (['32', '36'].includes(d.code)) return '#38bdf8'; // Jabar & Banten (Cyan)
      if (d.cluster === 1) return '#fbbf24'; // Cluster 1 (Gold)
      return '#7c3aed'; // Cluster 2 (ungu tua, aman buta warna terhadap biru Jabar/Banten)
    })
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.5)
    .attr('class', 'transition-transform duration-200');

  // Province labels
  dots.append('text')
    .attr('x', d => d.pc1 > 0 ? 9 : -9)
    .attr('y', 3.5)
    .attr('text-anchor', d => d.pc1 > 0 ? 'start' : 'end')
    .attr('class', 'text-[11px] font-bold font-sans')
    .attr('fill', d => d.code === '31' ? '#f43f5e' : '#f1e5ed')
    .text(d => {
      if (['31', '32', '36', '33', '34', '94'].includes(d.code)) return d.name;
      return '';
    });

  // Interactions (Brushing & Linking)
  dots.on('mouseover', (event, d) => {
    state.setHoveredProvince(d.code);
    showTooltip(`
      <div class="font-serif font-bold ${d.code === '31' ? 'text-rose-400' : 'text-amber-400'} text-sm mb-1">${d.name}</div>
      <div class="text-xs text-[#c9a0b5]">Klaster: <strong class="text-white">Klaster ${d.cluster}</strong></div>
      <div class="text-xs text-[#c9a0b5]">PC1: <span class="font-bold text-sky-300">${d.pc1.toFixed(2)}</span> | PC2: <span class="font-bold text-amber-300">${d.pc2.toFixed(2)}</span></div>
      <div class="mt-2 text-xs border-t border-[#5a1b38] pt-1 space-y-1">
        <div>Kepadatan: <span class="text-white font-bold">${d.raw.kepadatan_penduduk.toLocaleString('id-ID')} jiwa/km²</span></div>
        <div>Pengeluaran: <span class="text-white font-bold">Rp ${(d.raw.pengeluaran_per_kapita / 1000).toLocaleString('id-ID')} rb</span></div>
        <div>Tingkat Pengangguran: <span class="text-white font-bold">${d.raw.tpt}%</span></div>
        <div>Rate Migrasi Keluar: <span class="text-rose-400 font-bold">${d.migration.rate_keluar_per1000.toFixed(1)} per 1000</span></div>
      </div>
    `, event);
  })
  .on('mousemove', moveTooltip)
  .on('mouseout', () => {
    state.setHoveredProvince(null);
    hideTooltip();
  })
  .on('click', (event, d) => {
    state.setSelectedProvince(d.code);
  });

  function updateHighlight(activeCode) {
    dots.selectAll('circle')
      .attr('stroke', d => d.code === activeCode ? '#0284c7' : '#ffffff')
      .attr('stroke-width', d => d.code === activeCode ? 3 : 1.5)
      .attr('r', d => d.code === activeCode ? 10 : (d.code === '31' ? 8.5 : 6))
      .attr('opacity', d => (!activeCode || d.code === activeCode || d.code === '31') ? 1 : 0.35);

    dots.selectAll('text')
      .attr('opacity', d => (!activeCode || d.code === activeCode || ['31', '32', '36'].includes(d.code)) ? 1 : 0.25);
  }

  const unsubHover = state.on('province:hover', (code) => {
    updateHighlight(code || state.selectedProvince);
  });

  const unsubSelect = state.on('province:select', (code) => {
    updateHighlight(code);
  });

  updateHighlight(state.selectedProvince);

  return () => {
    unsubHover();
    unsubSelect();
  };
}