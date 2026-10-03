class AppState {
  constructor() {
    this.selectedProvince = '31'; // Default focus: DKI Jakarta
    this.hoveredProvince = null;
    this.selectedCluster = null;
    this.flowThreshold = 2500;
    this.networkThreshold = 5000;
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

  setSelectedProvince(code) {
    this.selectedProvince = code;
    this.emit('province:select', code);
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
