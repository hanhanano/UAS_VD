import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderJakartaRanking(containerId, jakartaData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const margin = { top: 35, right: 30, bottom: 20, left: 130 };
  const width = (container.clientWidth || 600) - margin.left - margin.right;
  const height = (container.clientHeight || 520) - margin.top - margin.bottom;

  const topOutgoing = jakartaData.outgoing.slice(0, 10);
  const totalOutgoing = d3.sum(jakartaData.outgoing, d => d.value);
  const fmtID = v => v.toLocaleString('id-ID');
  const pctID = v => ((v / totalOutgoing) * 100).toFixed(1).replace('.', ',');
  const topIncoming = jakartaData.incoming.slice(0, 10);

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr('class', 'w-full h-full max-h-[550px]')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const y = d3.scaleBand()
    .domain(topOutgoing.map(d => d.name))
    .range([0, height])
    .padding(0.28);

  const xMax = d3.max(topOutgoing, d => d.value) * 1.1;
  const x = d3.scaleLinear()
    .domain([0, xMax])
    .range([0, width]);

  // X Axis Grid
  svg.append('g')
    .attr('class', 'grid')
    .call(d3.axisBottom(x).ticks(5).tickSize(height).tickFormat(''))
    .selectAll('line')
    .attr('stroke', '#521836')
    .attr('stroke-dasharray', '2,2');

  const rankColor = d3.scaleSequential(d3.interpolateLab('#fbbf24', '#be185d'))
    .domain([0, topOutgoing.length - 1]);

  // Bars for Outgoing
  const bars = svg.selectAll('.bar-out')
    .data(topOutgoing)
    .join('g')
    .attr('class', 'bar-group cursor-pointer')
    .on('mouseover', (event, d) => {
      const incomingMatch = topIncoming.find(i => i.code === d.code);
      const inVal = incomingMatch ? incomingMatch.value : 0;
      const netVal = inVal - d.value;
      showTooltip(`
        <div class="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-1">Arus dari DKI Jakarta</div>
        <div class="text-sm font-serif font-bold text-white">${d.name}</div>
        <div class="mt-2 space-y-1 text-xs">
          <div class="flex justify-between gap-4">
            <span class="text-[#c9a0b5]">Migran Keluar DKI:</span>
            <span class="font-bold text-amber-400">${fmtID(d.value)} jiwa</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-[#c9a0b5]">Migran Masuk DKI:</span>
            <span class="font-bold text-sky-400">${fmtID(inVal)} jiwa</span>
          </div>
          <div class="flex justify-between gap-4 border-t border-[#5a1b38] pt-1 mt-1">
            <span class="text-[#f1e5ed] font-bold">Net Migrasi DKI:</span>
            <span class="font-bold ${netVal < 0 ? 'text-rose-400' : 'text-emerald-400'}">${fmtID(netVal)} jiwa</span>
          </div>
        </div>
      `, event);
      state.setHoveredProvince(d.code);
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', () => {
      hideTooltip();
      state.setHoveredProvince(null);
    })
    .on('click', (event, d) => {
      state.setSelectedProvince(d.code);
    });

  // Background track
  bars.append('rect')
    .attr('y', d => y(d.name))
    .attr('height', y.bandwidth())
    .attr('x', 0)
    .attr('width', width)
    .attr('fill', '#380e22')
    .attr('rx', 4);

  // Filled bar
  bars.append('rect')
    .attr('class', 'bar-fill transition-all duration-300')
    .attr('y', d => y(d.name))
    .attr('height', y.bandwidth())
    .attr('x', 0)
    .attr('width', d => x(d.value))
    .attr('rx', 4)
    .attr('fill', d => rankColor(topOutgoing.indexOf(d)));

  const isLongBar = d => x(d.value) > width * 0.6;
  bars.append('text')
    .attr('x', d => isLongBar(d) ? x(d.value) - 10 : x(d.value) + 8)
    .attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => isLongBar(d) ? 'end' : 'start')
    .attr('class', 'text-xs font-bold font-sans')
    .style('fill', d => isLongBar(d) ? '#3a0e22' : '#ffffff')
    .text(d => `${fmtID(d.value)} jiwa (${pctID(d.value)}%)`);

  // Y Axis (Province names)
  svg.append('g')
    .attr('class', 'y-axis text-xs font-semibold font-sans')
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll('text')
    .attr('dx', '-0.5em')
    .attr('fill', '#f1e5ed')
    .attr('font-weight', '600');

  // Title / Subtitle
  svg.append('text')
    .attr('x', 0)
    .attr('y', -15)
    .attr('class', 'text-xs uppercase font-extrabold tracking-wider fill-amber-400 font-sans')
    .text(`Top 10 Destinasi Migran Keluar dari DKI Jakarta (Total: ${fmtID(totalOutgoing)} Jiwa)`);
}