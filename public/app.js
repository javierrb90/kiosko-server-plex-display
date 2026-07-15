import { SocketClient } from "/core/socket-client.js";
import { ViewManager } from "/core/view-manager.js";
import { createUi } from "/core/ui.js";
import { createBacklogView } from "/views/backlog.js";
import { createCollectionsView } from "/views/collections.js";
import { createOnDeckView } from "/views/on-deck.js";
import { createCurrentContentView } from "/views/current-content.js";

const debug = (...args) => console.log('[Kiosko UI]', ...args);
const debugError = (...args) => console.error('[Kiosko UI]', ...args);
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
const ui = createUi({ modalRoot, toastRoot: uiToastRoot });

const state = {
  settings: null,
  runtime: {},
  activeView: 'backlog',
  privacyLocked: false,
  unreadCount: 0,
  toastTimer: null,
  latestNotification: null,
  latestToastAction: null,
  notificationsOverlayOpen: false,
  overlayNotifications: [],
  notificationSourceFilter: 'all'
};

const views = new ViewManager(appRoot, { debug });

function api(path, options = {}) {
  const headers = options.body && !(options.body instanceof FormData) && !options.headers?.['Content-Type']
    ? { 'Content-Type': 'application/json', ...(options.headers || {}) }
    : options.headers || {};
  return fetch(path, { ...options, headers }).then(async res => {
    const isJson = String(res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) throw new Error(data?.error || data || `HTTP ${res.status}`);
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
  await loadOverlayNotifications().catch(debugError);
  if (markViewed) await markNotificationsViewed();
  state.notificationsOverlayOpen = true;
  notificationsOverlay.hidden = false;
  notificationsOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('notifications-overlay-open');
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
function showActionToast({ title, subtitle = '', action = null, notification = null } = {}) {
  if (!state.settings?.notifications?.toastEnabled) return;
  state.latestNotification = notification;
  state.latestToastAction = action;
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
function shouldToastCurrent(content = {}) {
  if (!content) return false;
  if (content.source === 'playnite' || content.kind === 'game' || content.event === 'game_started') return true;
  return ['play', 'start', 'playback_start'].includes(String(content.event || '').toLowerCase());
}
function showCurrentToast(content = {}) {
  if (!shouldToastCurrent(content)) return;
  const title = content?.title || 'Contenido actual';
  const prefix = content?.source === 'playnite' || content?.kind === 'game' ? 'Jugando ahora' : 'Reproduciendo';
  return showActionToast({ title: `${prefix}: ${title}`, subtitle: content?.subtitle || '', action: () => navigate('current-content', { reason: 'toast actual' }) });
}
/* legacy */

views.register(createBacklogView({ api, debug, ui, controlsRoot: viewControls }));
views.register(createOnDeckView({ api, debug, ui, controlsRoot: viewControls }));
views.register(createCurrentContentView({ api, debug, ui, controlsRoot: viewControls }));
views.register(createCollectionsView({ api, debug, ui, controlsRoot: viewControls }));

function navigate(id, { persist = true, reason = 'dock', force = false } = {}) {
  if (!id) return;
  if (state.privacyLocked && !force) return;
  state.activeView = id;
  views.show(id, { reason });
  dock.querySelectorAll('button').forEach(btn => btn.classList.toggle('dock__item--active', btn.dataset.nav === id));
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
  views.update('backlog', { backlog: payload.backlog || {}, completionRatings: payload.completionRatings || {}, onDeckMap: payload.onDeckMap || {}, settings: state.settings });
  views.update('on-deck', { onDeck: payload.onDeck || [], completionRatings: payload.completionRatings || {}, settings: state.settings });
  views.update('current-content', { currentContent: payload.currentContent || null, onDeckMap: payload.onDeckMap || {}, completionRatings: payload.completionRatings || {}, settings: state.settings });
  views.update('collections', { completions: payload.completions || [], settings: state.settings });
  const rememberedView = ['backlog', 'on-deck', 'current-content', 'collections'].includes(payload.activeView)
    ? payload.activeView
    : (['backlog', 'on-deck', 'current-content', 'collections'].includes(payload.state?.activeView)
      ? payload.state.activeView
      : (['backlog', 'on-deck', 'current-content', 'collections'].includes(state.settings?.display?.defaultView) ? state.settings.display.defaultView : 'backlog'));
  if (!views.activeId || views.activeId !== rememberedView) navigate(rememberedView, { persist: false, reason: 'vista recordada', force: true });
  if (state.privacyLocked) navigate('backlog', { persist: false, reason: 'privacy snapshot', force: true });
}

const socket = new SocketClient({
  onMessage(message) {
    debug('Mensaje WebSocket recibido', message?.type, message?.payload);
    if (message.type === 'state:snapshot') return applyState(message.payload);
    if (message.type === 'settings:update') {
      state.settings = message.payload;
      applyDesign(state.settings);
      views.update('backlog', { settings: state.settings });
      views.update('on-deck', { settings: state.settings });
      views.update('current-content', { settings: state.settings });
      views.update('collections', { settings: state.settings });
      return;
    }
    if (message.type === 'backlog:update') { views.update('backlog', { ...(message.payload || {}), settings: state.settings }); views.update('current-content', { ...(message.payload || {}) }); return; }
    if (message.type === 'on-deck:update') { views.update('on-deck', { ...(message.payload || {}), settings: state.settings }); views.update('current-content', { ...(message.payload || {}) }); return; }
    if (message.type === 'completions:update') { views.update('collections', { completions: message.payload || [], settings: state.settings }); return; }
    if (message.type === 'custom-css:update') { refreshCustomCss(message.payload?.name); return; }
    if (message.type === 'current:update') { views.update('current-content', { currentContent: message.payload }); if (message.payload) showCurrentToast(message.payload); return; }
    if (message.type === 'plex:update') { views.update('current-content', { currentContent: { ...(message.payload || {}), source: 'plex', kind: 'plex' } }); if (message.payload) showCurrentToast({ ...(message.payload || {}), source: 'plex', kind: 'plex' }); return; }
    if (message.type === 'game:update') { views.update('current-content', { currentContent: { ...(message.payload || {}), source: 'playnite', kind: 'game' } }); if (message.payload) showCurrentToast({ ...(message.payload || {}), source: 'playnite', kind: 'game' }); return; }
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
      renderNotificationsOverlay();
      updateNotificationsTrigger();
      showNotificationToast(message.payload);
      return;
    }
    if (message.type === 'view:show') {
      const id = message.payload?.id || 'backlog';
      if (id === 'notifications') { openNotificationsOverlay().catch(debugError); return; }
      closeNotificationsOverlay();
      navigate(id, { persist: false, reason: message.payload?.reason || 'servidor' });
    }
  },
  onOpen() { debug('WebSocket conectado'); },
  onClose() { debug('WebSocket desconectado; se reintentará la conexión'); },
  onError(event) { debugError('Error de WebSocket', event); }
});

dock.addEventListener('click', event => {
  const btn = event.target.closest('button[data-nav]');
  if (!btn) return;
  closeNotificationsOverlay();
  navigate(btn.dataset.nav, { reason: 'dock' });
});
notificationsTrigger?.addEventListener('click', event => { event.stopPropagation(); openNotificationsOverlay().catch(debugError); });
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
async function downloadExport() {
  const response = await fetch('/api/export');
  if (!response.ok) throw new Error('No se pudo exportar el backup');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const contentDisposition = response.headers.get('content-disposition') || '';
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  const fileName = match?.[1] || `kiosko-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
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
        ['general','General'], ['design','Visual'], ['sources','Fuentes'], ['notifications','Avisos'], ['plex','Plex'], ['data','Datos'], ['debug','Debug'], ['css','CSS']
      ].map(([id,label], index) => `<button type="button" data-settings-tab="${id}" class="${index === 0 ? 'is-active' : ''}">${label}</button>`).join('')}
    </nav>
    <div class="settings-tabs__panels">
      <section data-settings-panel="general" class="settings-tab-panel is-active"><h3>General</h3>
        <label class="ui-field"><span>Vista inicial</span><select data-setting="defaultView"><option value="backlog" ${selected('backlog', s.display?.defaultView)}>Backlog</option><option value="on-deck" ${selected('on-deck', s.display?.defaultView)}>On Deck</option><option value="current-content" ${selected('current-content', s.display?.defaultView)}>Actual</option><option value="collections" ${selected('collections', s.display?.defaultView)}>Colecciones</option></select></label>
        <label class="ui-field"><span>Items por página · Backlog</span><input data-setting="backlogItemsPerPage" type="number" min="1" max="60" value="${escapeAttr(s.views?.backlog?.itemsPerPage || 12)}"></label>
        <label class="ui-field"><span>Items por página · On Deck</span><input data-setting="onDeckItemsPerPage" type="number" min="1" max="120" value="${escapeAttr(s.views?.onDeck?.itemsPerPage || 12)}"></label>
        <label class="ui-field"><span>Items por página · Colecciones</span><input data-setting="collectionsItemsPerPage" type="number" min="1" max="120" value="${escapeAttr(s.views?.collections?.itemsPerPage || 12)}"></label>
      </section>
      <section data-settings-panel="design" class="settings-tab-panel"><h3>Visual</h3>
        <div class="settings-fieldset"><h4>Colores</h4>
          ${colorField('accentColor', 'Color de acento', s.design?.accentColor || '#8fafef')}
          ${colorField('sourceColorPlex', 'Plex', sourceColors.plex || '#8fafef')}
          ${colorField('sourceColorPlaynite', 'Playnite', sourceColors.playnite || '#8fe1b5')}
          ${colorField('sourceColorOther', 'Otros', sourceColors.other || '#d8b4fe')}
        </div>
        <div class="settings-fieldset"><h4>Fondo de vistas</h4>
          <label class="ui-field"><span>Rotación cada segundos</span><input data-setting="bgRotationSeconds" type="range" min="3" max="120" step="1" value="${escapeAttr(bg.rotationSeconds || 12)}"></label>
          <label class="ui-field"><span>Opacidad del fondo</span><input data-setting="bgOpacity" type="range" min="0" max="1" step="0.01" value="${escapeAttr(bg.opacity ?? 0.28)}"></label>
          <label class="ui-field"><span>Blur del fondo</span><input data-setting="bgBlur" type="range" min="0" max="48" step="1" value="${escapeAttr(bg.blur ?? 18)}"></label>
          <label class="ui-field"><span>Oscurecimiento del fondo</span><input data-setting="bgOverlayOpacity" type="range" min="0" max="1" step="0.01" value="${escapeAttr(bg.overlayOpacity ?? 0.76)}"></label>
          <label class="ui-field"><span>Blanco y negro del fondo</span><input data-setting="bgGrayscale" type="range" min="0" max="100" step="1" value="${escapeAttr(bg.grayscale ?? 0)}"></label>
          ${colorField('bgOverlayColor', 'Color de capa', bg.overlayColor || '#05070c')}
          <label class="ui-field"><span>Fade entre fondos</span><input data-setting="bgFadeSeconds" type="range" min="0" max="5" step="0.05" value="${escapeAttr(bg.fadeSeconds ?? 1.2)}"></label>
        </div>
        <div class="settings-fieldset"><h4>Tarjetas</h4>
          <label class="ui-check"><input type="checkbox" data-setting="itemBgEnabled" ${checked(itemBg.enabled !== false)}> Usar backdrop dentro de cada item</label>
          <label class="ui-field"><span>Opacidad del backdrop</span><input data-setting="itemBgOpacity" type="range" min="0" max="1" step="0.01" value="${escapeAttr(itemBg.opacity ?? 0.32)}"></label>
          <label class="ui-field"><span>Blur del backdrop</span><input data-setting="itemBgBlur" type="range" min="0" max="36" step="1" value="${escapeAttr(itemBg.blur ?? 12)}"></label>
          <label class="ui-field"><span>Oscurecimiento de tarjeta</span><input data-setting="itemBgOverlayOpacity" type="range" min="0" max="1" step="0.01" value="${escapeAttr(itemBg.overlayOpacity ?? 0.72)}"></label>
          <label class="ui-field"><span>Blanco y negro del backdrop</span><input data-setting="itemBgGrayscale" type="range" min="0" max="100" step="1" value="${escapeAttr(itemBg.grayscale ?? 0)}"></label>
          <label class="ui-field"><span>Radio de borde</span><input data-setting="cardRadius" type="range" min="0" max="32" step="1" value="${escapeAttr(cards.radius ?? 18)}"></label>
        </div>
        <div class="settings-fieldset"><h4>Escala</h4>
          <label class="ui-field"><span>Tamaño de fuente</span><select data-setting="fontScale"><option value="small" ${selected('small', s.design?.fontScale)}>Pequeño</option><option value="medium" ${selected('medium', s.design?.fontScale)}>Medio</option><option value="large" ${selected('large', s.design?.fontScale)}>Grande</option></select></label>
          <label class="ui-field"><span>Densidad UI</span><select data-setting="density"><option value="compact" ${selected('compact', s.design?.density)}>Compacta</option><option value="comfortable" ${selected('comfortable', s.design?.density)}>Cómoda</option><option value="large" ${selected('large', s.design?.density)}>Grande</option></select></label>
          <label class="ui-field"><span>Tamaño Backlog</span><select data-setting="backlogSize"><option value="small" ${selected('small', s.views?.backlog?.cardSize)}>Pequeño</option><option value="medium" ${selected('medium', s.views?.backlog?.cardSize)}>Medio</option><option value="large" ${selected('large', s.views?.backlog?.cardSize)}>Grande</option></select></label>
          <label class="ui-field"><span>Tamaño On Deck</span><select data-setting="onDeckSize"><option value="small" ${selected('small', s.views?.onDeck?.cardSize)}>Pequeño</option><option value="medium" ${selected('medium', s.views?.onDeck?.cardSize)}>Medio</option><option value="large" ${selected('large', s.views?.onDeck?.cardSize)}>Grande</option></select></label>
          <label class="ui-field"><span>Tamaño Colecciones</span><select data-setting="collectionsSize"><option value="small" ${selected('small', s.views?.collections?.cardSize)}>Pequeño</option><option value="medium" ${selected('medium', s.views?.collections?.cardSize)}>Medio</option><option value="large" ${selected('large', s.views?.collections?.cardSize)}>Grande</option></select></label>
        </div>
      </section>
      <section data-settings-panel="sources" class="settings-tab-panel"><h3>Fuentes del Backlog</h3>
        <label class="ui-check"><input type="checkbox" data-setting="plexRecentlyAdded" ${checked(s.backlog?.sources?.plexRecentlyAdded !== false)}> Plex · nuevo contenido añadido</label>
        <label class="ui-check"><input type="checkbox" data-setting="plexPlayback" ${checked(s.backlog?.sources?.plexPlayback === true)}> Plex · contenido reproducido</label>
        <label class="ui-check"><input type="checkbox" data-setting="playniteStarted" ${checked(s.backlog?.sources?.playniteStarted !== false)}> Playnite · juegos lanzados</label>
      </section>
      <section data-settings-panel="notifications" class="settings-tab-panel"><h3>Notificaciones</h3>
        <label class="ui-check"><input type="checkbox" data-setting="toastEnabled" ${checked(s.notifications?.toastEnabled !== false)}> Mostrar toast</label>
        <label class="ui-check"><input type="checkbox" data-setting="soundEnabled" ${checked(s.notifications?.soundEnabled === true)}> Sonido</label>
        <label class="ui-field"><span>Tamaño toast</span><select data-setting="toastSize"><option value="small" ${selected('small', s.notifications?.toastSize)}>Pequeño</option><option value="medium" ${selected('medium', s.notifications?.toastSize)}>Medio</option><option value="large" ${selected('large', s.notifications?.toastSize)}>Grande</option></select></label>
      </section>
      <section data-settings-panel="plex" class="settings-tab-panel"><h3>Plex</h3>
        <label class="ui-field"><span>URL</span><input data-setting="plexUrl" type="text" value="${escapeAttr(s.plex?.url || '')}" placeholder="http://IP:32400"></label>
        <label class="ui-field"><span>Token</span><input data-setting="plexToken" type="password" value="${escapeAttr(s.plex?.token || '')}"></label>
      </section>
      <section data-settings-panel="data" class="settings-tab-panel"><h3>Datos y mantenimiento</h3>
        <div class="settings-actions-grid">
          <button type="button" class="ui-action-button" data-export-backup>Exportar backup</button>
          <button type="button" class="ui-action-button" data-refresh-css>Recargar CSS</button>
        </div>
        <p class="settings-help">El backup incluye ajustes, estado, backlog, colecciones, notificaciones y CSS global.</p>
      </section>
      <section data-settings-panel="debug" class="settings-tab-panel"><h3>Debug</h3>
        <div class="debug-actions"><button type="button" data-debug="notification">Notificación</button><button type="button" data-debug="plex">Plex</button><button type="button" data-debug="game">Playnite</button></div>
        <p class="settings-help">Los botones lanzan eventos de prueba sin cerrar las opciones.</p>
      </section>
      <section data-settings-panel="css" class="settings-tab-panel"><h3>CSS personalizado</h3>
        <label class="ui-field"><span>CSS global</span><textarea data-setting="customCss" rows="10" spellcheck="false">${escapeHtml(customCss)}</textarea></label>
      </section>
    </div>
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
          design: {
            accentColor: get('accentColor')?.value || '#8fafef',
            fontScale: get('fontScale')?.value || 'medium',
            density: get('density')?.value || 'comfortable',
            sourceColors: {
              plex: get('sourceColorPlex')?.value || '#8fafef',
              playnite: get('sourceColorPlaynite')?.value || '#8fe1b5',
              other: get('sourceColorOther')?.value || '#d8b4fe'
            },
            cards: {
              backdropOpacity: Number(get('cardBackdropOpacity')?.value ?? 0.33),
              backdropBlur: Number(get('cardBackdropBlur')?.value || 14),
              overlayOpacity: Number(get('cardOverlayOpacity')?.value ?? 0.72),
              showSourceText: get('showSourceText')?.checked === true
            },
            background: {
              rotationSeconds: Number(get('bgRotationSeconds')?.value || 12),
              opacity: Number(get('bgOpacity')?.value ?? 0.28),
              blur: Number(get('bgBlur')?.value || 18),
              overlayColor: get('bgOverlayColor')?.value || '#05070c',
              fadeSeconds: Number(get('bgFadeSeconds')?.value ?? 0.75)
            }
          },
          views: {
            backlog: { cardSize: get('backlogSize')?.value || 'medium', itemsPerPage: Number(get('backlogItemsPerPage')?.value || 12) },
            onDeck: { cardSize: get('onDeckSize')?.value || 'medium', itemsPerPage: Number(get('onDeckItemsPerPage')?.value || 12) },
            collections: { cardSize: get('collectionsSize')?.value || 'medium', itemsPerPage: Number(get('collectionsItemsPerPage')?.value || 12) }
          },
          backlog: { sources: { plexRecentlyAdded: get('plexRecentlyAdded')?.checked, plexPlayback: get('plexPlayback')?.checked, playniteStarted: get('playniteStarted')?.checked } },
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
    modalRoot.querySelectorAll('[data-settings-tab]').forEach(btn => btn.addEventListener('click', () => {
      const tab = btn.dataset.settingsTab;
      modalRoot.querySelectorAll('[data-settings-tab]').forEach(node => node.classList.toggle('is-active', node === btn));
      modalRoot.querySelectorAll('[data-settings-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.settingsPanel === tab));
    }));
    bindColorFieldPreviews(modalRoot);
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
          cards: {
            radius: Number(root.querySelector('[data-setting="cardRadius"]')?.value ?? 18)
          }
        }
      };
      settingsTrace('controles visuales', {
        ...patch.design.itemBackground,
        radius: patch.design.cards.radius,
        countItemBgOpacity: root.querySelectorAll('[data-setting="itemBgOpacity"]').length,
        countCardRadius: root.querySelectorAll('[data-setting="cardRadius"]').length
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
      } catch (error) {
        debugError('No se pudieron guardar opciones de tarjetas', error);
      }
    }, 300);
    modalRoot.querySelectorAll('[data-setting="bgRotationSeconds"], [data-setting="bgOpacity"], [data-setting="bgBlur"], [data-setting="bgOverlayColor"], [data-setting="bgOverlayOpacity"], [data-setting="bgGrayscale"], [data-setting="bgFadeSeconds"], [data-setting="itemBgEnabled"], [data-setting="itemBgOpacity"], [data-setting="itemBgBlur"], [data-setting="itemBgOverlayOpacity"], [data-setting="itemBgGrayscale"], [data-setting="cardRadius"]').forEach(node => {
      node.addEventListener('input', () => { readVisualDesignPatch(); persistVisualDesignPatch(); });
      node.addEventListener('change', () => { readVisualDesignPatch(); persistVisualDesignPatch(); });
    });
    readVisualDesignPatch();
    modalRoot.querySelectorAll('[data-debug]').forEach(btn => btn.addEventListener('click', async () => {
      const kind = btn.dataset.debug === 'notification' ? 'notification' : btn.dataset.debug;
      btn.disabled = true;
      try { await api(`/api/simulate/${kind}`, { method: 'POST', body: JSON.stringify({}) }); ui.toast('Evento de prueba enviado'); }
      catch (error) { ui.toast('Error en debug', { detail: error.message || String(error) }); }
      finally { btn.disabled = false; }
    }));
    modalRoot.querySelector('[data-export-backup]')?.addEventListener('click', async event => {
      const btn = event.currentTarget;
      btn.disabled = true;
      try { await downloadExport(); ui.toast('Backup exportado'); }
      catch (error) { ui.toast('No se pudo exportar', { detail: error.message || String(error) }); }
      finally { btn.disabled = false; }
    });
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
loadInitialSnapshot().finally(() => socket.connect());

function escapeHtml(value) { return String(value ?? '').replace(/[&<>\'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
