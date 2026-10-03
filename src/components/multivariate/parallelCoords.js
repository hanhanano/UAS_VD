import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderParallelCoords(containerId, multivarData, opts = {}) {
  const compact = Boolean(opts.compact);
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const margin = compact
    ? { top: 44, right: 14, bottom: 24, left: 20 }
    : { top: 40, right: 30, bottom: 30, left: 30 };
  const width = (container.clientWidth || 650) - margin.left - margin.right;
  const height = (container.clientHeight || 520) - margin.top - margin.bottom;

  const points = multivarData.points;
  const dimensions = [
    { key: 'ipm', label: 'IPM' },
    { key: 'uhh', label: 'UHH (Thn)' },
    { key: 'hls', label: 'HLS (Thn)' },
    { key: 'rls', label: 'RLS (Thn)' },
    { key: 'pengeluaran_per_kapita', label: 'Pengeluaran' },
    { key: 'persentase_miskin', label: 'Kemiskinan (%)' },
    { key: 'tpt', label: 'TPT (%)' },
    { key: 'kepadatan_penduduk', label: 'Kepadatan' }
  ];

  const shortLabels = {
    ipm: 'IPM', uhh: 'UHH', hls: 'HLS', rls: 'RLS',
    pengeluaran_per_kapita: 'Peng.', persentase_miskin: 'Miskin', tpt: 'TPT', kepadatan_penduduk: 'Padat'
  };

  const yScales = {};
  dimensions.forEach(dim => {
    const vals = points.map(p => p.z[dim.key]);
    const minVal = Math.min(-3, d3.min(vals));
    const maxVal = Math.max(3.2, d3.max(vals));
    yScales[dim.key] = d3.scaleLinear()
      .domain([minVal, maxVal])
      .range([height, 0]);
  });

  const xScale = d3.scalePoint()
    .range([0, width])
    .padding(compact ? 0.06 : 0.1)
    .domain(dimensions.map(d => d.key));

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr('class', 'w-full h-full max-h-[550px]')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  function path(d) {
    return d3.line()(dimensions.map(dim => [xScale(dim.key), yScales[dim.key](d.z[dim.key])]));
  }

  // Draw lines
  const lines = svg.append('g')
    .attr('class', 'parallel-lines')
    .selectAll('path')
    .data(points)
    .join('path')
    .attr('class', 'transition-opacity duration-200 cursor-pointer')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', d => {
      if (d.code === '31') return '#fbbf24'; // DKI Jakarta (Radiant Gold)
      if (['32', '36'].includes(d.code)) return '#38bdf8'; // Jabar, Banten (Cyan)
      if (d.cluster === 1) return '#f59e0b'; // Amber
      return '#6b2548'; // Muted dark plum
    })
    .attr('stroke-width', d => d.code === '31' ? 4 : 1.4)
    .attr('opacity', d => d.code === '31' ? 1 : 0.5)
    .on('mouseover', (event, d) => {
      state.setHoveredProvince(d.code);
      showTooltip(`
        <div class="font-serif font-bold ${d.code === '31' ? 'text-amber-400' : 'text-sky-400'} text-sm mb-1">${d.name}</div>
        <div class="text-xs text-[#c9a0b5]">Klaster: Klaster ${d.cluster}</div>
        <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[11px] border-t border-[#5a1b38] pt-1 font-semibold text-[#f1e5ed]">
          <div>IPM: <span class="text-white">${d.raw.ipm}</span></div>
          <div>Kemiskinan: <span class="text-white">${d.raw.persentase_miskin}%</span></div>
          <div>Pengeluaran: <span class="text-white">Rp ${(d.raw.pengeluaran_per_kapita / 1000).toFixed(0)}k</span></div>
          <div>TPT: <span class="text-white">${d.raw.tpt}%</span></div>
          <div class="col-span-2">Kepadatan: <span class="text-amber-400 font-bold">${d.raw.kepadatan_penduduk.toLocaleString()} jiwa/km²</span></div>
        </div>
      `, event);
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', () => {
      state.setHoveredProvince(null);
      hideTooltip();
    })
    .on('click', (event, d) => {
      if (event.shiftKey) state.toggleProvince(d.code);
      else state.setSelectedProvince(d.code);
    });

  // Draw axes
  const axes = svg.selectAll('.axis')
    .data(dimensions)
    .join('g')
    .attr('class', 'axis')
    .attr('transform', d => `translate(${xScale(d.key)},0)`);

  axes.each(function(d) {
    d3.select(this).call(d3.axisLeft(yScales[d.key]).ticks(compact ? 3 : 5).tickSize(3));
  });

  axes.selectAll('text')
    .attr('class', compact ? 'text-[8px] fill-[#c9a0b5] font-sans' : 'text-[10px] fill-[#c9a0b5] font-sans');
  axes.selectAll('path, line')
    .attr('stroke', '#6b2548');

  // Axis Title
  axes.append('text')
    .attr('y', -12)
    .attr('text-anchor', 'middle')
    .attr('class', compact ? 'text-[9px] font-bold fill-amber-400 font-sans' : 'text-xs font-bold fill-amber-400 font-sans')
    .text(d => compact ? shortLabels[d.key] : d.label);

  // Baseline 0
  svg.append('line')
    .attr('x1', 0).attr('x2', width)
    .attr('y1', yScales['ipm'](0)).attr('y2', yScales['ipm'](0))
    .attr('stroke', '#6b2548')
    .attr('stroke-dasharray', '2,2')
    .attr('opacity', 0.8);

  function updateHighlight() {
    const focus = state.focusSet();
    const hasFocus = focus.size > 0;
    lines.each(function(d) {
      const isSelected = focus.has(d.code);
      const isDKI = d.code === '31';
      const el = d3.select(this);

      if (isSelected) {
        el.attr('stroke', isDKI ? '#fbbf24' : '#38bdf8')
          .attr('stroke-width', focus.size > 6 ? 2.6 : 4.5)
          .attr('opacity', 1)
          .raise();
      } else {
        el.attr('stroke', isDKI ? '#fbbf24' : (['32', '36'].includes(d.code) ? '#38bdf8' : '#6b2548'))
          .attr('stroke-width', isDKI ? 3.5 : 1.2)
          .attr('opacity', hasFocus ? 0.15 : (isDKI ? 1 : 0.45));
      }
    });
  }

  const unsubHover = state.on('province:hover', updateHighlight);
  const unsubSelect = state.on('selection:change', updateHighlight);

  updateHighlight();

  return () => {
    unsubHover();
    unsubSelect();
  };
}
