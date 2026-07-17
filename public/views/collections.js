import { createItemSegmentView } from './item-segment-view.js';
export function createCollectionsView(options = {}) { return createItemSegmentView({ ...options, id: 'collections', title: 'Colecciones', view: 'collections', defaultSort: 'completedAt', defaultLimit: 24 }); }
