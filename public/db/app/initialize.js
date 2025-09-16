import { loadItems } from './api.js';
import { initializeEvents } from './events.js';
import { render } from './render.js';
import { enhanceSelects } from './select-enhancer.js';

export const initializeApp = () => {
  enhanceSelects();
  initializeEvents();
  render();
  loadItems({ reset: true });
};
