import { createItemSegmentView } from './item-segment-view.js';
export function createBacklogView(options = {}) { return createItemSegmentView({ ...options, id: 'backlog', title: 'Backlog', view: 'backlog', groupByDate: true, defaultLimit: 24 }); }
