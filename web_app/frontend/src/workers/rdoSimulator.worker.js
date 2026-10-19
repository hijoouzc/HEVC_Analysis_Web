import { runHevcQuadtreeSimulation } from '../utils/hevcRdoSimulator.js';

self.onmessage = function (e) {
  const { id, params } = e.data || {};
  try {
    const result = runHevcQuadtreeSimulation(params);
    self.postMessage({ id, status: 'success', result });
  } catch (error) {
    self.postMessage({ id, status: 'error', error: error?.message || String(error) });
  }
};
