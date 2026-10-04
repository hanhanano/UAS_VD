class AppState {
  constructor() {
    // Seleksi jamak (brushing & linking). Default: fokus DKI Jakarta.
    this.selectedProvinces = new Set(['31']);
    this.hoveredProvince = null;
    this.selectedCluster = null;
    this.flowThreshold = 2500;
    this.networkThreshold = 5000;
    this.networkMode = 'graph'; // 'graph' | 'matrix'
    this.flowOrigin = null; // null = semua provinsi asal
    this.flowDest = null; // null = semua provinsi tujuan
    this.activeStep = 0;
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => {
      const arr = this.listeners.get(event);
      if (arr) {
        const idx = arr.indexOf(callback);
        if (idx !== -1) arr.splice(idx, 1);
      }
    };
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in listener for ${event}:`, err);
        }
      });
    }
  }

  setHoveredProvince(code) {
    if (this.hoveredProvince === code) return;
    this.hoveredProvince = code;
    this.emit('province:hover', code);
  }

  // Kompatibilitas: kode provinsi pertama dalam seleksi (atau null)
  get selectedProvince() {
    const first = this.selectedProvinces.values().next();
    return first.done ? null : first.value;
  }

  // Pilih satu provinsi (null mengosongkan seleksi)
  setSelectedProvince(code) {
    this.setSelectedProvinces(code ? [code] : []);
  }

  // Ganti seluruh seleksi (dipakai oleh brush dan klik)
  setSelectedProvinces(codes) {
    this.selectedProvinces = new Set(codes);
    this.emit('selection:change', this.selectedProvinces);
  }

  // Tambah/hapus satu provinsi dari seleksi (Shift+klik)
  toggleProvince(code) {
    const next = new Set(this.selectedProvinces);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    this.setSelectedProvinces(next);
  }

  // Himpunan fokus efektif: sorotan hover menimpa seleksi sementara
  focusSet() {
    return this.hoveredProvince ? new Set([this.hoveredProvince]) : this.selectedProvinces;
  }

  setFlowOrigin(code) {
    this.flowOrigin = code || null;
    this.emit('flow:filter', { origin: this.flowOrigin, dest: this.flowDest });
  }

  setFlowDest(code) {
    this.flowDest = code || null;
    this.emit('flow:filter', { origin: this.flowOrigin, dest: this.flowDest });
  }

  setNetworkMode(mode) {
    this.networkMode = mode;
    this.emit('network:mode', mode);
  }

  setCluster(clusterId) {
    this.selectedCluster = clusterId;
    this.emit('cluster:select', clusterId);
  }

  setFlowThreshold(val) {
    this.flowThreshold = val;
    this.emit('flow:threshold', val);
  }

  setNetworkThreshold(val) {
    this.networkThreshold = val;
    this.emit('network:threshold', val);
  }

  setActiveStep(stepIndex) {
    this.activeStep = stepIndex;
    this.emit('step:change', stepIndex);
  }
}

export const state = new AppState();
