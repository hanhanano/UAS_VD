import * as d3 from 'd3';
import { showTooltip, moveTooltip, hideTooltip } from '../../utils/tooltip.js';
import { state } from '../../state.js';

export function renderNetworkGraph(containerId, networkData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 650;
  const height = container.clientHeight || 550;

  const minThreshold = state.networkThreshold || 5000;
  const filteredLinks = networkData.links
    .filter(l => l.value >= minThreshold)
    .map(d => ({ ...d }));

  const nodes = networkData.nodes.map(d => ({ ...d }));

  function getNodeColor(nodeId) {
    if (nodeId === '31') return '#f43f5e'; // DKI Jakarta (Bright Rose)
    if (['32', '36'].includes(nodeId)) return '#38bdf8'; // Jabar, Banten (Cyan)
    if (['33', '35', '34'].includes(nodeId)) return '#fbbf24'; // Java other (Radiant Gold)
    return '#a855f7'; // Outer islands (Purple)
  }

  const maxStrength = d3.max(nodes, d => d.weighted_strength) || 1000000;
  const radiusScale = d3.scaleSqrt()
    .domain([0, maxStrength])
    .range([5, 23]);

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', [0, 0, width, height])
    .attr('class', 'w-full h-full max-h-[580px]')
    .call(d3.zoom().scaleExtent([0.4, 4]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));

  const g = svg.append('g');

  // Simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(filteredLinks).id(d => d.id).distance(d => Math.max(50, 160 - d.value / 15000)))
    .force('charge', d3.forceManyBody().strength(-280))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(d => radiusScale(d.weighted_strength) + 6));

  // Edges
  const link = g.append('g')
    .attr('class', 'network-links')
    .selectAll('line')
    .data(filteredLinks)
    .join('line')
    .attr('stroke', '#521836')
    .attr('stroke-opacity', 0.65)
    .attr('stroke-width', d => Math.max(0.8, Math.min(6, d.value / 25000)));

  // Nodes
  const node = g.append('g')
    .attr('class', 'network-nodes')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'cursor-pointer')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  node.append('circle')
    .attr('r', d => radiusScale(d.weighted_strength))
    .attr('fill', d => getNodeColor(d.id))
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.8)
    .attr('class', 'transition-transform duration-200 hover:scale-110 shadow-md');

  // Labels
  node.append('text')
    .attr('x', d => radiusScale(d.weighted_strength) + 5)
    .attr('y', 4)
    .attr('class', 'text-[10.5px] font-bold font-sans fill-white pointer-events-none')
    .attr('stroke', '#3a0e22')
    .attr('stroke-width', 2.5)
    .attr('paint-order', 'stroke')
    .text(d => d.weighted_strength > 100000 || ['31', '32', '36'].includes(d.id) ? d.name : '');

  // Hover interactions
  node.on('mouseover', (event, d) => {
    state.setHoveredProvince(d.id);
    showTooltip(`
      <div class="font-serif font-bold ${d.id === '31' ? 'text-rose-400' : 'text-amber-400'} text-sm mb-1">${d.name}</div>
      <div class="space-y-1 text-xs">
        <div class="flex justify-between gap-4">
          <span class="text-[#c9a0b5]">Total Arus (Strength):</span>
          <span class="font-bold text-white">${d.weighted_strength.toLocaleString()} jiwa</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-[#c9a0b5]">Migran Keluar:</span>
          <span class="text-rose-400 font-bold">${d.strength_keluar.toLocaleString()}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-[#c9a0b5]">Migran Masuk:</span>
          <span class="text-sky-400 font-bold">${d.strength_masuk.toLocaleString()}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-[#c9a0b5]">Betweenness:</span>
          <span class="font-bold text-amber-400">${d.betweenness.toFixed(3)}</span>
        </div>
      </div>
      <div class="text-[10px] text-[#a57b92] mt-2 font-medium">Dapat di-drag atau di-zoom</div>
    `, event);

    const neighbors = new Set();
    neighbors.add(d.id);
    filteredLinks.forEach(l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      if (sId === d.id) neighbors.add(tId);
      if (tId === d.id) neighbors.add(sId);
    });

    node.attr('opacity', n => neighbors.has(n.id) ? 1 : 0.2);
    link.attr('stroke', l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      return (sId === d.id || tId === d.id) ? '#fbbf24' : '#3a0e22';
    })
    .attr('stroke-opacity', l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      return (sId === d.id || tId === d.id) ? 1 : 0.08;
    });
  })
  .on('mousemove', moveTooltip)
  .on('mouseout', () => {
    state.setHoveredProvince(null);
    hideTooltip();
    node.attr('opacity', 1);
    link.attr('stroke', '#521836').attr('stroke-opacity', 0.65);
  })
  .on('click', (event, d) => {
    state.setSelectedProvince(d.id);
  });

  // Simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('transform', d => `translate(${d.x},${d.y})`);
  });

  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  return () => {
    simulation.stop();
  };
}
