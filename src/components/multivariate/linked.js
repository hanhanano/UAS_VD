import { renderPCAPlot } from './pca.js';
import { renderParallelCoords } from './parallelCoords.js';
import { state } from '../../state.js';

// Tampilan terhubung: PCA (dengan brush) dan koordinat paralel dalam satu panel.
// Keduanya berlangganan state.selectedProvinces, jadi memilih beberapa provinsi
// di PCA langsung menebalkan garis provinsi yang sama di koordinat paralel.
export function renderLinkedMultivariate(containerId, multivarData, pcaData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const sideBySide = (container.clientWidth || 700) >= 620;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `display:flex;flex-direction:${sideBySide ? 'row' : 'column'};width:100%;height:100%;min-height:460px;gap:6px;align-items:stretch`;

  const mkPane = (id, flex, title) => {
    const pane = document.createElement('div');
    pane.style.cssText = `flex:${flex};min-width:0;min-height:${sideBySide ? 460 : 300}px;display:flex;flex-direction:column`;
    const cap = document.createElement('div');
    cap.className = 'text-[10px] uppercase tracking-wider font-bold text-[#c9a0b5] px-2 pt-1.5';
    cap.textContent = title;
    const body = document.createElement('div');
    body.id = id;
    body.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center';
    pane.append(cap, body);
    return pane;
  };

  wrapper.append(
    mkPane('linked-pca', sideBySide ? '3 1 0' : '1 1 0', 'PCA'),
    mkPane('linked-parallel', sideBySide ? '2 1 0' : '1 1 0', 'Koordinat paralel')
  );
  container.appendChild(wrapper);

  const cleanups = [
    renderPCAPlot('linked-pca', multivarData, pcaData, { compact: true }),
    renderParallelCoords('linked-parallel', multivarData, { compact: true })
  ];

  return () => cleanups.forEach(fn => { if (typeof fn === 'function') fn(); });
}
