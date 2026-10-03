let tooltipEl = null;

export function initTooltip() {
  if (!tooltipEl) {
    tooltipEl = document.getElementById('d3-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'd3-tooltip';
      tooltipEl.style.display = 'none';
      document.body.appendChild(tooltipEl);
    }
  }
}

export function showTooltip(html, event) {
  initTooltip();
  tooltipEl.innerHTML = html;
  tooltipEl.style.display = 'block';
  tooltipEl.style.opacity = '1';
  positionTooltip(event);
}

export function moveTooltip(event) {
  if (tooltipEl && tooltipEl.style.display !== 'none') {
    positionTooltip(event);
  }
}

export function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.style.opacity = '0';
    tooltipEl.style.display = 'none';
  }
}

function positionTooltip(e) {
  if (!tooltipEl) return;
  const padding = 15;
  const tooltipWidth = tooltipEl.offsetWidth;
  const tooltipHeight = tooltipEl.offsetHeight;
  
  let left = e.clientX + padding;
  let top = e.clientY + padding;

  // Prevent overflowing window right
  if (left + tooltipWidth > window.innerWidth - 20) {
    left = e.clientX - tooltipWidth - padding;
  }

  // Prevent overflowing window bottom
  if (top + tooltipHeight > window.innerHeight - 20) {
    top = e.clientY - tooltipHeight - padding;
  }

  tooltipEl.style.left = `${Math.max(10, left)}px`;
  tooltipEl.style.top = `${Math.max(10, top)}px`;
}
