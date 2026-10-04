import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderODMatrix(containerId, flowData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const nodes = flowData.nodes;
  const n = nodes.length;
  const margin = { top: 90, right: 20, bottom: 20, left: 120 };
  const width = (container.clientWidth || 650) - margin.left - margin.right;
  const height = (container.clientHeight || 550) - margin.top - margin.bottom;

  // Build matrix lookup
  const pairMap = new Map();
  flowData.links.forEach(l => {
    pairMap.set(`${l.source}->${l.target}`, l.value);
  });

  const x = d3.scaleBand()
    .domain(nodes.map(d => d.id))
    .range([0, width])
    .padding(0.08);

  const y = d3.scaleBand()
    .domain(nodes.map(d => d.id))
    .range([0, height])
    .padding(0.08);

  const maxVal = d3.max(flowData.links, d => d.value) || 300000;
  
  // Color scale (Magma / warm gold on dark canvas)
  const colorScale = d3.scaleSequentialLog(d3.interpolateMagma)
    .domain([100, maxVal]);

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr('class', 'w-full h-full max-h-[580px]')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // X Axis (Destination)
  svg.append('g')
    .attr('class', 'x-axis text-[9.5px] font-sans')
    .call(d3.axisTop(x).tickFormat(id => {
      const node = nodes.find(n => n.id === id);
      return node ? (node.name.length > 9 ? node.name.slice(0, 8) + '…' : node.name) : id;
    }))
    .selectAll('text')
    .attr('transform', 'rotate(-55)')
    .style('text-anchor', 'start')
    .attr('dx', '0.5em')
    .attr('dy', '-0.2em')
    .attr('fill', id => id === '31' ? '#f43f5e' : (id === '32' ? '#38bdf8' : '#c9a0b5'))
    .attr('font-weight', id => id === '31' ? '800' : '600');

  // Y Axis (Origin)
  svg.append('g')
    .attr('class', 'y-axis text-[9.5px] font-sans')
    .call(d3.axisLeft(y).tickFormat(id => {
      const node = nodes.find(n => n.id === id);
      return node ? (node.name.length > 13 ? node.name.slice(0, 12) + '…' : node.name) : id;
    }))
    .selectAll('text')
    .attr('fill', id => id === '31' ? '#f43f5e' : (id === '32' ? '#38bdf8' : '#c9a0b5'))
    .attr('font-weight', id => id === '31' ? '800' : '600');

  // Axis Labels
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', -65)
    .attr('text-anchor', 'middle')
    .attr('class', 'text-xs uppercase tracking-wider font-bold fill-amber-400 font-sans')
    .text('Provinsi Tujuan (Destination) →');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -95)
    .attr('text-anchor', 'middle')
    .attr('class', 'text-xs uppercase tracking-wider font-bold fill-amber-400 font-sans')
    .text('Provinsi Asal (Origin) →');

  // Matrix cells
  const cells = [];
  nodes.forEach(src => {
    nodes.forEach(tgt => {
      const isDiag = src.id === tgt.id;
      const val = isDiag ? 0 : (pairMap.get(`${src.id}->${tgt.id}`) || 0);
      cells.push({
        source: src,
        target: tgt,
        value: val,
        isDiagonal: isDiag
      });
    });
  });

  const rects = svg.selectAll('.matrix-cell')
    .data(cells)
    .join('rect')
    .attr('class', 'matrix-cell')
    .style('transition', 'opacity 0.3s ease, fill 0.3s ease')
    .attr('x', d => x(d.target.id))
    .attr('y', d => y(d.source.id))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('rx', 1.5)
    .attr('fill', d => {
      if (d.isDiagonal) return '#200513'; // Diagonal
      if (d.value === 0) return '#2d0a1b';
      return colorScale(d.value);
    })
    .attr('stroke', '#3a0e22')
    .attr('stroke-width', 0.4)
    .attr('cursor', d => d.isDiagonal ? 'default' : 'pointer')
    .on('mouseover', (event, d) => {
      if (d.isDiagonal) {
        showTooltip(`<div class="text-xs text-[#c9a0b5] font-medium">Arus intra-provinsi dikeluarkan dari analisis</div>`, event);
        return;
      }
      state.setHoveredProvince(d.source.id);
      showTooltip(`
        <div class="text-[10px] text-[#c9a0b5] uppercase tracking-wider font-bold mb-1">Matriks Pasangan OD 2020</div>
        <div class="text-xs text-[#f1e5ed]">Asal: <strong class="text-amber-400">${d.source.name}</strong></div>
        <div class="text-xs text-[#f1e5ed]">Tujuan: <strong class="text-sky-400">${d.target.name}</strong></div>
        <div class="mt-1.5 text-sm font-bold text-white">${d.value.toLocaleString()} <span class="text-xs font-normal text-[#c9a0b5]">jiwa</span></div>
        ${d.value < state.flowThreshold ? '<div class="text-[10px] text-rose-400 mt-1">Di bawah filter arus</div>' : ''}
      `, event);

      rects.attr('opacity', c => (c.source.id === d.source.id || c.target.id === d.target.id) ? 1 : 0.2);
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', () => {
      state.setHoveredProvince(null);
      hideTooltip();
      applyThresholdAndHighlight();
    })
    .on('click', (event, d) => {
      if (d.isDiagonal) return;
      if (event.shiftKey) state.toggleProvince(d.source.id);
      else state.setSelectedProvince(d.source.id);
    });

  // Gabungan: ambang volume + filter asal/tujuan + sorotan seleksi
  function applyThresholdAndHighlight() {
    const threshold = state.flowThreshold;
    const focus = state.focusSet();
    const { flowOrigin, flowDest } = state;

    rects.each(function(d) {
      const el = d3.select(this);
      if (d.isDiagonal) {
        el.attr('opacity', 1);
        return;
      }

      const outsideFilter = (flowOrigin && d.source.id !== flowOrigin) || (flowDest && d.target.id !== flowDest);
      const belowThreshold = d.value > 0 && d.value < threshold;
      const isFocused = focus.size === 0 || focus.has(d.source.id) || focus.has(d.target.id);

      let opacity;
      if (outsideFilter) {
        opacity = 0.05;
      } else if (belowThreshold) {
        opacity = isFocused ? 0.15 : 0.08;
      } else {
        opacity = isFocused ? 1 : 0.25;
      }
      el.attr('opacity', opacity);

      if (outsideFilter || belowThreshold) {
        el.attr('fill', '#1a0510');
      } else if (d.value === 0) {
        el.attr('fill', '#2d0a1b');
      } else {
        el.attr('fill', colorScale(d.value));
      }
    });
  }

  // Subscribe to state changes
  const unsubSelect = state.on('selection:change', applyThresholdAndHighlight);
  const unsubHover = state.on('province:hover', applyThresholdAndHighlight);
  const unsubThreshold = state.on('flow:threshold', applyThresholdAndHighlight);
  const unsubFilter = state.on('flow:filter', applyThresholdAndHighlight);

  applyThresholdAndHighlight();

  return () => {
    unsubSelect();
    unsubHover();
    unsubThreshold();
    unsubFilter();
  };
}
