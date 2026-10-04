import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderChord(containerId, flowData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 550;
  const outerRadius = Math.min(width, height) * 0.5 - 70;
  const innerRadius = outerRadius - 20;

  const nodes = flowData.nodes;
  const nodeIndexMap = new Map(nodes.map((n, i) => [n.id, i]));
  const n = nodes.length;

  // Build 34x34 matrix
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  flowData.links.forEach(link => {
    const s = nodeIndexMap.get(link.source);
    const t = nodeIndexMap.get(link.target);
    if (s !== undefined && t !== undefined && s !== t) {
      const passOrigin = !state.flowOrigin || link.source === state.flowOrigin;
      const passDest = !state.flowDest || link.target === state.flowDest;
      if (link.value >= state.flowThreshold && passOrigin && passDest) {
        matrix[s][t] = link.value;
      }
    }
  });

  const chord = d3.chordDirected()
    .padAngle(0.04)
    .sortSubgroups(d3.descending);

  const chords = chord(matrix);

  const arc = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  const ribbon = d3.ribbonArrow()
    .radius(innerRadius - 1)
    .padAngle(1 / innerRadius);

  // Soft, rich, radiant colors for dark aubergine palette
  function getNodeColor(nodeId) {
    if (nodeId === '31') return '#f43f5e'; 
    if (nodeId === '32') return '#38bdf8'; 
    if (nodeId === '36') return '#e5e7eb'; 
    if (nodeId === '33') return '#fbbf24'; 
    if (nodeId === '35') return '#7c3aed'; 
    return '#64748b'; // Soft slate for others
  }

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', [-width / 2, -height / 2, width, height])
    .attr('class', 'w-full h-full max-h-[580px] overflow-visible');

  // Groups for chords and arcs
  const group = svg.append('g')
    .attr('class', 'arcs')
    .selectAll('g')
    .data(chords.groups)
    .join('g');

  group.append('path')
    .attr('fill', d => getNodeColor(nodes[d.index].id))
    .attr('d', arc)
    .attr('cursor', 'pointer')
    .attr('class', 'transition-all duration-300 hover:brightness-125')
    .on('mouseover', (event, d) => {
      const node = nodes[d.index];
      state.setHoveredProvince(node.id);
      showTooltip(`
        <div class="font-bold text-amber-400 text-sm mb-1">${node.name}</div>
        <div class="text-xs text-[#f1e5ed]">Total Arus Terhubung: <span class="font-bold text-white">${d.value.toLocaleString('id-ID')} jiwa</span></div>
        <div class="text-[11px] text-[#c9a0b5] mt-1">Klik untuk mengunci fokus provinsi</div>
      `, event);
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', () => {
      state.setHoveredProvince(null);
      hideTooltip();
    })
    .on('click', (event, d) => {
      state.setSelectedProvince(nodes[d.index].id);
    });

  // Labels
  group.append('text')
    .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
    .attr('dy', '0.35em')
    .attr('transform', d => `
      rotate(${(d.angle * 180 / Math.PI - 90)})
      translate(${outerRadius + 8})
      ${d.angle > Math.PI ? 'rotate(180)' : ''}
    `)
    .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
    .text(d => {
      const name = nodes[d.index].name;
      if (['31', '32', '33', '35', '36', '12', '14', '73'].includes(nodes[d.index].id) || d.value > 80000) {
        return name;
      }
      return '';
    })
    .attr('font-size', '10.5px')
    .attr('font-family', 'Montserrat, sans-serif')
    .attr('font-weight', d => nodes[d.index].id === '31' ? '800' : '600')
    .attr('fill', d => nodes[d.index].id === '31' ? '#f43f5e' : (['32', '33', '36'].includes(nodes[d.index].id) ? '#fbbf24' : '#f1e5ed'));

  // Ribbons (Chord links)
  const ribbons = svg.append('g')
    .attr('fill-opacity', 0.5)
    .selectAll('path')
    .data(chords)
    .join('path')
    .attr('class', 'chord-path')
    .attr('d', ribbon)
    .attr('fill', d => getNodeColor(nodes[d.source.index].id))
    .attr('stroke', d => d3.rgb(getNodeColor(nodes[d.source.index].id)).darker(0.3))
    .attr('stroke-width', 0.5)
    .attr('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      const src = nodes[d.source.index].name;
      const tgt = nodes[d.target.index].name;
      const val = d.source.value;
      showTooltip(`
        <div class="text-[11px] uppercase tracking-wider text-[#c9a0b5] font-bold mb-1">Arus Migrasi Risen (2020)</div>
        <div class="flex items-center gap-2 text-sm font-bold">
          <span class="text-rose-400">${src}</span>
          <span class="text-white/40">&rarr;</span>
          <span class="text-sky-400">${tgt}</span>
        </div>
        <div class="mt-2 text-base font-bold text-white">${val.toLocaleString('id-ID')} <span class="text-xs font-normal text-[#c9a0b5]">jiwa</span></div>
      `, event);
      d3.select(event.currentTarget).attr('fill-opacity', 0.85);
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', (event) => {
      hideTooltip();
      d3.select(event.currentTarget).attr('fill-opacity', 0.5);
    });

  // Pesan jika kombinasi filter tidak menghasilkan arus
  if (chords.length === 0) {
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('class', 'text-xs font-semibold fill-[#c9a0b5] font-sans')
      .text('Tidak ada arus yang memenuhi filter asal, tujuan, dan ambang volume');
  }

  // Reactive highlight (mendukung seleksi jamak)
  function updateHighlight() {
    const active = state.focusSet();
    if (active.size === 0) {
      ribbons.transition().duration(200)
        .attr('fill-opacity', 0.5)
        .attr('stroke-opacity', 0.5);
      return;
    }
    const activeIdx = new Set([...active].map(id => nodeIndexMap.get(id)));
    const hit = d => activeIdx.has(d.source.index) || activeIdx.has(d.target.index);
    ribbons.transition().duration(200)
      .attr('fill-opacity', d => hit(d) ? 0.85 : 0.06)
      .attr('stroke-opacity', d => hit(d) ? 1 : 0.05);
  }

  const unsubscribeHover = state.on('province:hover', updateHighlight);
  const unsubscribeSelect = state.on('selection:change', updateHighlight);

  updateHighlight();

  return () => {
    unsubscribeHover();
    unsubscribeSelect();
  };
}