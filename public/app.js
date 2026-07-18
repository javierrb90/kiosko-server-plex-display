import { SocketClient } from "/core/socket-client.js";
import { ViewManager } from "/core/view-manager.js";
import { createUi } from "/core/ui.js";
import { createBacklogView } from "/views/backlog.js";
import { createCollectionsView } from "/views/collections.js";
import { createOnDeckView } from "/views/on-deck.js";
import { createCurrentContentView } from "/views/current-content.js";
import { createDatabaseView } from "/views/database.js";
import { openItemDetail } from "/core/item-detail.js";

const debug = () => {};
const debugError = (...args) => console.error('[BBQ UI]', ...args);
const settingsTrace = () => {}; // trazas desactivadas en build estable

const appRoot = document.getElementById('app');
const dock = document.getElementById('dock');
const toast = document.getElementById('toast');
const notificationsTrigger = document.getElementById('notifications-trigger');
const notificationsBadge = document.querySelector('[data-notifications-badge]');
const notificationsOverlay = document.getElementById('notifications-overlay');
const notificationsOverlayList = document.querySelector('[data-notifications-overlay-list]');
const notificationsOverlayCount = document.querySelector('[data-notifications-overlay-count]');
const notificationsOverlayFilters = document.querySelector('[data-notifications-overlay-filters]');
const modalRoot = document.getElementById('modal-root');
const settingsTrigger = document.getElementById('settings-trigger');
const viewControls = document.getElementById('view-controls');
const uiToastRoot = document.getElementById('ui-toast-root');
const nowPlayingMini = document.getElementById('now-playing-mini');
const nowPlayingPoster = document.querySelector('[data-now-playing-poster]');
const nowPlayingTitle = document.querySelector('[data-now-playing-title]');
const nowPlayingSubtitle = document.querySelector('[data-now-playing-subtitle]');
const ui = createUi({ modalRoot, toastRoot: uiToastRoot });

const state = {
  settings: null,
  runtime: {},
  activeView: 'database',
  privacyLocked: false,
  unreadCount: 0,
  toastTimer: null,
  latestNotification: null,
  latestToastAction: null,
  latestToastItem: null,
  notificationsOverlayOpen: false,
  overlayNotifications: [],
  notificationSourceFilter: 'all',
  initialViewResolved: false,
  localNavigationAt: 0,
  currentContent: null,
  collectionGroups: [],
  nowPlayingDismissed: false,
  nowPlayingHighlightTimer: null
};


const LOCAL_VIEW_KEY = 'kiosko:active-view';

async function showGrillReviewOnce() {
  try {
    if (sessionStorage.getItem('bbqueue:grill-shown')) return;
    sessionStorage.setItem('bbqueue:grill-shown', '1');
    const result = await api('/api/grill/pending');
    const items = result?.items || []; if (!items.length) return;
    const body = `<div class="grill-review"><p>Parece que algunos items llevan demasiado tiempo sin actividad. Puedes mantenerlos donde están o retirarlos de las listas activas.</p><div class="grill-review__items">${items.map(item => `<article data-grill-id="${escapeAttr(item.canonicalId || item.id)}"><img src="${escapeAttr(item.poster || item.posterUrl || item.cover || '')}" alt=""><div><strong>${escapeHtml(item.title || 'Sin título')}</strong><small>${item.states?.inOnDeck ? 'On Deck' : 'Backlog'}</small></div><button type="button" data-grill-turn>Dar la vuelta</button><button type="button" class="is-danger" data-grill-char>Dejar que se achicharre</button></article>`).join('')}</div></div>`;
    const promise = ui.open({ title: 'Algunos items llevan demasiado tiempo en la parrilla', className: 'ui-modal-root--wide', body, actions: [{ label: 'Revisar más tarde', value: null }] });
    requestAnimationFrame(() => { const root=document.querySelector('.grill-review'); root?.addEventListener('click', async event => { const row=event.target.closest('[data-grill-id]'); if(!row) return; const id=row.dataset.grillId; try { if(event.target.closest('[data-grill-turn]')) { await api(`/api/items/${encodeURIComponent(id)}/grill/turn`, {method:'POST'}); ui.toast('Se le ha dado la vuelta al item'); row.remove(); } else if(event.target.closest('[data-grill-char]')) { await api(`/api/items/${encodeURIComponent(id)}/grill/char`, {method:'POST'}); ui.toast('El item se ha achicharrado'); row.remove(); } } catch(error){ ui.toast(error.message || 'No se pudo actualizar el item'); } }); });
    await promise;
  } catch (error) { console.warn('Grill check failed', error); }
}

const VALID_VIEWS = new Set(['database', 'backlog', 'on-deck', 'current-content', 'collections']);

function routeNameForView(id = 'database') {
  if (id === 'on-deck') return 'deck';
  if (id === 'current-content') return 'current';
  return id;
}
function viewIdForRoute(name = '') {
  if (name === 'deck') return 'on-deck';
  if (name === 'current') return 'current-content';
  return VALID_VIEWS.has(name) ? name : 'database';
}
function parseHashRoute(hash = window.location.hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryPart);
  if (parts[0] === 'item' && parts[1]) return { type: 'item', canonicalId: decodeURIComponent(parts[1]), from: viewIdForRoute(params.get('from') || 'database') };
  return { type: 'view', view: viewIdForRoute(parts[0] || 'database') };
}
function hashForView(id = 'database') { return `#/${routeNameForView(id)}`; }

function readLocalView(fallback = 'backlog') {
  try {
    const value = localStorage.getItem(LOCAL_VIEW_KEY);
    return VALID_VIEWS.has(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalView(id) {
  if (!VALID_VIEWS.has(id)) return;
  try {
    localStorage.setItem(LOCAL_VIEW_KEY, id);
  } catch {}
}


function buildBacklogMap(backlog = {}) {
  const rows = Object.values(backlog || {}).flat().filter(Boolean);
  return Object.fromEntries(rows.filter(item => item?.canonicalId).map(item => [item.canonicalId, { id: item.id, source: item.source }]));
}

const views = new ViewManager(appRoot, { debug });

function api(path, options = {}) {
  const headers = options.body && !(options.body instanceof FormData) && !options.headers?.['Content-Type']
    ? { 'Content-Type': 'application/json', ...(options.headers || {}) }
    : options.headers || {};
  return fetch(path, { ...options, headers }).then(async res => {
    const isJson = String(res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      const error = new Error(data?.error || data || `HTTP ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  });
}

function clamp(value, min, max, fallback) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback; }
function hexToRgb(hex) {
  const value = String(hex || '#05070c').replace('#', '');
  const n = Number.parseInt(value, 16);
  if (!Number.isFinite(n)) return '5, 7, 12';
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
function normalizeHexColor(value, fallback = '#8fafef') {
  const text = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function debounce(fn, delay = 350) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function applyDesign(settings = {}) {
  const design = settings.design || {};
  const bg = design.background || {};
  const itemBg = design.itemBackground || {};
  const cards = design.cards || {};
  const sourceColors = design.sourceColors || {};
  const grillColors = design.grillColors || {};
  const accent = normalizeHexColor(design.accentColor, '#8fafef');
  const overlayColor = normalizeHexColor(bg.overlayColor, '#05070c');
  const opacity = clamp(Number(bg.opacity), 0, 1, 0.28);
  const blur = clamp(Number(bg.blur), 0, 48, 18);
  const fade = clamp(Number(bg.fadeSeconds), 0, 5, 1.2);
  const sectionOverlayOpacity = clamp(Number(bg.overlayOpacity), 0, 1, 0.76);
  const sectionGrayscale = clamp(Number(bg.grayscale), 0, 100, 0);
  const cardBgOpacity = clamp(Number(itemBg.opacity), 0, 1, 0.32);
  const cardBgBlur = clamp(Number(itemBg.blur), 0, 36, 12);
  const cardBgOverlay = clamp(Number(itemBg.overlayOpacity), 0, 1, 0.72);
  const cardRadius = clamp(Number(cards.radius), 0, 32, 18);
  const cardGrayscale = clamp(Number(itemBg.grayscale), 0, 100, 0);

  document.documentElement.style.setProperty('--accent-color', accent);
  document.documentElement.style.setProperty('--section-bg-opacity', String(opacity));
  document.documentElement.style.setProperty('--section-bg-blur', `${blur}px`);
  document.documentElement.style.setProperty('--section-bg-overlay-rgb', hexToRgb(overlayColor));
  document.documentElement.style.setProperty('--section-bg-overlay-opacity', String(sectionOverlayOpacity));
  document.documentElement.style.setProperty('--section-bg-grayscale', `${sectionGrayscale}%`);
  document.documentElement.style.setProperty('--section-bg-fade', `${fade}s`);
  document.documentElement.style.setProperty('--source-plex', normalizeHexColor(sourceColors.plex, '#8fafef'));
  document.documentElement.style.setProperty('--source-playnite', normalizeHexColor(sourceColors.playnite, '#8fe1b5'));
  document.documentElement.style.setProperty('--source-other', normalizeHexColor(sourceColors.other, '#d8b4fe'));
  document.documentElement.style.setProperty('--grill-border-normal', normalizeHexColor(grillColors.normal, '#161a22'));
  document.documentElement.style.setProperty('--grill-border-hot', normalizeHexColor(grillColors.hot, '#f3b61f'));
  document.documentElement.style.setProperty('--grill-border-charred', normalizeHexColor(grillColors.charred, '#ef3340'));
  document.documentElement.style.setProperty('--poster-radius-simple', `${clamp(Number(cards.posterRadiusSimple),0,32,14)}px`);
  document.documentElement.style.setProperty('--poster-radius-standard', `${clamp(Number(cards.posterRadiusStandard),0,32,12)}px`);
  document.documentElement.style.setProperty('--card-bg-opacity', String(cardBgOpacity));
  document.documentElement.style.setProperty('--card-bg-blur', `${cardBgBlur}px`);
  document.documentElement.style.setProperty('--card-bg-overlay-opacity', String(cardBgOverlay));
  document.documentElement.style.setProperty('--card-radius', `${cardRadius}px`);
  document.documentElement.style.setProperty('--card-bg-grayscale', `${cardGrayscale}%`);
  document.documentElement.dataset.itemBackground = itemBg.enabled === false ? 'off' : 'on';
  document.documentElement.dataset.fontScale = ['small','medium','large'].includes(design.fontScale) ? design.fontScale : 'medium';
  document.documentElement.dataset.density = ['compact','comfortable','large'].includes(design.density) ? design.density : 'comfortable';
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', accent);

}

async function loadCustomCssText(name = 'global') {
  const res = await fetch(`/api/custom-css/${encodeURIComponent(name)}?raw=${Date.now()}`);
  if (!res.ok) return '';
  return res.text();
}

async function saveCustomCssText(name = 'global', value = '') {
  await fetch(`/api/custom-css/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'text/css' }, body: value });
}

function refreshCustomCss(name) {
  const links = name ? [...document.querySelectorAll(`[data-custom-css="${name}"]`)] : [...document.querySelectorAll('[data-custom-css]')];
  for (const link of links) {
    const base = link.getAttribute('href').split('?')[0];
    link.setAttribute('href', `${base}?v=${Date.now()}`);
  }
}

function notificationIcon(item = {}) {
  const key = String(item.source || item.type || 'system').toLowerCase();
  if (key.includes('syncthing')) return `<svg viewBox="0 0 24 24"><path d="M12 2 4 6v6c0 5 3.4 9.8 8 10 4.6-.2 8-5 8-10V6l-8-4Zm0 2.2 5.8 2.9v4.9c0 3.9-2.5 7.7-5.8 8.6-3.3-.9-5.8-4.7-5.8-8.6V7.1L12 4.2Zm-2 3.8h4v2h-2v4.6l3 1.7-1 1.7-4-2.3V8Z"/></svg>`;
  if (key.includes('sonarr')) return `<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5V4Zm2 2v3h10V6H7Zm0 5v3h10v-3H7Zm0 5v2h10v-2H7Z"/></svg>`;
  if (key.includes('radarr')) return `<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4V6Zm3 2-1 2h3l1-2H7Zm5 0-1 2h3l1-2h-3Zm5 0-1 2h2v-2h-1ZM7 13v3h10v-3H7Z"/></svg>`;
  if (key.includes('playnite') || key.includes('game')) return `<svg viewBox="0 0 24 24"><path d="M7 9h10a4 4 0 0 1 4 4v2a3 3 0 0 1-3 3h-1.4l-2.4-2.8a3.2 3.2 0 0 0-4.8 0L7 18H6a3 3 0 0 1-3-3v-2a4 4 0 0 1 4-4Zm1.5 4H6v2h2.5v2h2v-2H13v-2h-2.5v-2h-2v2Zm8.5.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm2 3a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"/></svg>`;
  if (key.includes('plex')) return `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z"/></svg>`;
  if (key.includes('grab') || key.includes('download')) return `<svg viewBox="0 0 24 24"><path d="M11 4h2v9l3.5-3.5 1.4 1.4L12 16.8l-5.9-5.9 1.4-1.4L11 13V4ZM5 19h14v2H5v-2Z"/></svg>`;
  return `<svg viewBox="0 0 24 24"><path d="M12 22a2.4 2.4 0 0 0 2.3-1.7H9.7A2.4 2.4 0 0 0 12 22Zm7-5-1.7-2.2V10a5.3 5.3 0 0 0-4-5.1V3a1.3 1.3 0 1 0-2.6 0v1.9a5.3 5.3 0 0 0-4 5.1v4.8L5 17v1.2h14V17Z"/></svg>`;
}
function relativeTime(value) {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} d`;
}

function normalizeNotificationSource(item = {}) {
  const raw = String(item.source || item.type || '').trim().toLowerCase();
  if (!raw) return 'other';
  if (raw.includes('syncthing')) return 'syncthing';
  if (raw.includes('playnite') || raw.includes('game')) return 'playnite';
  if (raw.includes('plex')) return 'plex';
  if (raw.includes('sonarr')) return 'sonarr';
  if (raw.includes('radarr')) return 'radarr';
  if (['system', 'external', 'manual'].includes(raw)) return 'system';
  return raw;
}
function notificationSourceLabel(key) {
  const labels = {
    all: 'Todas',
    plex: 'Plex',
    playnite: 'Playnite',
    syncthing: 'Syncthing',
    sonarr: 'Sonarr',
    radarr: 'Radarr',
    system: 'Sistema',
    other: 'Otros'
  };
  return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
}
function notificationCounts(items = []) {
  return items.reduce((acc, item) => {
    const key = normalizeNotificationSource(item) || 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
function filteredOverlayNotifications() {
  const items = (state.overlayNotifications || []).slice(0, 50);
  if (state.notificationSourceFilter === 'all') return items;
  return items.filter(item => normalizeNotificationSource(item) === state.notificationSourceFilter);
}
function renderNotificationFilters() {
  if (!notificationsOverlayFilters) return;
  const items = (state.overlayNotifications || []).slice(0, 50);
  const counts = notificationCounts(items);
  const preferred = ['plex', 'playnite', 'syncthing', 'sonarr', 'radarr', 'system', 'other'];
  const keys = preferred.filter(key => counts[key]).concat(Object.keys(counts).filter(key => !preferred.includes(key)).sort());
  if (!keys.length) {
    notificationsOverlayFilters.innerHTML = '';
    return;
  }
  const allCount = items.length;
  notificationsOverlayFilters.innerHTML = `<div class="notifications-filter-chips">
    <button type="button" data-notification-filter="all" class="${state.notificationSourceFilter === 'all' ? 'is-active' : ''}">Todas <small>${allCount}</small></button>
    ${keys.map(key => `<button type="button" data-notification-filter="${escapeAttr(key)}" class="${state.notificationSourceFilter === key ? 'is-active' : ''}">${escapeHtml(notificationSourceLabel(key))} <small>${counts[key] || 0}</small></button>`).join('')}
  </div>`;
}
function renderNotificationsOverlay() {
  if (!notificationsOverlayList) return;
  renderNotificationFilters();
  const items = filteredOverlayNotifications();
  const total = (state.overlayNotifications || []).length;
  if (notificationsOverlayCount) {
    const scope = state.notificationSourceFilter === 'all' ? `${items.length} recientes` : `${items.length} de ${notificationSourceLabel(state.notificationSourceFilter)}`;
    notificationsOverlayCount.textContent = total ? scope : 'Sin actividad reciente';
  }
  if (!items.length) {
    const message = state.notificationSourceFilter === 'all' ? 'No hay notificaciones recientes.' : `No hay notificaciones de ${notificationSourceLabel(state.notificationSourceFilter)}.`;
    notificationsOverlayList.innerHTML = `<div class="notifications-panel__empty">${escapeHtml(message)}</div>`;
    return;
  }
  notificationsOverlayList.innerHTML = items.map(item => `<article class="overlay-notification ${item.unread ? 'overlay-notification--unread' : ''}" data-source="${escapeAttr(normalizeNotificationSource(item))}">
    <div class="overlay-notification__icon" aria-hidden="true">${notificationIcon(item)}</div>
    <div class="overlay-notification__copy"><h2>${escapeHtml(item.title || 'Nueva notificación')}</h2><p>${escapeHtml(item.subtitle || item.type || item.source || notificationSourceLabel(normalizeNotificationSource(item)))}</p><time>${escapeHtml(relativeTime(item.createdAt))}</time></div>
  </article>`).join('');
}
async function markNotificationsViewed() {
  const now = new Date().toISOString();
  state.runtime = { ...(state.runtime || {}), lastNotificationsViewedAt: now };
  state.unreadCount = 0;
  state.overlayNotifications = state.overlayNotifications.map(item => ({ ...item, unread: false }));
  renderNotificationsOverlay();
  updateNotificationsTrigger();
  await api('/api/state', { method: 'PUT', body: JSON.stringify({ lastNotificationsViewedAt: now }) }).catch(debugError);
}
async function loadOverlayNotifications() {
  const result = await api('/api/notifications?page=1&limit=50');
  const lastViewed = Date.parse(state.runtime?.lastNotificationsViewedAt || '');
  state.overlayNotifications = (result.items || []).map(item => ({ ...item, unread: Number.isFinite(lastViewed) ? Date.parse(item.createdAt) > lastViewed : true }));
  if (state.notificationSourceFilter !== 'all') {
    const counts = notificationCounts(state.overlayNotifications);
    if (!counts[state.notificationSourceFilter]) state.notificationSourceFilter = 'all';
  }
  renderNotificationsOverlay();
}
async function openNotificationsOverlay({ markViewed = true } = {}) {
  if (state.privacyLocked) return;
  state.notificationsOverlayOpen = true;
  notificationsOverlay.hidden = false;
  notificationsOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('notifications-overlay-open');

  // Show the panel immediately, then do the heavier notification work after paint.
  requestAnimationFrame(() => {
    loadOverlayNotifications()
      .then(() => markViewed ? markNotificationsViewed() : null)
      .catch(debugError);
  });
}
function closeNotificationsOverlay() {
  state.notificationsOverlayOpen = false;
  notificationsOverlay.hidden = true;
  notificationsOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('notifications-overlay-open');
}
function updateNotificationsTrigger() {
  if (!notificationsTrigger) return;
  notificationsTrigger.hidden = Boolean(state.privacyLocked);
  if (!notificationsBadge) return;
  const count = Math.max(0, Number(state.unreadCount || 0));
  notificationsBadge.hidden = count < 1;
  notificationsBadge.textContent = count > 99 ? '99+' : String(count);
  notificationsTrigger.classList.toggle('notifications-trigger--unread', count > 0);
}

function playNotificationSound() {
  const cfg = state.settings?.notifications || {};
  if (!cfg.soundEnabled || state.privacyLocked) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, Number(cfg.soundVolume ?? 0.35)));
    gain.connect(ctx.destination);
    [660, 880].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      const start = ctx.currentTime + index * 0.11;
      osc.start(start);
      osc.stop(start + 0.08);
    });
    setTimeout(() => ctx.close().catch(() => {}), 420);
  } catch (error) { debugError('No se pudo reproducir sonido de notificación', error); }
}
function showActionToast({ title, subtitle = '', action = null, notification = null, item = null, force = false } = {}) {
  // Los toasts de actividad solicitados explícitamente por la API no dependen
  // de la preferencia de toasts del centro de notificaciones.
  if (!force && !state.settings?.notifications?.toastEnabled) return;
  state.latestNotification = notification;
  state.latestToastAction = action;
  if (item) state.latestToastItem = item;
  clearTimeout(state.toastTimer);
  toast.hidden = false;
  toast.classList.remove('event-toast--small', 'event-toast--medium', 'event-toast--large');
  const size = state.settings?.notifications?.toastSize || 'medium';
  toast.classList.add(`event-toast--${['small','medium','large'].includes(size) ? size : 'medium'}`);
  toast.innerHTML = state.privacyLocked ? `<strong>Nueva actividad</strong><span>Actividad recibida</span>` : `<strong>${escapeHtml(title || 'Nueva actividad')}</strong><span>${escapeHtml(subtitle || '')}</span>`;
  toast.classList.add('event-toast--visible');
  playNotificationSound();
  const seconds = Number(state.settings?.notifications?.toastDurationSeconds || 6);
  state.toastTimer = setTimeout(() => toast.classList.remove('event-toast--visible'), seconds * 1000);
}
function showNotificationToast(notification) {
  return showActionToast({ title: notification.title || 'Nueva notificación', subtitle: notification.subtitle || notification.source || '', notification, action: () => openNotificationsOverlay().catch(debugError) });
}
function activityToastLabel(payload = {}) {
  const source = String(payload.source || '').toLowerCase();
  const eventType = String(payload.eventType || '').toLowerCase();
  if (source === 'playnite' && ['started', 'played'].includes(eventType)) return 'Juego iniciado';
  if (source === 'plex' && ['played', 'started'].includes(eventType)) return 'Reproducción iniciada';
  if (source === 'plex' && ['watched', 'completed'].includes(eventType)) return 'Contenido visto';
  if (source === 'plex' && eventType === 'added') return 'Contenido añadido';
  if (eventType === 'watched' || eventType === 'completed') return 'Contenido completado';
  if (eventType === 'added') return 'Contenido añadido';
  return 'Actividad recibida';
}
function itemStatusForToast(item = {}) {
  if (item.states?.completed || item.completedAt || item.status === 'completed') return 'Terminado · Colección';
  const spaces = [];
  if (item.states?.inBacklog) spaces.push('Backlog');
  if (item.states?.inOnDeck) spaces.push('On Deck');
  return spaces.length ? spaces.join(' · ') : (item.detail || item.subtitle || 'Base de datos');
}
function refreshLatestToastItem(item = {}) {
  const latest = state.latestToastItem;
  if (!latest?.canonicalId || latest.canonicalId !== item.canonicalId) return;
  state.latestToastItem = { ...latest, ...item };
  if (!toast.classList.contains('event-toast--visible') || state.privacyLocked) return;
  toast.innerHTML = `<strong>${escapeHtml(state.latestToastItem.title || 'Último item')}</strong><span>${escapeHtml(itemStatusForToast(state.latestToastItem))}</span>`;
  state.latestToastAction = () => openItemFromRoute(state.latestToastItem.canonicalId, views.activeId || 'database').catch(debugError);
}

function showIngestionActivityToast(payload = {}) {
  const detail = [payload.title, payload.detail].filter(Boolean).join(' · ');
  return showActionToast({
    title: payload.title || activityToastLabel(payload),
    subtitle: itemStatusForToast(payload) || detail,
    item: payload,
    action: payload.canonicalId ? () => openItemFromRoute(payload.canonicalId, views.activeId || 'database').catch(debugError) : null,
    force: true
  });
}

function currentPoster(content = {}) {
  return content.cover || content.poster || content.posterUrl || content.coverPath || content.background || content.backdrop || content.backdropUrl || '';
}
function currentSubtitle(content = {}) {
  if (Array.isArray(content.platforms) && content.platforms.length) return content.platforms.join(' · ');
  return content.subtitle || content.year || content.type || '';
}
function updateNowPlayingMini(content = state.currentContent, { highlight = false, forceOpen = false } = {}) {
  state.currentContent = content || null;
  if (!nowPlayingMini) return;
  const shouldShow = Boolean(content) && (!state.nowPlayingDismissed || forceOpen);
  nowPlayingMini.hidden = !shouldShow;
  nowPlayingMini.classList.toggle('now-playing-mini--hidden', !shouldShow);
  if (!content) return;

  const title = content.title || 'Contenido actual';
  const subtitle = currentSubtitle(content);
  const poster = currentPoster(content);
  if (nowPlayingTitle) nowPlayingTitle.textContent = title;
  if (nowPlayingSubtitle) nowPlayingSubtitle.textContent = subtitle || (content.source === 'playnite' || content.kind === 'game' ? 'Jugando ahora' : 'Reproduciendo');
  if (nowPlayingPoster) {
    nowPlayingPoster.innerHTML = poster ? `<img src="${escapeAttr(poster)}" alt="">` : `<span>${escapeHtml(title.slice(0,1) || '▶')}</span>`;
  }

  if (highlight) {
    nowPlayingMini.classList.add('now-playing-mini--highlight');
    clearTimeout(state.nowPlayingHighlightTimer);
    state.nowPlayingHighlightTimer = setTimeout(() => nowPlayingMini.classList.remove('now-playing-mini--highlight'), 4200);
  }
}
async function openCurrentContentFromMini() {
  if (!state.currentContent) return;
  const result = await openItemDetail({
    ui,
    api,
    item: state.currentContent,
    context: 'current',
    toast: message => ui.toast(message),
    labels: { title: '' },
    collectionGroups: state.collectionGroups,
    settings: state.settings
  });
  if (result?.action === 'open-current') navigate('current-content', { reason: 'mini actual' });
}


function groupItemKeysForToast(item = {}) {
  const meta = item.meta || {};
  return [
    item.canonicalId,
    meta.canonicalId,
    item.id,
    item.gameId,
    meta.gameId,
    item.ratingKey,
    meta.ratingKey,
    item.grandparentRatingKey ? `plex:show:${item.grandparentRatingKey}` : null,
    meta.grandparentRatingKey ? `plex:show:${meta.grandparentRatingKey}` : null
  ].filter(Boolean).map(String);
}
function fieldValuesForGroupToast(item = {}, field = '') {
  const meta = item.meta || {};
  const asArray = value => Array.isArray(value) ? value : (value ? [value] : []);
  const platformCandidates = [...asArray(item.platforms), ...asArray(meta.platforms), ...asArray(item.platform), ...asArray(meta.platform), item.subtitle];
  const valueMap = {
    title: [item.title],
    source: [item.source],
    type: [item.collectionType, item.type, meta.plexType],
    year: [item.year, item.releaseYear, meta.releaseYear],
    platform: platformCandidates,
    platforms: platformCandidates,
    genre: [...asArray(item.genres), ...asArray(meta.genres), ...asArray(item.genre), ...asArray(meta.genre)],
    developer: [...asArray(item.developers), ...asArray(meta.developers), ...asArray(item.developer), ...asArray(meta.developer)],
    publisher: [...asArray(item.publishers), ...asArray(meta.publishers), ...asArray(item.publisher), ...asArray(meta.publisher)]
  };
  return (valueMap[field] || [item[field], meta[field]]).flat().filter(Boolean).map(value => String(value).toLowerCase());
}
function groupsForItem(item = {}) {
  const keys = groupItemKeysForToast(item);
  return (state.collectionGroups || []).filter(group => {
    const manualIds = (group.manualItemIds || []).map(String);
    const manualKeys = (group.manualItemKeys || []).map(String);
    if (keys.some(key => manualIds.includes(key) || manualKeys.includes(key))) return true;
    if (group.mode === 'manual') return false;
    const rules = group.rules || [];
    if (!rules.length) return false;
    const checks = rules.map(rule => {
      const values = fieldValuesForGroupToast(item, rule.field);
      const needle = String(rule.value || '').toLowerCase();
      if (!needle) return false;
      return rule.operator === 'equals' ? values.some(value => value === needle) : values.some(value => value.includes(needle));
    });
    return (group.match || 'all') === 'any' ? checks.some(Boolean) : checks.every(Boolean);
  });
}
function toastGroupSuffix(item = {}) {
  const groups = groupsForItem(item);
  return groups.length ? ` · ${groups.map(group => group.name).slice(0, 3).join(' · ')}` : '';
}

function shouldToastCurrent(content = {}) {
  if (!content) return false;
  if (content.source === 'playnite' || content.kind === 'game' || content.event === 'game_started') return true;
  return ['play', 'start', 'playback_start'].includes(String(content.event || '').toLowerCase());
}
function showCurrentToast(content = {}) {
  if (!shouldToastCurrent(content)) return;
  state.nowPlayingDismissed = false;
  updateNowPlayingMini(content, { highlight: true, forceOpen: true });
  const groupSuffix = toastGroupSuffix(content);
  if (groupSuffix) ui.toast(`${content.title || 'Contenido actual'}${groupSuffix}`);
}
/* legacy */

views.register(createDatabaseView({ api, debug, ui, controlsRoot: viewControls }));
views.register(createBacklogView({ api, debug, ui, controlsRoot: viewControls }));
views.register(createOnDeckView({ api, debug, ui, controlsRoot: viewControls }));
views.register(createCurrentContentView({ api, debug, ui, controlsRoot: viewControls }));
views.register(createCollectionsView({ api, debug, ui, controlsRoot: viewControls }));

function navigate(id, { persist = true, reason = 'dock', force = false } = {}) {
  if (!id) return;
  if (state.privacyLocked && !force) return;
  state.activeView = id;
  document.body.dataset.activeView = id;
  if (persist) {
    state.localNavigationAt = Date.now();
  }
  views.show(id, { reason });
  try { if (persist) window.history.replaceState(null, '', hashForView(id)); } catch {}
  document.querySelectorAll('[data-nav]').forEach(btn => { const active = btn.dataset.nav === id; btn.classList.toggle('dock__item--active', active); if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current'); });
  if (persist) api('/api/state', { method: 'PUT', body: JSON.stringify({ activeView: id }) }).catch(debugError);
}

function applyState(payload = {}) {
  debug('Snapshot recibido', payload);
  state.settings = payload.settings || state.settings;
  applyDesign(state.settings);
  state.runtime = payload.state || state.runtime || {};
  state.privacyLocked = Boolean(payload.state?.privacyLocked);
  state.unreadCount = Number(payload.unreadCount || 0);
  updateNotificationsTrigger();
  state.collectionGroups = payload.collectionGroups || [];
  state.backlog = payload.backlog || {};
  state.onDeck = payload.onDeck || [];
  state.completions = payload.completions || [];
  state.completionRatings = payload.completionRatings || {};
  state.onDeckMap = payload.onDeckMap || {};
  views.update('database', { collectionGroups: state.collectionGroups, settings: state.settings });
  views.update('backlog', { backlog: state.backlog, completionRatings: state.completionRatings, onDeckMap: state.onDeckMap, collectionGroups: state.collectionGroups, settings: state.settings });
  views.update('on-deck', { onDeck: state.onDeck, completionRatings: state.completionRatings, collectionGroups: state.collectionGroups, settings: state.settings });
  views.update('current-content', { currentContent: payload.currentContent || null, onDeckMap: state.onDeckMap, backlogMap: buildBacklogMap(state.backlog), completionRatings: state.completionRatings, settings: state.settings });
  updateNowPlayingMini(payload.currentContent || null);
  views.update('collections', { completions: state.completions, collectionGroups: state.collectionGroups, settings: state.settings, refresh: true });
  if (!state.initialViewResolved) {
    state.initialViewResolved = true;
    applyRouteFromHash({ initial: true }).catch(debugError);
  }

  if (state.privacyLocked && views.activeId !== 'backlog') navigate('backlog', { persist: false, reason: 'privacy snapshot', force: true });
}


function normalizeBacklogData(backlog = {}) {
  return {
    plex: Array.isArray(backlog.plex) ? backlog.plex : [],
    playnite: Array.isArray(backlog.playnite) ? backlog.playnite : [],
    kiosko: Array.isArray(backlog.kiosko) ? backlog.kiosko : [],
    manual: Array.isArray(backlog.manual) ? backlog.manual : []
  };
}
function removeFromBacklogState(item = {}) {
  state.backlog = normalizeBacklogData(state.backlog);
  const source = ['plex', 'playnite', 'kiosko', 'manual'].includes(item.source) ? item.source : null;
  const matches = entry => entry?.id === item.id || entry?.canonicalId === item.canonicalId;
  if (source && Array.isArray(state.backlog[source])) state.backlog[source] = state.backlog[source].filter(entry => !matches(entry));
  else {
    for (const key of Object.keys(state.backlog)) state.backlog[key] = (state.backlog[key] || []).filter(entry => !matches(entry));
  }
}
function upsertBacklogState(item = {}) {
  if (!item?.source) return;
  state.backlog = normalizeBacklogData(state.backlog);
  const source = ['plex', 'playnite', 'kiosko', 'manual'].includes(item.source) ? item.source : 'manual';
  state.backlog[source] = [item, ...(state.backlog[source] || []).filter(entry => entry.id !== item.id && entry.canonicalId !== item.canonicalId)];
}
function removeFromDeckState(item = {}) {
  state.onDeck = (state.onDeck || []).filter(entry => entry.id !== item.id && entry.canonicalId !== item.canonicalId);
}
function upsertDeckState(item = {}) {
  if (!item) return;
  state.onDeck = [item, ...(state.onDeck || []).filter(entry => entry.id !== item.id && entry.canonicalId !== item.canonicalId)];
}
function removeFromCompletionsState(item = {}) {
  state.completions = (state.completions || []).filter(entry => entry.id !== item.id && entry.canonicalId !== item.canonicalId);
}
function upsertCompletionState(item = {}) {
  if (!item) return;
  state.completions = [item, ...(state.completions || []).filter(entry => entry.id !== item.id && entry.canonicalId !== item.canonicalId)];
}
function applyCompletionRatings(ratings) {
  if (ratings) state.completionRatings = ratings;
}
function applyOnDeckMap(map) {
  if (map) state.onDeckMap = map;
}
function applyFullStatePayload(payload = {}) {
  if (payload.backlog) state.backlog = payload.backlog;
  if (Array.isArray(payload.onDeck)) state.onDeck = payload.onDeck;
  if (Array.isArray(payload.completions)) state.completions = payload.completions;
  applyCompletionRatings(payload.completionRatings);
  applyOnDeckMap(payload.onDeckMap);
}

function refreshDataViews() {
  views.update('database', { refresh: true, collectionGroups: state.collectionGroups || [], settings: state.settings });
  views.update('backlog', { refresh: true, backlog: state.backlog || {}, completionRatings: state.completionRatings || {}, onDeckMap: state.onDeckMap || {}, collectionGroups: state.collectionGroups || [], settings: state.settings });
  views.update('on-deck', { refresh: true, onDeck: state.onDeck || [], completionRatings: state.completionRatings || {}, collectionGroups: state.collectionGroups || [], settings: state.settings });
  views.update('collections', { refresh: true, completions: state.completions || [], collectionGroups: state.collectionGroups || [], settings: state.settings });
  views.update('current-content', { onDeckMap: state.onDeckMap || {}, backlogMap: buildBacklogMap(state.backlog || {}), completionRatings: state.completionRatings || {} });
}
function applyItemDelta(message = {}) {
  const payload = message.payload || {};
  const changedForToast = payload.item || payload.completed || payload.deckItem || payload.backlogItem || payload.removed || null;
  if (changedForToast) refreshLatestToastItem(changedForToast);
  applyFullStatePayload(payload);
  switch (message.type) {
    case 'item:backlog-upserted':
      upsertBacklogState(payload.item || payload.backlogItem);
      applyCompletionRatings(payload.completionRatings);
      applyOnDeckMap(payload.onDeckMap);
      views.update('database', { refresh: true });
      break;
    case 'item:backlog-removed':
      removeFromBacklogState(payload.item || payload);
      views.update('database', { refresh: true });
      break;
    case 'item:moved-to-deck':
      if (payload.removed) removeFromBacklogState(payload.removed);
      if (payload.replaced) { removeFromDeckState(payload.replaced); upsertBacklogState(payload.replaced); }
      if (Array.isArray(payload.onDeck)) state.onDeck = payload.onDeck;
      if (payload.completionRemoved) removeFromCompletionsState(payload.completionRemoved);
      if (!Array.isArray(payload.onDeck)) upsertDeckState(payload.deckItem);
      applyCompletionRatings(payload.completionRatings);
      applyOnDeckMap(payload.onDeckMap);
      views.update('database', { refresh: true });
      break;
    case 'item:moved-to-backlog':
      if (payload.removed) removeFromDeckState(payload.removed);
      upsertBacklogState(payload.backlogItem);
      applyCompletionRatings(payload.completionRatings);
      applyOnDeckMap(payload.onDeckMap);
      views.update('database', { refresh: true });
      break;
    case 'item:completed':
      if (payload.from === 'backlog' && payload.removed) removeFromBacklogState(payload.removed);
      if (payload.from === 'on-deck' && payload.removed) removeFromDeckState(payload.removed);
      if (payload.from === 'database' && payload.removed) { removeFromBacklogState(payload.removed); removeFromDeckState(payload.removed); }
      if (payload.removed && !payload.from) { removeFromBacklogState(payload.removed); removeFromDeckState(payload.removed); }
      if (Array.isArray(payload.onDeck)) state.onDeck = payload.onDeck;
      upsertCompletionState(payload.completed);
      applyCompletionRatings(payload.completionRatings);
      applyOnDeckMap(payload.onDeckMap);
      views.update('database', { refresh: true });
      break;
    case 'item:deck-removed':
      removeFromDeckState(payload.item || payload);
      applyOnDeckMap(payload.onDeckMap);
      views.update('database', { refresh: true });
      break;
    case 'item:completion-updated':
      upsertCompletionState(payload.completed);
      applyCompletionRatings(payload.completionRatings);
      views.update('database', { refresh: true });
      break;
    case 'item:completion-removed':
      removeFromCompletionsState(payload.item || payload);
      applyCompletionRatings(payload.completionRatings);
      views.update('database', { refresh: true });
      break;
    case 'item:assessment-updated':
    case 'item:journal-updated':
      if (payload.item) {
        views.update('database', { item: payload.item });
        views.update('backlog', { item: payload.item });
        views.update('on-deck', { item: payload.item });
        views.update('collections', { item: payload.item });
      }
      break;
    case 'item:database-updated':
      if (payload.item) {
        views.update('database', { item: payload.item });
        views.update('backlog', { item: payload.item });
        views.update('on-deck', { item: payload.item });
        views.update('collections', { item: payload.item });
      }
      break;
    case 'item:permanently-deleted':
      removeFromBacklogState(payload.item || payload);
      removeFromDeckState(payload.item || payload);
      removeFromCompletionsState(payload.item || payload);
      if (payload.backlog) state.backlog = payload.backlog;
      if (Array.isArray(payload.onDeck)) state.onDeck = payload.onDeck;
      if (Array.isArray(payload.completions)) state.completions = payload.completions;
      applyCompletionRatings(payload.completionRatings);
      applyOnDeckMap(payload.onDeckMap);
      views.update('database', { refresh: true });
      break;
    default:
      return false;
  }
  refreshDataViews();
  return true;
}


async function openItemFromRoute(canonicalId, from = 'database') {
  if (!canonicalId) return;
  navigate(from, { persist: false, reason: 'url item', force: true });
  try { window.history.replaceState(null, '', hashForView(from)); } catch {}
  const item = await api(`/api/items/${encodeURIComponent(canonicalId)}`);
  await openItemDetail({ ui, api, item, context: from, toast: message => ui.toast(message), labels: { title: '' }, collectionGroups: state.collectionGroups, settings: state.settings });
}
async function applyRouteFromHash({ initial = false } = {}) {
  const route = parseHashRoute();
  if (route.type === 'item') {
    await openItemFromRoute(route.canonicalId, route.from);
    return;
  }
  navigate(route.view || 'database', { persist: false, reason: initial ? 'url inicial' : 'url', force: true });
}
window.addEventListener('hashchange', () => applyRouteFromHash().catch(debugError));

const socket = new SocketClient({
  onMessage(message) {
    debug('Mensaje WebSocket recibido', message?.type, message?.payload);
    if (message.type === 'state:snapshot') return; // snapshots are HTTP-only after v5.6.14
    if (applyItemDelta(message)) return;
    if (message.type === 'settings:update') {
      state.settings = message.payload;
      applyDesign(state.settings);
      views.update('database', { settings: state.settings, refresh: true });
      views.update('backlog', { settings: state.settings });
      views.update('on-deck', { settings: state.settings });
      views.update('current-content', { settings: state.settings });
      views.update('collections', { settings: state.settings });
      return;
    }
    if (message.type === 'backlog:update') { state.backlog = message.payload?.backlog || state.backlog || {}; if (message.payload?.completionRatings) state.completionRatings = message.payload.completionRatings; if (message.payload?.onDeckMap) state.onDeckMap = message.payload.onDeckMap; views.update('backlog', { ...(message.payload || {}), collectionGroups: state.collectionGroups, settings: state.settings, refresh: true }); views.update('current-content', { ...(message.payload || {}), backlogMap: buildBacklogMap(state.backlog || {}) }); return; }
    if (message.type === 'on-deck:update') { state.onDeck = message.payload?.onDeck || state.onDeck || []; if (message.payload?.completionRatings) state.completionRatings = message.payload.completionRatings; views.update('on-deck', { ...(message.payload || {}), collectionGroups: state.collectionGroups, settings: state.settings, refresh: true }); views.update('current-content', { ...(message.payload || {}) }); return; }
    if (message.type === 'completions:update') { state.completions = message.payload || []; state.completionRatings = Object.fromEntries((message.payload || []).filter(item => item?.canonicalId).map(item => [item.canonicalId, { rating: item.rating, completedAt: item.completedAt, id: item.id }])); views.update('collections', { completions: state.completions, collectionGroups: state.collectionGroups, settings: state.settings, refresh: true }); views.update('current-content', { completionRatings: state.completionRatings }); return; }
    if (message.type === 'collection-groups:update') { state.collectionGroups = message.payload || []; views.update('database', { collectionGroups: state.collectionGroups, settings: state.settings, refresh: true }); views.update('backlog', { collectionGroups: state.collectionGroups, settings: state.settings, refresh: true }); views.update('on-deck', { collectionGroups: state.collectionGroups, settings: state.settings, refresh: true }); views.update('collections', { collectionGroups: state.collectionGroups, settings: state.settings, refresh: true }); return; }
    if (message.type === 'custom-css:update') { refreshCustomCss(message.payload?.name); return; }
    if (message.type === 'notifications:open') { openNotificationsOverlay().catch(debugError); return; }
    if (message.type === 'privacy:update') {
      state.privacyLocked = Boolean(message.payload?.privacyLocked);
      updateNotificationsTrigger();
      if (state.privacyLocked && views.activeId !== 'backlog') navigate('backlog', { persist: false, reason: 'privacy update', force: true });
      return;
    }
    if (message.type === 'current:update') { if (message.payload) refreshLatestToastItem(message.payload); views.update('current-content', { currentContent: message.payload }); if (message.payload) showCurrentToast(message.payload); else updateNowPlayingMini(null); return; }
    if (message.type === 'plex:update') { const current = { ...(message.payload || {}), source: 'plex', kind: 'plex' }; views.update('current-content', { currentContent: current }); if (message.payload) showCurrentToast(current); return; }
    if (message.type === 'game:update') { const current = { ...(message.payload || {}), source: 'playnite', kind: 'game' }; views.update('current-content', { currentContent: current }); if (message.payload) showCurrentToast(current); return; }
    if (message.type === 'activity:received') {
      const activity = message.payload || {};
      // Un inicio desde Playnite también representa el contenido actual. Así se
      // conserva el comportamiento visual del antiguo webhook sin convertirlo
      // de nuevo en una notificación persistente.
      if (String(activity.source || '').toLowerCase() === 'playnite' && ['started', 'played'].includes(String(activity.eventType || '').toLowerCase())) {
        const current = {
          ...activity,
          source: 'playnite',
          kind: 'game',
          event: 'game_started',
          cover: activity.poster || '',
          background: activity.backdrop || '',
          subtitle: activity.detail || ''
        };
        state.nowPlayingDismissed = false;
        updateNowPlayingMini(current, { highlight: true, forceOpen: true });
      }
      showIngestionActivityToast(activity);
      return;
    }
    if (message.type === 'notifications:cleared') {
      state.overlayNotifications = [];
      state.unreadCount = 0;
      state.notificationSourceFilter = 'all';
      renderNotificationsOverlay();
      updateNotificationsTrigger();
      return;
    }
    if (message.type === 'notification:new') {
      state.unreadCount += 1;
      state.overlayNotifications.unshift({ ...message.payload, unread: true });
      state.overlayNotifications = state.overlayNotifications.slice(0, 50);
      if (state.notificationsOverlayOpen) renderNotificationsOverlay();
      updateNotificationsTrigger();
      showNotificationToast(message.payload);
      return;
    }
    if (message.type === 'view:show') return; // navigation is local per browser/device
  },
  onOpen() { debug('WebSocket conectado'); },
  onClose() { debug('WebSocket desconectado; se reintentará la conexión'); },
  onError(event) { debugError('Error de WebSocket', event); }
});

document.querySelector('.primary-navigation')?.addEventListener('click', event => {
  const btn = event.target.closest('button[data-nav]');
  if (!btn) return;
  closeNotificationsOverlay();
  navigate(btn.dataset.nav, { reason: 'dock' });
});
notificationsTrigger?.addEventListener('click', event => { event.stopPropagation(); openNotificationsOverlay().catch(debugError); });
nowPlayingMini?.addEventListener('click', event => {
  if (event.target.closest('[data-now-playing-close]')) {
    state.nowPlayingDismissed = true;
    nowPlayingMini.hidden = true;
    nowPlayingMini.classList.add('now-playing-mini--hidden');
    return;
  }
  if (event.target.closest('[data-now-playing-open]')) openCurrentContentFromMini();
});
toast.addEventListener('click', () => { if (!state.privacyLocked) { toast.classList.remove('event-toast--visible'); const action = state.latestToastAction; state.latestToastAction = null; if (typeof action === 'function') action(); else openNotificationsOverlay().catch(debugError); } });
notificationsOverlay.addEventListener('click', event => {
  if (event.target.closest('[data-close-notifications]')) closeNotificationsOverlay();
  const filterButton = event.target.closest('[data-notification-filter]');
  if (filterButton) {
    state.notificationSourceFilter = filterButton.dataset.notificationFilter || 'all';
    renderNotificationsOverlay();
    return;
  }
  if (event.target.closest('[data-clear-notifications]')) {
    api('/api/notifications', { method: 'DELETE' }).then(() => {
      state.overlayNotifications = [];
      state.unreadCount = 0;
      state.notificationSourceFilter = 'all';
      renderNotificationsOverlay();
      updateNotificationsTrigger();
    }).catch(debugError);
  }
});
document.addEventListener('kiosk:open-notifications', () => openNotificationsOverlay().catch(debugError));
document.addEventListener('bbqueue:follow-item', async event => {
  const detail = event.detail || {};
  const destination = detail.id;
  const item = detail.item || {};
  if (!destination || !['database','backlog','on-deck','collections'].includes(destination)) return;
  const workspaceKey = destination === 'on-deck' ? 'onDeck' : destination;
  const itemType = String(item.collectionType || '').trim();
  let typeActivated = false;
  if (itemType) {
    const currentWorkspace = state.settings?.workspaces?.[workspaceKey] || {};
    const visibleTypes = Array.isArray(currentWorkspace.visibleTypes) ? [...currentWorkspace.visibleTypes] : [];
    if (!visibleTypes.includes(itemType)) {
      visibleTypes.push(itemType);
      try {
        state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify({ workspaces: { [workspaceKey]: { ...currentWorkspace, visibleTypes } } }) });
        typeActivated = true;
        for (const viewId of ['database','backlog','on-deck','collections','current-content']) views.update(viewId, { settings: state.settings });
      } catch (error) {
        ui.toast('No se pudo activar el tipo en el espacio', { detail: error.message || '' });
      }
    }
  }
  localStorage.setItem('bbqueue:global-search', '');
  localStorage.setItem('bbqueue:charred-only', '0');
  window.dispatchEvent(new CustomEvent('bbqueue:global-search', { detail: { value: '', source: 'follow-item' } }));
  window.dispatchEvent(new CustomEvent('bbqueue:charred-filter', { detail: false }));
  document.dispatchEvent(new CustomEvent('bbqueue:reveal-item', { detail }));
  navigate(destination, { reason: 'follow item' });
  if (typeActivated) ui.toast(`${itemType === 'movies' ? 'Películas' : itemType === 'series' ? 'Series' : itemType === 'games' ? 'Juegos' : itemType} se ha activado en este espacio`);
});
document.addEventListener('kiosk:navigate', event => {
  const id = event.detail?.id;
  if (id === 'notifications') return openNotificationsOverlay().catch(debugError);
  closeNotificationsOverlay();
  navigate(id, { reason: 'app' });
});

settingsTrigger?.addEventListener('click', () => openSettingsModal().catch(debugError));

function colorField(name, label, value, help = '') {
  return `<label class="ui-field color-field"><span>${escapeHtml(label)}</span><div class="color-field__control"><input data-setting="${escapeAttr(name)}" type="color" value="${escapeAttr(value)}"><code data-color-preview="${escapeAttr(name)}">${escapeHtml(String(value || '').toUpperCase())}</code></div>${help ? `<small class="ui-field__help">${escapeHtml(help)}</small>` : ''}</label>`;
}
function valueField(name, label, value, { min = 0, max = 100, step = 1, unit = '', help = '' } = {}) {
  return `<label class="ui-field ui-value-field"><span>${escapeHtml(label)}</span><div class="ui-value-field__control"><input data-setting-range="${escapeAttr(name)}" type="range" min="${min}" max="${max}" step="${step}" value="${escapeAttr(value)}"><span class="ui-number-control"><input data-setting="${escapeAttr(name)}" type="number" min="${min}" max="${max}" step="${step}" value="${escapeAttr(value)}"><em>${escapeHtml(unit)}</em></span></div>${help ? `<small class="ui-field__help">${escapeHtml(help)}</small>` : ''}</label>`;
}
function radiusField(name, label, value) {
  const presets = [[0,'Recto'],[8,'Suave'],[16,'Redondeado'],[28,'Muy redondeado']];
  return `<div class="ui-field ui-radius-field"><span>${escapeHtml(label)}</span><div class="radius-presets">${presets.map(([v,l])=>`<button type="button" data-setting-preset="${escapeAttr(name)}" data-value="${v}" class="${Number(value)===v?'is-active':''}"><i style="border-radius:${v}px"></i><span>${l}</span><small>${v} px</small></button>`).join('')}</div><label class="ui-number-control ui-number-control--standalone"><input data-setting="${escapeAttr(name)}" type="number" min="0" max="48" step="1" value="${escapeAttr(value)}"><em>px</em></label></div>`;
}
function bindColorFieldPreviews(root) {
  root.querySelectorAll('input[type="color"][data-setting]').forEach(input => {
    const update = () => {
      const preview = root.querySelector(`[data-color-preview="${input.dataset.setting}"]`);
      if (preview) preview.textContent = String(input.value || '').toUpperCase();
    };
    input.addEventListener('input', update);
    update();
  });
}
async function downloadBackup(endpoint, fallbackName) {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('No se pudo exportar el backup');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const contentDisposition = response.headers.get('content-disposition') || '';
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  const fileName = match?.[1] || fallbackName || `bbqueue-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function readJsonFile(file) {
  if (!file) throw new Error('Selecciona un archivo JSON.');
  if (file.size > 250 * 1024 * 1024) throw new Error('El backup supera el límite de 250 MB.');
  try { return JSON.parse(await file.text()); }
  catch { throw new Error('El archivo no contiene JSON válido.'); }
}
async function importBackup(kind, file, mode = 'replace') {
  const backup = await readJsonFile(file);
  return api(`/api/backups/${kind}/import`, { method:'POST', body:JSON.stringify({ backup, mode }) });
}
async function runDestructiveAction(endpoint, phrase) {
  const confirmation = window.prompt(`Esta acción no se puede deshacer. Escribe exactamente: ${phrase}`);
  if (confirmation !== phrase) throw new Error('Confirmación cancelada o incorrecta.');
  return api(endpoint, { method:'POST', body:JSON.stringify({ confirmation }) });
}

function renderCollectionGroupRows(groups = []) {
  return groups.length ? groups.map(group => `<article class="collection-group-row" data-group-id="${escapeAttr(group.id)}"><div><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.mode || 'manual')} · ${(group.rules || []).length} regla(s)</small></div><button type="button" class="ui-action-button ui-action-button--danger" data-delete-group="${escapeAttr(group.id)}">Eliminar</button></article>`).join('') : '<p class="settings-help">Todavía no hay grupos creados.</p>';
}
function collectionGroupsSettingsMarkup(groups = []) {
  const fieldOptions = [
    ['platform','Plataforma'], ['genre','Género'], ['developer','Desarrollador'], ['publisher','Publisher'],
    ['year','Año'], ['source','Fuente'], ['type','Tipo'], ['title','Título']
  ];
  return `<div class="settings-fieldset"><h4>Grupos</h4><p class="settings-help">Los grupos organizan items de forma transversal. No son la Colección ni cambian el estado Terminado.</p>
    <div class="collection-groups-manager" data-groups-manager>
      ${groups.length ? groups.map(group => `<article class="collection-group-row" data-group-id="${escapeAttr(group.id)}"><div><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.mode || 'manual')} · ${(group.rules || []).length} regla(s)</small></div><button type="button" class="ui-action-button ui-action-button--danger" data-delete-group="${escapeAttr(group.id)}">Eliminar</button></article>`).join('') : '<p class="settings-help">Todavía no hay grupos creados.</p>'}
    </div>
    <div class="collection-group-create settings-inline-create">
      <h4>Crear grupo</h4>
      <label class="ui-field"><span>Nombre</span><input data-new-group-name type="text" placeholder="Nintendo DS"></label>
      <div class="segmented-control" role="group" aria-label="Tipo de grupo">
        <label><input type="radio" name="settings-new-group-mode" value="manual" checked><span>Manual</span></label>
        <label><input type="radio" name="settings-new-group-mode" value="dynamic"><span>Dinámico</span></label>
        <label><input type="radio" name="settings-new-group-mode" value="mixed"><span>Mixto</span></label>
      </div>
      <div class="segmented-control segmented-control--wrap" role="group" aria-label="Campo dinámico">
        ${fieldOptions.map(([value,label], index) => `<label><input type="radio" name="settings-new-group-field" value="${value}" ${index === 0 ? 'checked' : ''}><span>${label}</span></label>`).join('')}
      </div>
      <label class="ui-field"><span>Valor dinámico</span><input data-new-group-value type="text" placeholder="Nintendo DS"></label>
      <button type="button" class="ui-action-button" data-create-group>Crear grupo</button>
    </div>
  </div>`;
}

function typeSlug(value = '') {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
function itemTypesSettingsMarkup(types = []) {
  const rows = Array.isArray(types) ? types : [];
  return `<div class="settings-fieldset"><h4>Tipos personalizados</h4>
    <p class="settings-help">Crea tipos propios para items manuales. Aparecerán en filtros y formularios. Ejemplo: Libros.</p>
    <div class="custom-types-list" data-custom-types-list>
      ${rows.length ? rows.map(type => `<div class="custom-type-row" data-custom-type-row><label class="ui-field"><span>ID</span><input data-custom-type-id value="${escapeAttr(type.id || '')}" placeholder="libros"></label><label class="ui-field"><span>Singular</span><input data-custom-type-singular value="${escapeAttr(type.singular || type.label || '')}" placeholder="Libro"></label><label class="ui-field"><span>Plural</span><input data-custom-type-plural value="${escapeAttr(type.plural || type.label || '')}" placeholder="Libros"></label><button type="button" class="ui-action-button" data-remove-custom-type>Quitar</button></div>`).join('') : '<p class="settings-help" data-empty-custom-types>No hay tipos personalizados.</p>'}
    </div>
    <div class="custom-type-row custom-type-row--new"><label class="ui-field"><span>Nuevo tipo</span><input data-new-custom-type-name placeholder="Libros"></label><button type="button" class="ui-action-button" data-add-custom-type>Añadir tipo</button></div>
  </div>`;
}
function readCustomTypesFromSettings(root) {
  const seen = new Set(['games', 'movies', 'series']);
  return [...root.querySelectorAll('[data-custom-type-row]')].map(row => {
    const name = row.querySelector('[data-custom-type-singular]')?.value?.trim() || row.querySelector('[data-custom-type-plural]')?.value?.trim() || row.querySelector('[data-custom-type-id]')?.value?.trim() || '';
    const id = typeSlug(row.querySelector('[data-custom-type-id]')?.value || name);
    const singular = row.querySelector('[data-custom-type-singular]')?.value?.trim() || name || id;
    const plural = row.querySelector('[data-custom-type-plural]')?.value?.trim() || singular;
    return { id, singular, plural };
  }).filter(type => type.id && !seen.has(type.id) && !seen.has(type.id) && seen.add(type.id));
}

function grillSettingsMarkup(settings = {}) {
  const grill = settings.grill || {};
  const types = [
    { id:'games', label:'Juegos' }, { id:'movies', label:'Películas' }, { id:'series', label:'Series' },
    ...(settings.itemTypes || []).map(type => ({ id:type.id, label:type.plural || type.singular || type.id }))
  ];
  const seen = new Set();
  const unique = types.filter(type => type?.id && !seen.has(type.id) && seen.add(type.id));
  const cell = (type, view, fallback) => { const value = grill.limits?.[type]?.[view]; return value === false ? '' : (value || fallback); };
  return `<div class="settings-fieldset"><h4>Sistema de parrilla</h4><p class="settings-help">Los estados “quemándose” y “achicharrado” se calculan dinámicamente según el espacio de trabajo y sus límites.</p><label class="ui-check"><input type="checkbox" data-setting="grillEnabled" ${grill.enabled !== false ? 'checked' : ''}> Activar sistema de parrilla</label><div class="grill-settings-table"><div></div><strong>Backlog</strong><strong>On Deck</strong>${unique.map(type => `<span>${escapeHtml(type.label)}</span><label><input type="number" min="1" max="3650" data-grill-type="${escapeAttr(type.id)}" data-grill-view="backlog" value="${escapeAttr(cell(type.id,'backlog',grill.defaults?.backlog || 30))}"><small>días</small></label><label><input type="number" min="1" max="3650" data-grill-type="${escapeAttr(type.id)}" data-grill-view="onDeck" value="${escapeAttr(cell(type.id,'onDeck',grill.defaults?.onDeck || 7))}"><small>días</small></label>`).join('')}</div></div>`;
}
function integrationBehaviorMarkup(settings = {}) {
  const grill = settings.grill || {};
  return `<div class="settings-fieldset"><h4>Playnite</h4><p class="settings-help">Configura cómo afectan los eventos de Playnite a la biblioteca y a la parrilla.</p><div class="settings-check-grid"><label class="ui-check"><input type="checkbox" data-setting="playniteStarted" ${settings.backlog?.sources?.playniteStarted !== false ? 'checked' : ''}> Observar inicio de juegos</label><label class="ui-check"><input type="checkbox" data-setting="grillClearPlaynite" ${(grill.clearCharredOn?.playniteStarted ?? true) ? 'checked' : ''}> Quitar Achicharrado al iniciar</label></div></div><div class="settings-fieldset"><h4>Plex / Tautulli</h4><p class="settings-help">Cada evento puede actualizar el item y decidir si reinicia su estado de parrilla.</p><div class="settings-check-grid"><label class="ui-check"><input type="checkbox" data-setting="plexRecentlyAdded" ${settings.backlog?.sources?.plexRecentlyAdded !== false ? 'checked' : ''}> Observar contenido añadido</label><label class="ui-check"><input type="checkbox" data-setting="plexPlayback" ${settings.backlog?.sources?.plexPlayback !== false ? 'checked' : ''}> Observar reproducciones</label><label class="ui-check"><input type="checkbox" data-setting="grillClearPlexLibrary" ${(grill.clearCharredOn?.plexLibraryAdded ?? false) ? 'checked' : ''}> Añadido quita Achicharrado</label><label class="ui-check"><input type="checkbox" data-setting="grillClearPlexPlayback" ${(grill.clearCharredOn?.plexPlayback ?? false) ? 'checked' : ''}> Reproducción quita Achicharrado</label></div></div><div class="settings-fieldset"><h4>Actividad manual</h4><div class="settings-check-grid"><label class="ui-check"><input type="checkbox" data-setting="grillClearManual" ${(grill.clearCharredOn?.manual ?? true) ? 'checked' : ''}> Mover o editar actividad quita Achicharrado</label><label class="ui-check"><input type="checkbox" data-setting="grillClearJournal" ${(grill.clearCharredOn?.journal ?? true) ? 'checked' : ''}> Guardar diario quita Achicharrado</label></div></div>`;
}
function readGrillSettings(root, settings = {}) {
  const limits = {}; root.querySelectorAll('[data-grill-type]').forEach(input => { const type=input.dataset.grillType; const view=input.dataset.grillView; limits[type] ||= {}; limits[type][view] = Math.max(1, Number(input.value) || (view === 'onDeck' ? 7 : 30)); });
  return { enabled: root.querySelector('[data-setting="grillEnabled"]')?.checked !== false, defaults: { backlog: Number(settings.grill?.defaults?.backlog || 30), onDeck: Number(settings.grill?.defaults?.onDeck || 7) }, limits, clearCharredOn: { manual: root.querySelector('[data-setting="grillClearManual"]')?.checked !== false, journal: root.querySelector('[data-setting="grillClearJournal"]')?.checked !== false, playniteStarted: root.querySelector('[data-setting="grillClearPlaynite"]')?.checked !== false, plexPlayback: root.querySelector('[data-setting="grillClearPlexPlayback"]')?.checked === true, plexLibraryAdded: root.querySelector('[data-setting="grillClearPlexLibrary"]')?.checked === true } };
}

async function openSettingsModal() {
  const s = state.settings || await api('/api/settings');
  const customCss = await loadCustomCssText('global').catch(() => '');
  const checked = value => value ? 'checked' : '';
  const selected = (value, current) => value === current ? 'selected' : '';
  const bg = s.design?.background || {};
  const itemBg = s.design?.itemBackground || {};
  const cards = s.design?.cards || {};
  const sourceColors = s.design?.sourceColors || {};
  const body = `<div class="settings-tabs" data-settings-tabs>
    <nav class="settings-tabs__nav" aria-label="Secciones de opciones">
      ${[
        ['general','General'], ['appearance','Apariencia'], ['content','Biblioteca'], ['workspaces','Espacios de trabajo'], ['grill','Parrilla'], ['integrations','Integraciones'], ['advanced','Datos y diagnóstico']
      ].map(([id,label], index) => `<button type="button" data-settings-tab="${id}" class="${index === 0 ? 'is-active' : ''}">${label}</button>`).join('')}
    </nav>
    <div class="settings-tabs__content"><nav class="settings-subnav" data-settings-subnav aria-label="Subsecciones"></nav><div class="settings-tabs__panels">
      <section data-settings-panel="general" class="settings-tab-panel is-active"><h3>General</h3>
        <label class="ui-field"><span>Vista inicial</span><select data-setting="defaultView"><option value="database" ${selected('database', s.display?.defaultView)}>Base de datos</option><option value="backlog" ${selected('backlog', s.display?.defaultView)}>Backlog</option><option value="on-deck" ${selected('on-deck', s.display?.defaultView)}>On Deck</option><option value="current-content" ${selected('current-content', s.display?.defaultView)}>Actual</option><option value="collections" ${selected('collections', s.display?.defaultView)}>Colección</option></select></label>
      </section>

      <section data-settings-panel="workspaces" class="settings-tab-panel"><h3>Organización por espacio</h3>
        <p class="settings-help">Los espacios son fijos. Aquí solo defines su presentación y organización predeterminadas.</p>
        ${[['database','Base de datos','Todos los items'],['backlog','Backlog','Pertenencia manual'],['onDeck','On Deck','Pertenencia manual · límite por tipo'],['collections','Colección','Items marcados como terminados']].map(([key,label,rule]) => { const ws=s.workspaces?.[key]||{}; const visibleTypes=new Set(ws.visibleTypes||['games','movies','series']); return `<article class="workspace-rule-card"><header><div><strong>${label}</strong><small>${rule}</small></div></header><div class="workspace-type-settings"><span>Tipos visibles</span><div class="controls-modal__checks">${[{id:'games',singular:'Juego',plural:'Juegos'},{id:'movies',singular:'Película',plural:'Películas'},{id:'series',singular:'Serie',plural:'Series'},...(s.itemTypes||[])].filter((type,index,rows)=>type?.id&&rows.findIndex(row=>row.id===type.id)===index).map(type => `<label class="controls-modal__toggle"><input type="checkbox" data-workspace-visible-type="${key}:${escapeAttr(type.id)}" ${visibleTypes.has(type.id)?'checked':''}><span>${escapeHtml(type.plural||type.singular||type.id)}</span></label>`).join('')}</div></div><div class="workspace-rule-grid"><label class="ui-field"><span>Agrupación</span><select data-workspace-setting="${key}.grouping"><option value="none" ${selected('none',ws.grouping||'none')}>Sin agrupación</option><option value="date" ${selected('date',['lastActivity','completedAt'].includes(ws.grouping)?'date':ws.grouping)}>Fecha</option><option value="type" ${selected('type',ws.grouping)}>Tipo</option><option value="group" ${selected('group',ws.grouping)}>Grupo</option></select></label><label class="ui-field"><span>Organización de fechas</span><select data-workspace-setting="${key}.dateGrouping"><option value="relative" ${selected('relative',ws.dateGrouping||'relative')}>Periodos recientes</option><option value="month" ${selected('month',ws.dateGrouping)}>Mes y año</option><option value="year" ${selected('year',ws.dateGrouping)}>Año</option></select></label><label class="ui-field"><span>Fecha utilizada</span><select data-workspace-setting="${key}.groupingDateField"><option value="lastActivityAt" ${selected('lastActivityAt',ws.grouping==='completedAt'?'completedAt':(ws.groupingDateField||'lastActivityAt'))}>Última actividad</option><option value="completedAt" ${selected('completedAt',ws.grouping==='completedAt'?'completedAt':ws.groupingDateField)}>Finalización</option></select></label><label class="ui-field"><span>Orden</span><select data-workspace-setting="${key}.sort"><option value="lastActivityAt" ${selected('lastActivityAt',ws.sort||'lastActivityAt')}>Última actividad</option><option value="title" ${selected('title',ws.sort)}>Título</option><option value="rating" ${selected('rating',ws.sort)}>Calificación</option><option value="completedAt" ${selected('completedAt',ws.sort)}>Finalización</option></select></label><label class="ui-field"><span>Diseño</span><select data-workspace-setting="${key}.cardFormat"><option value="simple" ${selected('simple',ws.cardFormat)}>Simple</option><option value="standard" ${selected('standard',ws.cardFormat||'standard')}>Normal</option></select></label><label class="ui-field"><span>Tamaño</span><select data-workspace-setting="${key}.cardSize"><option value="small" ${selected('small',ws.cardSize)}>Pequeño</option><option value="medium" ${selected('medium',ws.cardSize||'medium')}>Mediano</option><option value="large" ${selected('large',ws.cardSize)}>Grande</option></select></label></div></article>`; }).join('')}
      </section>
      <section data-settings-panel="grill" class="settings-tab-panel"><h3>Parrilla</h3>${grillSettingsMarkup(s)}</section>
      <section data-settings-panel="appearance" class="settings-tab-panel"><h3>Tema y fondos</h3>
        <div class="settings-fieldset"><h4>Colores</h4>
          ${colorField('accentColor', 'Color de acento', s.design?.accentColor || '#8fafef')}
          ${colorField('grillColorNormal', 'Borde normal', s.design?.grillColors?.normal || '#161a22')}
          ${colorField('grillColorHot', 'Quemándose', s.design?.grillColors?.hot || '#f3b61f')}
          ${colorField('grillColorCharred', 'Achicharrado', s.design?.grillColors?.charred || '#ef3340')}
        </div>
        <div class="settings-fieldset"><h4>Fondo de vistas</h4>
          ${valueField('bgRotationSeconds', 'Rotación de fondos', bg.rotationSeconds || 12, { min:3,max:120,step:1,unit:'s',help:'Tiempo entre cambios de fondo.' })}
          ${valueField('bgOpacity', 'Opacidad del fondo', bg.opacity ?? 0.28, { min:0,max:1,step:.01,unit:'' })}
          ${valueField('bgBlur', 'Desenfoque del fondo', bg.blur ?? 18, { min:0,max:48,step:1,unit:'px' })}
          ${valueField('bgOverlayOpacity', 'Oscurecimiento del fondo', bg.overlayOpacity ?? 0.76, { min:0,max:1,step:.01 })}
          ${valueField('bgGrayscale', 'Blanco y negro', bg.grayscale ?? 0, { min:0,max:100,step:1,unit:'%' })}
          ${colorField('bgOverlayColor', 'Color de capa', bg.overlayColor || '#05070c')}
          ${valueField('bgFadeSeconds', 'Transición entre fondos', bg.fadeSeconds ?? 1.2, { min:0,max:5,step:.05,unit:'s' })}
        </div>
        <div class="settings-fieldset"><h4>Contenido de las tarjetas</h4><p class="settings-help">Define qué elementos aparecen en cada diseño de tarjeta.</p>${[['simple','Simple'],['standard','Normal']].map(([format,label]) => `<div class="card-visibility-settings"><h5>${label}</h5><div class="settings-check-grid">${[['title','Título'],['detail','Estado / detalle'],['rating','Calificación'],['date','Fecha'],['type','Tipo'],['groups','Grupos'],['state','Vista activa'],['journal','Diario'],['grill','Parrilla']].map(([key,text]) => { const current=s.design?.gridCards?.[format] || {}; const fallback=format==='simple' ? ['title','detail','rating','journal','grill'].includes(key) : key!=='type'; return `<label class="ui-check"><input type="checkbox" data-card-default="${format}.${key}" ${(current[key] ?? fallback) ? 'checked' : ''}> ${text}</label>`; }).join('')}</div></div>`).join('')}</div><div class="settings-fieldset"><h4>Tarjetas</h4>
          <label class="ui-check"><input type="checkbox" data-setting="itemBgEnabled" ${checked(itemBg.enabled !== false)}> Usar backdrop dentro de cada item</label>
          ${valueField('itemBgOpacity', 'Opacidad del backdrop', itemBg.opacity ?? 0.32, { min:0,max:1,step:.01 })}
          ${valueField('itemBgBlur', 'Desenfoque del backdrop', itemBg.blur ?? 12, { min:0,max:36,step:1,unit:'px' })}
          ${valueField('itemBgOverlayOpacity', 'Oscurecimiento de tarjeta', itemBg.overlayOpacity ?? 0.72, { min:0,max:1,step:.01 })}
          ${valueField('itemBgGrayscale', 'Blanco y negro del backdrop', itemBg.grayscale ?? 0, { min:0,max:100,step:1,unit:'%' })}
          ${radiusField('cardRadius', 'Radio de tarjeta', cards.radius ?? 18)}${radiusField('posterRadiusSimple', 'Radio de carátula · Simple', cards.posterRadiusSimple ?? 14)}${radiusField('posterRadiusStandard', 'Radio de carátula · Normal', cards.posterRadiusStandard ?? 12)}
        </div>
        <div class="settings-fieldset"><h4>Escala</h4>
          <label class="ui-field"><span>Tamaño de fuente</span><select data-setting="fontScale"><option value="small" ${selected('small', s.design?.fontScale)}>Pequeño</option><option value="medium" ${selected('medium', s.design?.fontScale)}>Medio</option><option value="large" ${selected('large', s.design?.fontScale)}>Grande</option></select></label>
          <label class="ui-field"><span>Densidad UI</span><select data-setting="density"><option value="compact" ${selected('compact', s.design?.density)}>Compacta</option><option value="comfortable" ${selected('comfortable', s.design?.density)}>Cómoda</option><option value="large" ${selected('large', s.design?.density)}>Grande</option></select></label>
        </div>
      </section>
      <section data-settings-panel="appearance" class="settings-tab-panel"><h3>Ficha del item</h3>
        <div class="settings-fieldset"><h4>Diseño visual</h4>
          <label class="ui-field"><span>Fondo</span><select data-setting="detailBg"><option value="backdrop" ${selected('backdrop', s.design?.itemDetail?.background?.background || 'backdrop')}>Backdrop</option><option value="poster" ${selected('poster', s.design?.itemDetail?.background?.background)}>Poster</option><option value="solid" ${selected('solid', s.design?.itemDetail?.background?.background)}>Sólido</option><option value="none" ${selected('none', s.design?.itemDetail?.background?.background)}>Sin imagen</option></select></label>
          <label class="ui-field"><span>Oscurecimiento</span><select data-setting="detailShade"><option value="low" ${selected('low', s.design?.itemDetail?.background?.shade)}>Bajo</option><option value="medium" ${selected('medium', s.design?.itemDetail?.background?.shade || 'medium')}>Medio</option><option value="high" ${selected('high', s.design?.itemDetail?.background?.shade)}>Alto</option></select></label>
          <label class="ui-field"><span>Blur</span><select data-setting="detailBlur"><option value="none" ${selected('none', s.design?.itemDetail?.background?.blur)}>Nada</option><option value="soft" ${selected('soft', s.design?.itemDetail?.background?.blur || 'soft')}>Suave</option><option value="strong" ${selected('strong', s.design?.itemDetail?.background?.blur)}>Fuerte</option></select></label>
        </div>
        <div class="settings-fieldset"><h4>Metadata visible</h4>
          <p class="settings-help">Escribe claves separadas por comas. Usa “Ver claves detectadas” para consultar la chuleta de metadata real.</p>
          <label class="ui-field"><span>Juegos</span><textarea data-setting="detailMetaGames" rows="2">${escapeHtml((s.design?.itemDetail?.metadataFields?.games || []).join(', '))}</textarea></label>
          <label class="ui-field"><span>Películas</span><textarea data-setting="detailMetaMovies" rows="2">${escapeHtml((s.design?.itemDetail?.metadataFields?.movies || []).join(', '))}</textarea></label>
          <label class="ui-field"><span>Series</span><textarea data-setting="detailMetaSeries" rows="2">${escapeHtml((s.design?.itemDetail?.metadataFields?.series || []).join(', '))}</textarea></label>
          <button type="button" class="ui-action-button" data-load-metadata-keys>Ver claves detectadas</button>
          <pre class="metadata-keys-cheatsheet" data-metadata-keys hidden></pre>
        </div>
      </section>
      <section data-settings-panel="content" class="settings-tab-panel"><h3>Tipos</h3>
        ${itemTypesSettingsMarkup(s.itemTypes || [])}
      </section>
      <section data-settings-panel="general" class="settings-tab-panel is-active"><h3>Notificaciones</h3>
        <label class="ui-check"><input type="checkbox" data-setting="toastEnabled" ${checked(s.notifications?.toastEnabled !== false)}> Mostrar toast</label>
        <label class="ui-check"><input type="checkbox" data-setting="soundEnabled" ${checked(s.notifications?.soundEnabled === true)}> Sonido</label>
        <label class="ui-field"><span>Tamaño toast</span><select data-setting="toastSize"><option value="small" ${selected('small', s.notifications?.toastSize)}>Pequeño</option><option value="medium" ${selected('medium', s.notifications?.toastSize)}>Medio</option><option value="large" ${selected('large', s.notifications?.toastSize)}>Grande</option></select></label>
      </section>
      <section data-settings-panel="integrations" class="settings-tab-panel"><h3>Integraciones</h3>
        <div class="settings-fieldset"><h4>Conexión Plex</h4><p class="settings-help">Credenciales del servidor Plex usadas por la integración y Tautulli.</p><label class="ui-field"><span>URL</span><input data-setting="plexUrl" type="text" value="${escapeAttr(s.plex?.url || '')}" placeholder="http://IP:32400"></label><label class="ui-field"><span>Token</span><input data-setting="plexToken" type="password" value="${escapeAttr(s.plex?.token || '')}"></label></div>${integrationBehaviorMarkup(s)}
      </section>
      <section data-settings-panel="content" class="settings-tab-panel"><h3>Grupos</h3>
        ${collectionGroupsSettingsMarkup(state.collectionGroups || [])}
      </section>
      <section data-settings-panel="advanced" class="settings-tab-panel"><h3>Datos y mantenimiento</h3>
        <div class="settings-fieldset"><h4>Biblioteca</h4>
          <p class="settings-help">Incluye ítems, espacios, grupos, actividad, calificaciones, reseñas, diario y assets locales. Puede generar un archivo grande.</p>
          <div class="settings-actions-grid"><button type="button" class="ui-action-button" data-export-library>Exportar biblioteca</button><label class="ui-action-button ui-file-action">Importar biblioteca<input type="file" accept="application/json,.json" data-import-library hidden></label></div>
          <label class="ui-field"><span>Modo de importación</span><select data-library-import-mode><option value="replace">Reemplazar biblioteca actual</option><option value="merge">Fusionar por identificador canónico</option></select></label>
        </div>
        <div class="settings-fieldset"><h4>Configuración</h4>
          <p class="settings-help">Incluye opciones, apariencia, espacios, integraciones y CSS. Las credenciales solo se exportan cuando lo indicas.</p>
          <label class="ui-check"><input type="checkbox" data-export-secrets> Incluir credenciales y tokens</label>
          <div class="settings-actions-grid"><button type="button" class="ui-action-button" data-export-settings>Exportar configuración</button><label class="ui-action-button ui-file-action">Importar configuración<input type="file" accept="application/json,.json" data-import-settings hidden></label><button type="button" class="ui-action-button" data-refresh-css>Recargar CSS</button></div>
        </div>
        <div class="settings-fieldset settings-fieldset--danger"><h4>Zona de reinicio</h4>
          <p class="settings-help">Exporta un backup antes de continuar. Las acciones requieren escribir una frase de confirmación.</p>
          <div class="settings-actions-grid"><button type="button" class="ui-action-button ui-action-button--danger" data-reset-library>Borrar biblioteca</button><button type="button" class="ui-action-button ui-action-button--danger" data-reset-settings>Restablecer configuración</button><button type="button" class="ui-action-button ui-action-button--danger" data-reset-all>Restablecer todo</button></div>
        </div>
      </section>
      <section data-settings-panel="advanced" class="settings-tab-panel"><h3>Debug</h3>
        <div class="debug-actions"><button type="button" data-debug="notification">Notificación</button><button type="button" data-debug="plex">Plex</button><button type="button" data-debug="game">Playnite</button></div>
        <p class="settings-help">Los botones lanzan eventos de prueba sin cerrar las opciones.</p>
      </section>
      <section data-settings-panel="appearance" class="settings-tab-panel"><h3>CSS personalizado</h3>
        <label class="ui-field"><span>CSS global</span><textarea data-setting="customCss" rows="10" spellcheck="false">${escapeHtml(customCss)}</textarea></label>
      </section>
    </div></div>
  </div>`;
  const modalPromise = ui.open({
    title: 'Opciones',
    className: 'ui-modal-root--settings',
    body,
    actions: [
      { label: 'Cancelar', value: null },
      { label: 'Guardar', variant: 'primary', onClick: root => {
        const get = name => root.querySelector(`[data-setting="${name}"]`);
        const settingsPayload = {
          display: { defaultView: get('defaultView')?.value || 'backlog' },
          grill: readGrillSettings(root, s),
          design: {
            gridCards: Object.fromEntries(['simple','standard'].map(format => [format, Object.fromEntries([...root.querySelectorAll(`[data-card-default^="${format}."]`)].map(input => [input.dataset.cardDefault.split('.')[1], input.checked]))])),
            accentColor: get('accentColor')?.value || '#8fafef',
            fontScale: get('fontScale')?.value || 'medium',
            density: get('density')?.value || 'comfortable',
            sourceColors: sourceColors,
            grillColors: { normal: get('grillColorNormal')?.value || '#161a22', hot: get('grillColorHot')?.value || '#f3b61f', charred: get('grillColorCharred')?.value || '#ef3340' },
            itemBackground: {
              enabled: get('itemBgEnabled')?.checked !== false,
              opacity: Number(get('itemBgOpacity')?.value ?? 0.32),
              blur: Number(get('itemBgBlur')?.value || 12),
              overlayOpacity: Number(get('itemBgOverlayOpacity')?.value ?? 0.72),
              grayscale: Number(get('itemBgGrayscale')?.value ?? 0)
            },
            cards: {
              radius: Number(get('cardRadius')?.value ?? 18),
              posterRadiusSimple: Number(get('posterRadiusSimple')?.value ?? 14),
              posterRadiusStandard: Number(get('posterRadiusStandard')?.value ?? 12)
            },
            itemDetail: {
              background: { background: get('detailBg')?.value || 'backdrop', shade: get('detailShade')?.value || 'medium', blur: get('detailBlur')?.value || 'soft' },
              metadataFields: {
                games: String(get('detailMetaGames')?.value || '').split(',').map(v => v.trim()).filter(Boolean),
                movies: String(get('detailMetaMovies')?.value || '').split(',').map(v => v.trim()).filter(Boolean),
                series: String(get('detailMetaSeries')?.value || '').split(',').map(v => v.trim()).filter(Boolean)
              }
            },
            background: {
              rotationSeconds: Number(get('bgRotationSeconds')?.value || 12),
              opacity: Number(get('bgOpacity')?.value ?? 0.28),
              blur: Number(get('bgBlur')?.value || 18),
              overlayColor: get('bgOverlayColor')?.value || '#05070c',
              overlayOpacity: Number(get('bgOverlayOpacity')?.value ?? 0.76),
              grayscale: Number(get('bgGrayscale')?.value ?? 0),
              fadeSeconds: Number(get('bgFadeSeconds')?.value ?? 1.2)
            }
          },
          views: {
            backlog: { cardSize: get('backlogSize')?.value || s.views?.backlog?.cardSize || 'medium', itemsPerPage: Number(s.views?.backlog?.itemsPerPage || 12) },
            onDeck: { cardSize: get('onDeckSize')?.value || s.views?.onDeck?.cardSize || 'medium', itemsPerPage: Number(s.views?.onDeck?.itemsPerPage || 12) },
            collections: { cardSize: get('collectionsSize')?.value || s.views?.collections?.cardSize || 'medium', itemsPerPage: Number(s.views?.collections?.itemsPerPage || 12) },
            database: { cardSize: s.views?.database?.cardSize || 'medium', cardFormat: s.views?.database?.cardFormat || 'standard', includeCharred: s.views?.database?.includeCharred === true, itemsPerPage: Number(s.views?.database?.itemsPerPage || 60) }
          },
          backlog: { sources: { plexRecentlyAdded: get('plexRecentlyAdded')?.checked, plexPlayback: get('plexPlayback')?.checked, playniteStarted: get('playniteStarted')?.checked } },
          workspaces: Object.fromEntries(['database','backlog','onDeck','collections'].map(key => [key, { ...Object.fromEntries(['grouping','dateGrouping','groupingDateField','sort','cardFormat','cardSize'].map(field => [field, root.querySelector(`[data-workspace-setting="${key}.${field}"]`)?.value])), visibleTypes: [...root.querySelectorAll(`[data-workspace-visible-type^="${key}:"]:checked`)].map(input => input.dataset.workspaceVisibleType.split(':').slice(1).join(':')) }])),
          itemTypes: readCustomTypesFromSettings(root),
          notifications: { toastEnabled: get('toastEnabled')?.checked, soundEnabled: get('soundEnabled')?.checked, toastSize: get('toastSize')?.value || 'medium' },
          plex: { url: get('plexUrl')?.value || '', token: get('plexToken')?.value || '' },
          customCssText: get('customCss')?.value || ''
        };
        settingsTrace('payload guardado', settingsPayload);
        return settingsPayload;
      }}
    ]
  });
  setTimeout(() => {
    const refreshSettingsSubnav = tab => { const nav = modalRoot.querySelector('[data-settings-subnav]'); const scroller = modalRoot.querySelector('.settings-tabs__panels'); const panels = [...modalRoot.querySelectorAll(`[data-settings-panel="${tab}"]`)]; const targets = panels.flatMap(panel => { const sections=[...panel.querySelectorAll(':scope > .settings-fieldset')]; return sections.length ? sections : [panel]; }); if (!nav) return; nav.innerHTML = targets.map((panel,index) => { if (!panel.id) panel.id = `settings-${tab}-${index}`; const label = panel.querySelector(':scope > h4, :scope > h3')?.textContent || `Sección ${index+1}`; return `<button type="button" data-settings-jump="${panel.id}">${label}</button>`; }).join(''); const buttons=[...nav.querySelectorAll('[data-settings-jump]')]; buttons.forEach(button => button.addEventListener('click', () => modalRoot.querySelector(`#${button.dataset.settingsJump}`)?.scrollIntoView({behavior:'smooth',block:'start'}))); const update=()=>{ let active=targets[0]; const top=(scroller?.getBoundingClientRect().top||0)+90; for(const panel of targets){ if(panel.getBoundingClientRect().top<=top) active=panel; } buttons.forEach(button=>button.classList.toggle('is-active',button.dataset.settingsJump===active?.id)); }; scroller?.addEventListener('scroll',update,{passive:true}); requestAnimationFrame(update); };
    modalRoot.querySelectorAll('[data-settings-tab]').forEach(btn => btn.addEventListener('click', () => {
      const tab = btn.dataset.settingsTab;
      modalRoot.querySelectorAll('[data-settings-tab]').forEach(node => node.classList.toggle('is-active', node === btn));
      modalRoot.querySelectorAll('[data-settings-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.settingsPanel === tab));
      refreshSettingsSubnav(tab);
    }));
    refreshSettingsSubnav('general');

    modalRoot.querySelector('[data-create-group]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      if (button.dataset.busy === '1') return;
      const name = modalRoot.querySelector('[data-new-group-name]')?.value || '';
      if (!name.trim()) { ui.toast('Pon un nombre para el grupo'); return; }
      const mode = modalRoot.querySelector('input[name="settings-new-group-mode"]:checked')?.value || 'manual';
      const field = modalRoot.querySelector('input[name="settings-new-group-field"]:checked')?.value || 'platform';
      const value = modalRoot.querySelector('[data-new-group-value]')?.value || '';
      const payload = { name, mode };
      if (['dynamic','mixed'].includes(mode) && value.trim()) payload.rules = [{ field, operator: 'contains', value }];
      button.dataset.busy = '1';
      button.disabled = true;
      const created = await api('/api/collection-groups', { method: 'POST', body: JSON.stringify(payload) }).catch(error => { ui.toast(error.message || 'No se pudo crear el grupo'); return null; });
      button.dataset.busy = '0';
      button.disabled = false;
      if (created?.group) {
        state.collectionGroups = [created.group, ...(state.collectionGroups || []).filter(group => group.id !== created.group.id)];
        const seen = new Set();
        state.collectionGroups = state.collectionGroups.filter(group => {
          const signature = `${String(group.name || '').toLowerCase().trim()}::${group.mode || 'manual'}::${(group.rules || []).map(rule => `${rule.field}:${rule.operator || 'contains'}:${String(rule.value || '').toLowerCase().trim()}`).sort().join('|')}`;
          if (seen.has(signature)) return false;
          seen.add(signature);
          return true;
        });
        const manager = modalRoot.querySelector('[data-groups-manager]');
        if (manager) manager.innerHTML = renderCollectionGroupRows(state.collectionGroups || []);
        ui.toast('Grupo creado');
      }
    });
    modalRoot.addEventListener('click', async event => {
      const button = event.target.closest('[data-delete-group]');
      if (!button) return;
      const id = button.dataset.deleteGroup;
      const ok = await ui.confirm({ title: 'Eliminar grupo', message: '¿Eliminar este grupo? Los items no se eliminarán.', confirmText: 'Eliminar', danger: true });
      if (!ok) return;
      await api(`/api/collection-groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.collectionGroups = (state.collectionGroups || []).filter(group => group.id !== id);
      button.closest('[data-group-id]')?.remove();
      ui.toast('Grupo eliminado');
    });

    modalRoot.addEventListener('click', event => {
      const add = event.target.closest('[data-add-custom-type]');
      if (add) {
        const input = modalRoot.querySelector('[data-new-custom-type-name]');
        const name = input?.value?.trim() || '';
        if (!name) return;
        const list = modalRoot.querySelector('[data-custom-types-list]');
        list?.querySelector('[data-empty-custom-types]')?.remove();
        const id = typeSlug(name);
        list?.insertAdjacentHTML('beforeend', `<div class="custom-type-row" data-custom-type-row><label class="ui-field"><span>ID</span><input data-custom-type-id value="${escapeAttr(id)}" placeholder="libros"></label><label class="ui-field"><span>Singular</span><input data-custom-type-singular value="${escapeAttr(name.replace(/s$/i, ''))}" placeholder="Libro"></label><label class="ui-field"><span>Plural</span><input data-custom-type-plural value="${escapeAttr(name)}" placeholder="Libros"></label><button type="button" class="ui-action-button" data-remove-custom-type>Quitar</button></div>`);
        input.value = '';
        return;
      }
      const remove = event.target.closest('[data-remove-custom-type]');
      if (remove) {
        remove.closest('[data-custom-type-row]')?.remove();
      }
    });

    bindColorFieldPreviews(modalRoot);
    modalRoot.querySelectorAll('[data-setting-range]').forEach(range => { const input=modalRoot.querySelector(`[data-setting="${range.dataset.settingRange}"]`); if(!input) return; const syncFromRange=()=>{input.value=range.value; input.dispatchEvent(new Event('input',{bubbles:true}));}; const syncFromInput=()=>{range.value=input.value;}; range.addEventListener('input',syncFromRange); input.addEventListener('input',syncFromInput); });
    modalRoot.querySelectorAll('[data-setting-preset]').forEach(button => button.addEventListener('click',()=>{ const input=modalRoot.querySelector(`[data-setting="${button.dataset.settingPreset}"]`); if(!input)return; input.value=button.dataset.value; input.dispatchEvent(new Event('input',{bubbles:true})); button.parentElement.querySelectorAll('[data-setting-preset]').forEach(node=>node.classList.toggle('is-active',node===button)); }));
    const readVisualDesignPatch = () => {
      const root = modalRoot;
      const patch = {
        design: {
          background: {
            rotationSeconds: Number(root.querySelector('[data-setting="bgRotationSeconds"]')?.value || 12),
            opacity: Number(root.querySelector('[data-setting="bgOpacity"]')?.value ?? 0.28),
            blur: Number(root.querySelector('[data-setting="bgBlur"]')?.value || 18),
            overlayColor: root.querySelector('[data-setting="bgOverlayColor"]')?.value || '#05070c',
            overlayOpacity: Number(root.querySelector('[data-setting="bgOverlayOpacity"]')?.value ?? 0.76),
            grayscale: Number(root.querySelector('[data-setting="bgGrayscale"]')?.value ?? 0),
            fadeSeconds: Number(root.querySelector('[data-setting="bgFadeSeconds"]')?.value || 1.2)
          },
          itemBackground: {
            enabled: root.querySelector('[data-setting="itemBgEnabled"]')?.checked,
            opacity: Number(root.querySelector('[data-setting="itemBgOpacity"]')?.value ?? 0.32),
            blur: Number(root.querySelector('[data-setting="itemBgBlur"]')?.value || 12),
            overlayOpacity: Number(root.querySelector('[data-setting="itemBgOverlayOpacity"]')?.value ?? 0.72),
            grayscale: Number(root.querySelector('[data-setting="itemBgGrayscale"]')?.value ?? 0)
          },
          grillColors: {
            normal: root.querySelector('[data-setting="grillColorNormal"]')?.value || '#161a22',
            hot: root.querySelector('[data-setting="grillColorHot"]')?.value || '#f3b61f',
            charred: root.querySelector('[data-setting="grillColorCharred"]')?.value || '#ef3340'
          },
          cards: {
            radius: Number(root.querySelector('[data-setting="cardRadius"]')?.value ?? 18),
            posterRadiusSimple: Number(root.querySelector('[data-setting="posterRadiusSimple"]')?.value ?? 14),
            posterRadiusStandard: Number(root.querySelector('[data-setting="posterRadiusStandard"]')?.value ?? 12)
          }
        }
      };
      settingsTrace('controles visuales', {
        ...patch.design.itemBackground,
        radius: patch.design.cards.radius,
        countItemBgOpacity: root.querySelectorAll('[data-setting="itemBgOpacity"]').length,
        countCardRadius: root.querySelectorAll('[data-setting="cardRadius"], [data-setting="posterRadiusSimple"], [data-setting="posterRadiusStandard"], [data-setting="grillColorNormal"], [data-setting="grillColorHot"], [data-setting="grillColorCharred"]').length
      });
      return patch;
    };
    const persistVisualDesignPatch = debounce(async () => {
      const patch = readVisualDesignPatch();
      try {
        settingsTrace('autosave tarjetas -> PATCH', patch);
        state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
        settingsTrace('autosave tarjetas <- OK', state.settings?.design);
        applyDesign(state.settings);
        views.update('backlog', { settings: state.settings });
        views.update('on-deck', { settings: state.settings });
        views.update('current-content', { settings: state.settings });
        views.update('collections', { settings: state.settings });
        views.update('database', { settings: state.settings });
      } catch (error) {
        debugError('No se pudieron guardar opciones de tarjetas', error);
      }
    }, 300);
    modalRoot.querySelectorAll('[data-setting="bgRotationSeconds"], [data-setting="bgOpacity"], [data-setting="bgBlur"], [data-setting="bgOverlayColor"], [data-setting="bgOverlayOpacity"], [data-setting="bgGrayscale"], [data-setting="bgFadeSeconds"], [data-setting="itemBgEnabled"], [data-setting="itemBgOpacity"], [data-setting="itemBgBlur"], [data-setting="itemBgOverlayOpacity"], [data-setting="itemBgGrayscale"], [data-setting="cardRadius"], [data-setting="posterRadiusSimple"], [data-setting="posterRadiusStandard"], [data-setting="grillColorNormal"], [data-setting="grillColorHot"], [data-setting="grillColorCharred"]').forEach(node => {
      node.addEventListener('input', () => { readVisualDesignPatch(); persistVisualDesignPatch(); });
      node.addEventListener('change', () => { readVisualDesignPatch(); persistVisualDesignPatch(); });
    });
    readVisualDesignPatch();
    modalRoot.querySelector('[data-load-metadata-keys]')?.addEventListener('click', async event => {
      const out = modalRoot.querySelector('[data-metadata-keys]');
      const btn = event.currentTarget;
      btn.disabled = true;
      try {
        const response = await api('/api/items/metadata-keys');
        if (out) { out.hidden = false; out.textContent = JSON.stringify(response.keys || response, null, 2); }
      } catch (error) { ui.toast('No se pudieron cargar las claves', { detail: error.message || String(error) }); }
      finally { btn.disabled = false; }
    });
    modalRoot.querySelectorAll('[data-debug]').forEach(btn => btn.addEventListener('click', async () => {
      const kind = btn.dataset.debug === 'notification' ? 'notification' : btn.dataset.debug;
      btn.disabled = true;
      try { await api(`/api/simulate/${kind}`, { method: 'POST', body: JSON.stringify({}) }); ui.toast('Evento de prueba enviado'); }
      catch (error) { ui.toast('Error en debug', { detail: error.message || String(error) }); }
      finally { btn.disabled = false; }
    }));
    modalRoot.querySelector('[data-export-library]')?.addEventListener('click', async event => { const btn=event.currentTarget; btn.disabled=true; try { await downloadBackup('/api/backups/library?assets=1','bbqueue-library.json'); ui.toast('Biblioteca exportada'); } catch(error){ ui.toast('No se pudo exportar',{detail:error.message||String(error)}); } finally{btn.disabled=false;} });
    modalRoot.querySelector('[data-export-settings]')?.addEventListener('click', async event => { const btn=event.currentTarget; btn.disabled=true; const secrets=modalRoot.querySelector('[data-export-secrets]')?.checked?'1':'0'; try { await downloadBackup(`/api/backups/settings?secrets=${secrets}`,'bbqueue-settings.json'); ui.toast('Configuración exportada'); } catch(error){ ui.toast('No se pudo exportar',{detail:error.message||String(error)}); } finally{btn.disabled=false;} });
    modalRoot.querySelector('[data-import-library]')?.addEventListener('change', async event => { const input=event.currentTarget; try { const mode=modalRoot.querySelector('[data-library-import-mode]')?.value||'replace'; const result=await importBackup('library',input.files?.[0],mode); ui.toast('Biblioteca importada',{detail:`${result.counts?.itemRegistry?.active || result.summary?.items || 0} ítems`}); setTimeout(()=>location.reload(),700); } catch(error){ ui.toast('No se pudo importar',{detail:error.message||String(error)}); } finally{input.value='';} });
    modalRoot.querySelector('[data-import-settings]')?.addEventListener('change', async event => { const input=event.currentTarget; try { await importBackup('settings',input.files?.[0]); ui.toast('Configuración importada'); setTimeout(()=>location.reload(),700); } catch(error){ ui.toast('No se pudo importar',{detail:error.message||String(error)}); } finally{input.value='';} });
    for (const [selector,endpoint,phrase,done] of [['[data-reset-library]','/api/reset/library','BORRAR BIBLIOTECA','Biblioteca eliminada'],['[data-reset-settings]','/api/reset/settings','REINICIAR CONFIGURACION','Configuración restablecida'],['[data-reset-all]','/api/reset/all','REINICIAR TODO','BBQ restablecido']]) modalRoot.querySelector(selector)?.addEventListener('click',async event=>{ const btn=event.currentTarget; btn.disabled=true; try{await runDestructiveAction(endpoint,phrase); ui.toast(done); setTimeout(()=>location.reload(),700);}catch(error){ui.toast('Acción cancelada',{detail:error.message||String(error)});}finally{btn.disabled=false;} });
    modalRoot.querySelector('[data-refresh-css]')?.addEventListener('click', () => { refreshCustomCss(); ui.toast('CSS recargado'); });
  }, 0);
  const result = await modalPromise;
  if (!result) return;
  const { customCssText, ...settingsPatch } = result;
  settingsTrace('enviando patch', settingsPatch);
  state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(settingsPatch) });
  settingsTrace('respuesta settings', state.settings);
  await saveCustomCssText('global', customCssText).catch(debugError);
  refreshCustomCss('global');
  applyDesign(state.settings);
  views.update('database', { settings: state.settings, refresh: true });
  views.update('backlog', { settings: state.settings });
  views.update('on-deck', { settings: state.settings });
  views.update('current-content', { settings: state.settings });
  views.update('collections', { settings: state.settings });
  ui.toast('Opciones guardadas');
}

async function loadInitialSnapshot() {
  try {
    const payload = await api('/api/snapshot');
    applyState(payload);
  } catch (error) {
    debugError('No se pudo cargar snapshot inicial por HTTP', error);
  }
}

window.addEventListener('error', event => debugError('Error no controlado', { message: event.message, filename: event.filename, line: event.lineno }));
loadInitialSnapshot().finally(() => { socket.connect(); });

function escapeHtml(value) { return String(value ?? '').replace(/[&<>\'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
