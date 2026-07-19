import { createItemSegmentView } from './item-segment-view.js';
export function createDatabaseView(options = {}) { return createItemSegmentView({ ...options, id: 'database', title: 'Actividades', view: 'database', allowStatus: true, defaultLimit: 60 }); }
