import { createItemSegmentView } from './item-segment-view.js';
export function createOnDeckView(options = {}) { return createItemSegmentView({ ...options, id: 'on-deck', title: 'On Deck', view: 'on-deck', defaultLimit: 24 }); }
