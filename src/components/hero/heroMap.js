import * as d3 from 'd3';

export function renderHeroMap(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  // Container dimensions
  const width = container.clientWidth || 620;
  const height = 450;

  const wrapper = d3.select(container)
    .append('div')
    .attr('class', 'w-full flex flex-col justify-between select-none relative');

  // SVG Canvas
  const svg = wrapper.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('class', 'w-full h-auto overflow-visible');

  // Defs for gradients & glowing filters
  const defs = svg.append('defs');

  // Glow filter
  const filter = defs.append('filter')
    .attr('id', 'hero-glow')
    .attr('x', '-30%')
    .attr('y', '-30%')
    .attr('width', '160%')
    .attr('height', '160%');
  filter.append('feGaussianBlur')
    .attr('stdDeviation', '3')
    .attr('result', 'blur');
  const feMerge = filter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'blur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Bodetabek flow gradient (gold)
  const gradBodetabek = defs.append('linearGradient')
    .attr('id', 'grad-bodetabek')
    .attr('gradientUnits', 'userSpaceOnUse');
  gradBodetabek.append('stop').attr('offset', '0%').attr('stop-color', '#fffbeb').attr('stop-opacity', 0.95);
  gradBodetabek.append('stop').attr('offset', '35%').attr('stop-color', '#fde047').attr('stop-opacity', 0.9);
  gradBodetabek.append('stop').attr('offset', '100%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.85);

  // Java flow gradient (cyan)
  const gradJava = defs.append('linearGradient')
    .attr('id', 'grad-java')
    .attr('gradientUnits', 'userSpaceOnUse');
  gradJava.append('stop').attr('offset', '0%').attr('stop-color', '#e0f2fe').attr('stop-opacity', 0.95);
  gradJava.append('stop').attr('offset', '40%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.85);
  gradJava.append('stop').attr('offset', '100%').attr('stop-color', '#0284c7').attr('stop-opacity', 0.8);

  // Groups
  const mapGroup = svg.append('g').attr('class', 'map-contours');
  const streamGroup = svg.append('g').attr('class', 'flow-streams');
  const citiesGroup = svg.append('g').attr('class', 'city-nodes');
  const calloutGroup = svg.append('g').attr('class', 'callout-annotations');

  // Flow destination data across Pulau Jawa
  const jakartaCoord = [106.827, -6.175];
  const flows = [
    // Bodetabek
    { id: 'depok', name: 'Kota Depok', coords: [106.827, -6.402], val: 158991, cat: 'bodetabek', label: 'Depok' },
    { id: 'bekasi', name: 'Kota Bekasi', coords: [106.992, -6.238], val: 110532, cat: 'bodetabek', label: 'Bekasi' },
    { id: 'bogor', name: 'Bogor', coords: [106.797, -6.597], val: 98093, cat: 'bodetabek', label: 'Bogor' },
    { id: 'tangsel', name: 'Tangerang Selatan', coords: [106.711, -6.288], val: 92429, cat: 'bodetabek', label: 'Tangsel' },
    { id: 'tangerang', name: 'Kota Tangerang', coords: [106.631, -6.178], val: 72950, cat: 'bodetabek', label: 'Tangerang' },

    // Jawa Barat lainnya
    { id: 'bandung', name: 'Bandung', coords: [107.619, -6.917], val: 42000, cat: 'bodetabek', label: 'Bandung' },
    { id: 'cirebon', name: 'Cirebon', coords: [108.557, -6.732], val: 24000, cat: 'bodetabek', label: 'Cirebon' },
    { id: 'sukabumi', name: 'Sukabumi', coords: [106.927, -6.927], val: 18000, cat: 'bodetabek', label: 'Sukabumi' },

    // Jawa Tengah & DIY
    { id: 'tegal', name: 'Tegal', coords: [109.125, -6.869], val: 32000, cat: 'java', label: 'Tegal' },
    { id: 'semarang', name: 'Semarang', coords: [110.420, -6.966], val: 68000, cat: 'java', label: 'Semarang' },
    { id: 'solo', name: 'Surakarta', coords: [110.825, -7.575], val: 45000, cat: 'java', label: 'Solo' },
    { id: 'jogja', name: 'Yogyakarta', coords: [110.369, -7.795], val: 15291, cat: 'java', label: 'Yogyakarta' },
    { id: 'banyumas', name: 'Purwokerto', coords: [109.230, -7.424], val: 28000, cat: 'java', label: '' },

    // Jawa Timur
    { id: 'surabaya', name: 'Surabaya', coords: [112.752, -7.257], val: 31387, cat: 'java', label: 'Surabaya' },
    { id: 'malang', name: 'Malang', coords: [112.632, -7.967], val: 14000, cat: 'java', label: 'Malang' },
    { id: 'banyuwangi', name: 'Banyuwangi', coords: [114.368, -8.219], val: 9500, cat: 'java', label: 'Banyuwangi' }
  ];

  let activeCategory = 'all';

  // Projection for Pulau Jawa
  const projection = d3.geoMercator();
  const pathGenerator = d3.geoPath().projection(projection);

  // Load Java-Only GeoJSON
  d3.json('/data/hero_java_only.json').then(geoData => {
    projection.fitExtent(
      [[8, 8], [width - 8, height - 40]],
      geoData
    );

    // Choropleth: kabupaten/kota across Java
    mapGroup.selectAll('path.district')
      .data(geoData.features)
      .join('path')
      .attr('class', 'district')
      .attr('d', pathGenerator)
      .attr('fill', d => {
        const prov = d.properties.prov;
        const kode = d.properties.kode || '';

        if (prov === 'DKI Jakarta' || kode.startsWith('31')) return '#571333';

        if (['32.01', '32.16', '32.71', '32.75', '32.76', '36.03', '36.71', '36.74'].includes(kode)) {
          return '#421228';
        }
        return '#2e0a1b'; // deep aubergine for Java body
      })
      .attr('stroke', d => {
        const prov = d.properties.prov;
        const kode = d.properties.kode || '';
        if (prov === 'DKI Jakarta' || kode.startsWith('31')) return '#f59e0b';
        if (['32.01', '32.16', '32.71', '32.75', '32.76', '36.03', '36.71', '36.74'].includes(kode)) {
          return '#e5a93c';
        }
        return '#581b37'; // delicate dark plum contour borders
      })
      .attr('stroke-width', d => {
        const prov = d.properties.prov;
        return prov === 'DKI Jakarta' ? 1.5 : 0.65;
      })
      .attr('opacity', 1);

    renderStreams();
    renderCities();
    renderCallout();
  }).catch(err => {
    console.error('Failed loading hero Java geojson:', err);
  });

  function renderStreams() {
    streamGroup.selectAll('*').remove();

    const jktPx = projection(jakartaCoord);
    if (!jktPx) return;

    flows.forEach(f => {
      const destPx = projection(f.coords);
      if (!destPx) return;

      const isVisible = activeCategory === 'all' || activeCategory === f.cat;
      const opacity = isVisible ? (f.cat === 'bodetabek' ? 0.9 : 0.7) : 0.08;

      let strokeColor = f.cat === 'bodetabek' ? 'url(#grad-bodetabek)' : 'url(#grad-java)';

      // Curved arc trajectory
      const dx = destPx[0] - jktPx[0];
      const dy = destPx[1] - jktPx[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      const arcBend = (dx > 0 ? -1 : 1) * Math.min(dist * 0.25, 45);
      const cx = (jktPx[0] + destPx[0]) / 2 - (dy / dist) * arcBend;
      const cy = (jktPx[1] + destPx[1]) / 2 + (dx / dist) * arcBend;

      const pathString = `M ${jktPx[0]} ${jktPx[1]} Q ${cx} ${cy} ${destPx[0]} ${destPx[1]}`;
      const strokeWidth = Math.max(1.8, Math.min(Math.sqrt(f.val) / 38, 7.5));

      // Arc path
      streamGroup.append('path')
        .attr('d', pathString)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth + (isVisible ? 1.5 : 0))
        .attr('stroke-linecap', 'round')
        .attr('opacity', opacity)
        .style('filter', isVisible ? 'url(#hero-glow)' : 'none')
        .attr('class', `stream-arc stream-${f.cat}`);

      // Animated particle
      if (isVisible) {
        const particle = streamGroup.append('circle')
          .attr('r', Math.max(2.2, strokeWidth * 0.48))
          .attr('fill', f.cat === 'bodetabek' ? '#fde047' : '#38bdf8')
          .attr('opacity', 1)
          .style('filter', 'url(#hero-glow)');

        animateParticle(particle, pathString, Math.max(1600, 3200 - f.val / 120));
      }
    });
  }

  function animateParticle(circle, pathStr, duration) {
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', pathStr);
    const totalLength = tempPath.getTotalLength();

    function cycle() {
      circle.transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attrTween('transform', function () {
          return function (t) {
            const p = tempPath.getPointAtLength(t * totalLength);
            return `translate(${p.x}, ${p.y})`;
          };
        })
        .on('end', cycle);
    }
    cycle();
  }

  function renderCities() {
    citiesGroup.selectAll('*').remove();
    const jktPx = projection(jakartaCoord);
    if (!jktPx) return;

    // Pulse ring
    citiesGroup.append('circle')
      .attr('cx', jktPx[0])
      .attr('cy', jktPx[1])
      .attr('r', 11)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.6)
      .style('filter', 'url(#hero-glow)');

    // DKI Jakarta dot
    citiesGroup.append('circle')
      .attr('cx', jktPx[0])
      .attr('cy', jktPx[1])
      .attr('r', 6)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('filter', 'url(#hero-glow)');

    citiesGroup.append('text')
      .attr('x', jktPx[0] - 12)
      .attr('y', jktPx[1] - 14)
      .attr('font-size', '11.5px')
      .attr('font-weight', '800')
      .attr('fill', '#ffffff')
      .attr('stroke', '#3a0e22')
      .attr('stroke-width', 3)
      .attr('paint-order', 'stroke')
      .text('DKI Jakarta');

    // Destination city nodes
    flows.forEach(f => {
      const p = projection(f.coords);
      if (!p || !f.label) return;

      citiesGroup.append('circle')
        .attr('cx', p[0])
        .attr('cy', p[1])
        .attr('r', f.cat === 'bodetabek' ? 3.5 : 2.5)
        .attr('fill', '#ffffff')
        .attr('stroke', '#3a0e22')
        .attr('stroke-width', 1);

      citiesGroup.append('text')
        .attr('x', p[0] + 5)
        .attr('y', p[1] + 3)
        .attr('font-size', '9.5px')
        .attr('font-weight', '600')
        .attr('fill', '#ffffff')
        .attr('stroke', '#3a0e22')
        .attr('stroke-width', 2.5)
        .attr('paint-order', 'stroke')
        .text(f.label);
    });
  }

  function renderCallout() {
    calloutGroup.selectAll('*').remove();
    const jktPx = projection(jakartaCoord);
    const destPx = projection([106.827, -6.402]); // Depok / Bodetabek
    if (!jktPx || !destPx) return;

    let calloutText1 = '443 RIBU ORANG';
    let calloutText2 = 'menuju Jawa Barat & Banten';
    let calloutHighlight = '55,5% dari seluruh migran keluar';

    if (activeCategory === 'java') {
      calloutText1 = '220 RIBU ORANG';
      calloutText2 = 'tercatat berpindah ke Jawa Tengah & Jawa Timur';
      calloutHighlight = '27,6% dari seluruh arus keluar';
    }

    const boxX = Math.min(width - 270, jktPx[0] + 35);
    const boxY = Math.max(15, jktPx[1] - 90);

    // Leader line
    calloutGroup.append('path')
      .attr('d', `M ${boxX} ${boxY + 50} L ${boxX - 20} ${boxY + 55} L ${destPx[0] + 6} ${destPx[1] - 6}`)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.85);

    calloutGroup.append('circle')
      .attr('cx', destPx[0] + 6)
      .attr('cy', destPx[1] - 6)
      .attr('r', 3)
      .attr('fill', '#f59e0b');

    // Callout card
    const gBox = calloutGroup.append('g')
      .attr('transform', `translate(${boxX}, ${boxY})`);

    gBox.append('rect')
      .attr('width', 320)
      .attr('height', 68)
      .attr('rx', 8)
      .attr('fill', 'rgba(43, 9, 25, 0.92)')
      .attr('stroke', '#6b2548')
      .attr('stroke-width', 1)
      .attr('filter', 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))');

    gBox.append('text')
      .attr('x', 12)
      .attr('y', 19)
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('fill', '#ffffff')
      .text(calloutText1);

    gBox.append('text')
      .attr('x', 12)
      .attr('y', 37)
      .attr('font-size', '9.5px')
      .attr('font-weight', '500')
      .attr('fill', '#d8b4c8')
      .text(calloutText2);

    gBox.append('text')
      .attr('x', 12)
      .attr('y', 55)
      .attr('font-size', '9.5px')
      .attr('font-weight', '700')
      .attr('fill', '#fde047')
      .text(calloutHighlight);
  }

  // Bottom filter bar
  const bottomBar = wrapper.append('div')
    .attr('class', 'mt-4 pt-3 border-t border-[#5a1b38] flex flex-wrap items-center justify-between gap-3 text-xs');

  const timeline = bottomBar.append('div')
    .attr('class', 'flex items-center gap-2 select-none text-xs');

  timeline.append('div')
    .attr('class', 'flex items-center gap-1.5')

  const filterPills = bottomBar.append('div')
    .attr('class', 'flex flex-wrap items-center gap-2');

  const categories = [
    { id: 'bodetabek', label: 'Bodetabek (55,5%)', color: 'from-amber-300 to-amber-500' },
    { id: 'java', label: 'Jateng & Jatim (27,6%)', color: 'from-sky-300 to-cyan-500' }
  ];

  categories.forEach(cat => {
    const btn = filterPills.append('button')
      .attr('class', `flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${cat.id === 'all' ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20' : 'bg-[#2d091b] text-[#d8b4c8] hover:text-white border border-[#5a1b38]'}`)
      .attr('data-cat', cat.id);

    btn.append('span')
      .attr('class', `inline-block w-4 h-1 rounded-full bg-gradient-to-r ${cat.color}`);

    btn.append('span')
      .text(cat.label);

    btn.on('click', () => {
      activeCategory = cat.id;
      filterPills.selectAll('button')
        .attr('class', function () {
          const cId = d3.select(this).attr('data-cat');
          return cId === activeCategory
            ? 'flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer'
            : 'flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[#2d091b] text-[#d8b4c8] hover:text-white border border-[#5a1b38] cursor-pointer';
        });

      renderStreams();
      renderCallout();
    });
  });

}
