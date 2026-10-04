import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderAdjacencyMatrix(containerId, networkData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const threshold = state.networkThreshold;
  const nodes = [...networkData.nodes].sort((a, b) => b.weighted_strength - a.weighted_strength);
  const margin = { top: 96, right: 16, bottom: 36, left: 118 };
  const width = (container.clientWidth || 650) - margin.left - margin.right;
  const height = (container.clientHeight || 550) - margin.top - margin.bottom;

  const edgeMap = new Map();
  networkData.links.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (l.value >= threshold) edgeMap.set(`${s}->${t}`, l.value);
  });

  const x = d3.scaleBand().domain(nodes.map(d => d.id)).range([0, width]).padding(0.08);
  const y = d3.scaleBand().domain(nodes.map(d => d.id)).range([0, height]).padding(0.08);

  const maxVal = d3.max(networkData.links, d => d.value) || 300000;
  const colorScale = d3.scaleSequentialLog(d3.interpolateMagma)
    .domain([Math.max(threshold, 100), maxVal]);

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr('class', 'w-full h-full max-h-[580px]')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const shortName = (id, max) => {
    const n = nodes.find(d => d.id === id);
    return n ? (n.name.length > max ? n.name.slice(0, max - 1) + '…' : n.name) : id;
  };
  const labelColor = id => id === '31' ? '#f43f5e' : (['32', '36'].includes(id) ? '#38bdf8' : '#c9a0b5');

  svg.append('g')
    .attr('class', 'x-axis text-[9px] font-sans')
    .call(d3.axisTop(x).tickFormat(id => shortName(id, 9)).tickSize(0))
    .call(g => g.select('.domain').remove())
    .selectAll('text')
    .attr('transform', 'rotate(-55)')
    .style('text-anchor', 'start')
    .attr('dx', '0.4em').attr('dy', '-0.1em')
    .attr('fill', labelColor)
    .attr('font-weight', id => id === '31' ? '800' : '600');

  svg.append('g')
    .attr('class', 'y-axis text-[9px] font-sans')
    .call(d3.axisLeft(y).tickFormat(id => shortName(id, 14)).tickSize(0))
    .call(g => g.select('.domain').remove())
    .selectAll('text')
    .attr('fill', labelColor)
    .attr('font-weight', id => id === '31' ? '800' : '600');

  svg.append('text')
    .attr('x', width / 2).attr('y', -82).attr('text-anchor', 'middle')
    .attr('class', 'text-[11px] uppercase tracking-wider font-bold fill-amber-400 font-sans')
    .text('Tujuan (target) →');
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -104).attr('text-anchor', 'middle')
    .attr('class', 'text-[11px] uppercase tracking-wider font-bold fill-amber-400 font-sans')
    .text('Asal (source) →');

  svg.append('text')
    .attr('x', width / 2).attr('y', height + 26).attr('text-anchor', 'middle')
    .attr('class', 'text-[10px] fill-[#c9a0b5] font-sans')
    .text(`Urut menurut weighted strength · sel terisi = edge ≥ ${threshold.toLocaleString('id-ID')} jiwa`);

  const cells = [];
  nodes.forEach(src => nodes.forEach(tgt => {
    cells.push({
      source: src,
      target: tgt,
      diag: src.id === tgt.id,
      value: edgeMap.get(`${src.id}->${tgt.id}`) || 0
    });
  }));

  const rects = svg.selectAll('.adj-cell')
    .data(cells)
    .join('rect')
    .attr('class', 'adj-cell')
    .attr('x', d => x(d.target.id))
    .attr('y', d => y(d.source.id))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('rx', 1.5)
    .attr('fill', d => d.diag ? '#200513' : (d.value > 0 ? colorScale(d.value) : '#2d0a1b'))
    .attr('stroke', '#3a0e22')
    .attr('stroke-width', 0.4)
    .attr('cursor', d => d.value > 0 ? 'pointer' : 'default')
    .on('mouseover', (event, d) => {
      if (d.diag) return;
      state.setHoveredProvince(d.source.id);
      showTooltip(`
        <div class="text-[10px] text-[#c9a0b5] uppercase tracking-wider font-bold mb-1">Matriks adjacency</div>
        <div class="text-xs text-[#f1e5ed]">Asal: <strong class="text-amber-400">${d.source.name}</strong></div>
        <div class="text-xs text-[#f1e5ed]">Tujuan: <strong class="text-sky-400">${d.target.name}</strong></div>
        <div class="mt-1.5 text-sm font-bold text-white">${d.value > 0 ? d.value.toLocaleString('id-ID') + ' <span class="text-xs font-normal text-[#c9a0b5]">jiwa</span>' : '<span class="text-xs font-normal text-[#c9a0b5]">tidak ada edge di atas ambang</span>'}</div>
      `, event);
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', () => {
      state.setHoveredProvince(null);
      hideTooltip();
    })
    .on('click', (event, d) => {
      if (d.diag) return;
      if (event.shiftKey) state.toggleProvince(d.source.id);
      else state.setSelectedProvince(d.source.id);
    });

  function applyFocus() {
    const focus = state.focusSet();
    rects.attr('opacity', d => {
      if (d.diag) return 1;
      const hit = focus.size === 0 || focus.has(d.source.id) || focus.has(d.target.id);
      if (d.value === 0) return hit ? 1 : 0.5;
      return hit ? 1 : 0.2;
    });
  }

  applyFocus();
  const unsubSelect = state.on('selection:change', applyFocus);
  const unsubHover = state.on('province:hover', applyFocus);

  return () => {
    unsubSelect();
    unsubHover();
  };
}
