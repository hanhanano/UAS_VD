import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderClusteredHeatmap(containerId, multivarData, pcaData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const margin = { top: 60, right: 30, bottom: 20, left: 120 };
  const width = (container.clientWidth || 650) - margin.left - margin.right;
  const height = (container.clientHeight || 550) - margin.top - margin.bottom;

  const points = multivarData.points;
  const order = pcaData.heatmap_order;

  const orderedPoints = [...points].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));

  const variables = [
    { key: 'ipm', label: 'IPM' },
    { key: 'uhh', label: 'UHH' },
    { key: 'hls', label: 'HLS' },
    { key: 'rls', label: 'RLS' },
    { key: 'pengeluaran_per_kapita', label: 'Pengeluaran' },
    { key: 'persentase_miskin', label: 'Kemiskinan' },
    { key: 'tpt', label: 'TPT' },
    { key: 'kepadatan_penduduk', label: 'Kepadatan' }
  ];

  const x = d3.scaleBand()
    .domain(variables.map(d => d.key))
    .range([0, width])
    .padding(0.08);

  const y = d3.scaleBand()
    .domain(orderedPoints.map(d => d.code))
    .range([0, height])
    .padding(0.08);

  // Diverging color scale for z-scores (-2.5 to +2.5)
  // Sequential / Diverging color scale tailored for dark aubergine canvas
  const colorScale = d3.scaleSequential(d3.interpolateMagma)
    .domain([-2.5, 2.5]);

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr('class', 'w-full h-full max-h-[580px]')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // X Axis (Variables)
  svg.append('g')
    .attr('class', 'x-axis text-[10px] font-bold font-sans')
    .call(d3.axisTop(x).tickFormat(k => variables.find(v => v.key === k)?.label || k))
    .selectAll('text')
    .attr('transform', 'rotate(-30)')
    .style('text-anchor', 'start')
    .attr('fill', '#fde047');

  // Y Axis (Province names in Hierarchical Order)
  svg.append('g')
    .attr('class', 'y-axis text-[9.5px] font-sans')
    .call(d3.axisLeft(y).tickFormat(code => {
      const p = orderedPoints.find(d => d.code === code);
      return p ? (p.name.length > 13 ? p.name.slice(0, 12) + '…' : p.name) : code;
    }))
    .selectAll('text')
    .attr('fill', code => code === '31' ? '#f43f5e' : (['32', '36'].includes(code) ? '#38bdf8' : '#c9a0b5'))
    .attr('font-weight', code => code === '31' ? '800' : '600');

  // Cells
  const rows = svg.selectAll('.heatmap-row')
    .data(orderedPoints)
    .join('g')
    .attr('class', 'heatmap-row cursor-pointer')
    .attr('transform', d => `translate(0, ${y(d.code)})`);

  rows.each(function(province) {
    const rowGroup = d3.select(this);
    variables.forEach(v => {
      const zVal = province.z[v.key];
      const rawVal = province.raw[v.key];

      rowGroup.append('rect')
        .attr('class', 'heatmap-cell')
        .attr('x', x(v.key))
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('rx', 2)
        .attr('fill', colorScale(zVal))
        .attr('stroke', '#3a0e22')
        .attr('stroke-width', 0.5)
        .on('mouseover', (event) => {
          state.setHoveredProvince(province.code);
          showTooltip(`
            <div class="font-serif font-bold text-sm ${province.code === '31' ? 'text-rose-400' : 'text-amber-400'} mb-1">${province.name}</div>
            <div class="text-xs text-[#c9a0b5]">Variabel: <strong class="text-white">${v.label}</strong></div>
            <div class="text-xs text-[#c9a0b5]">Z-Score: <span class="font-bold text-sky-400">${zVal.toFixed(2)}</span></div>
            <div class="text-xs text-[#c9a0b5] mt-1">Nilai Asli: <span class="text-white font-bold">${rawVal.toLocaleString()}</span></div>
          `, event);
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', () => {
          state.setHoveredProvince(null);
          hideTooltip();
        })
        .on('click', () => {
          state.setSelectedProvince(province.code);
        });
    });
  });

  function updateHighlight(activeCode) {
    rows.attr('opacity', d => (!activeCode || d.code === activeCode) ? 1 : 0.35);
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
