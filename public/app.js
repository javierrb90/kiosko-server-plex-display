import { SocketClient } from "/core/socket-client.js";
import { ViewManager } from "/core/view-manager.js";
import { createUi } from "/core/ui.js";
import { createBacklogView } from "/views/backlog.js";
import { createCurrentContentView } from "/views/current-content.js";
import { createCollectionsView } from "/views/collections.js";

const debug = (...args) => console.log('[Kiosko UI]', ...args);
const debugError = (...args) => console.error('[Kiosko UI]', ...args);

const appRoot = document.getElementById('app');
const dock = document.getElementById('dock');
const toast = document.getElementById('toast');
const notificationsTrigger = document.getElementById('notifications-trigger');
const notificationsBadge = document.querySelector('[data-notifications-badge]');
const notificationsOverlay = document.getElementById('notifications-overlay');
const notificationsOverlayList = document.querySelector('[data-notifications-overlay-list]');
const notificationsOverlayCount = document.querySelector('[data-notifications-overlay-count]');
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
  notificationsOverlayOpen: false,
  overlayNotifications: []
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


function applyDesign(settings = {}) {
  const design = settings.design || {};
  const accent = /^#[0-9a-f]{6}$/i.test(design.accentColor || '') ? design.accentColor : '#8fafef';
  document.documentElement.style.setProperty('--accent-color', accent);
  document.documentElement.dataset.fontScale = ['small','medium','large'].includes(design.fontScale) ? design.fontScale : 'medium';
  document.documentElement.dataset.density = ['compact','comfortable','large'].includes(design.density) ? design.density : 'comfortable';
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
  if (key.includes('sonarr')) return `<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5V4Zm2 2v3h10V6H7Zm0 5v3h10v-3H7Zm0 5v2h10v-2H7Z"/></svg>`;
  if (key.includes('radarr')) return `<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4V6Zm3 2-1 2h3l1-2H7Zm5 0-1 2h3l1-2h-3Zm5 0-1 2h2v-2h-1ZM7 13v3h10v-3H7Z"/></svg>`;
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
function renderNotificationsOverlay() {
  if (!notificationsOverlayList) return;
  const items = (state.overlayNotifications || []).slice(0, 50);
  if (notificationsOverlayCount) notificationsOverlayCount.textContent = items.length ? `${items.length} recientes` : 'Sin actividad reciente';
  if (!items.length) {
    notificationsOverlayList.innerHTML = `<div class="notifications-panel__empty">No hay notificaciones recientes.</div>`;
    return;
  }
  notificationsOverlayList.innerHTML = items.map(item => `<article class="overlay-notification ${item.unread ? 'overlay-notification--unread' : ''}">
    <div class="overlay-notification__icon" aria-hidden="true">${notificationIcon(item)}</div>
    <div class="overlay-notification__copy"><h2>${escapeHtml(item.title || 'Nueva notificación')}</h2><p>${escapeHtml(item.subtitle || item.type || item.source || '')}</p><time>${escapeHtml(relativeTime(item.createdAt))}</time></div>
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
function showNotificationToast(notification) {
  if (!state.settings?.notifications?.toastEnabled) return;
  state.latestNotification = notification;
  clearTimeout(state.toastTimer);
  toast.hidden = false;
  toast.classList.remove('event-toast--small', 'event-toast--medium', 'event-toast--large');
  const size = state.settings?.notifications?.toastSize || 'medium';
  toast.classList.add(`event-toast--${['small','medium','large'].includes(size) ? size : 'medium'}`);
  toast.innerHTML = state.privacyLocked
    ? `<strong>Nueva notificación</strong><span>Actividad recibida</span>`
    : `<strong>${escapeHtml(notification.title || 'Nueva notificación')}</strong><span>${escapeHtml(notification.subtitle || notification.source || '')}</span>`;
  toast.classList.add('event-toast--visible');
  playNotificationSound();
  const seconds = Number(state.settings?.notifications?.toastDurationSeconds || 6);
  state.toastTimer = setTimeout(() => toast.classList.remove('event-toast--visible'), seconds * 1000);
}

views.register(createBacklogView({ api, debug, ui, controlsRoot: viewControls }));
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
  views.update('backlog', { backlog: payload.backlog || {}, completionRatings: payload.completionRatings || {}, settings: state.settings });
  views.update('current-content', Object.prototype.hasOwnProperty.call(payload, 'currentContent') ? payload.currentContent : (payload.current || payload.game || payload.plex));
  views.update('collections', { completions: payload.completions || [], settings: state.settings });
  const fallbackView = ['backlog', 'current-content', 'collections'].includes(state.settings?.display?.defaultView) ? state.settings.display.defaultView : 'backlog';
  if (!views.activeId) navigate(fallbackView, { persist: false, reason: 'vista inicial configurada', force: true });
  if (state.privacyLocked) navigate('backlog', { persist: false, reason: 'privacy snapshot', force: true });
}

const socket = new SocketClient({
  onMessage(message) {
    debug('Mensaje WebSocket recibido', message?.type, message?.payload);
    if (message.type === 'state:snapshot') return applyState(message.payload);
    if (message.type === 'settings:update') { state.settings = message.payload; applyDesign(state.settings); views.update('backlog', { settings: state.settings }); views.update('collections', { settings: state.settings }); return; }
    if (message.type === 'backlog:update') { views.update('backlog', { ...(message.payload || {}), settings: state.settings }); return; }
    if (message.type === 'completions:update') { views.update('collections', { completions: message.payload || [], settings: state.settings }); return; }
    if (message.type === 'custom-css:update') { refreshCustomCss(message.payload?.name); return; }
    if (message.type === 'current:update') { views.update('current-content', message.payload); return; }
    if (message.type === 'plex:update') { views.update('current-content', { ...(message.payload || {}), source: 'plex', kind: 'plex' }); return; }
    if (message.type === 'game:update') { views.update('current-content', { ...(message.payload || {}), source: 'playnite', kind: 'game' }); return; }
    if (message.type === 'notifications:cleared') { state.overlayNotifications = []; state.unreadCount = 0; renderNotificationsOverlay(); updateNotificationsTrigger(); return; }
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
toast.addEventListener('click', () => { if (!state.privacyLocked) { toast.classList.remove('event-toast--visible'); openNotificationsOverlay().catch(debugError); } });
notificationsOverlay.addEventListener('click', event => {
  if (event.target.closest('[data-close-notifications]')) closeNotificationsOverlay();
  if (event.target.closest('[data-clear-notifications]')) {
    api('/api/notifications', { method: 'DELETE' }).then(() => {
      state.overlayNotifications = [];
      state.unreadCount = 0;
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

async function openSettingsModal() {
  const s = state.settings || await api('/api/settings');
  const customCss = await loadCustomCssText('global').catch(() => '');
  const checked = value => value ? 'checked' : '';
  const selected = (value, current) => value === current ? 'selected' : '';
  const body = `<div class="settings-modal-grid settings-modal-grid--v54">
    <section><h3>General</h3>
      <label class="ui-field"><span>Vista inicial</span><select data-setting="defaultView"><option value="backlog" ${selected('backlog', s.display?.defaultView)}>Backlog</option><option value="current-content" ${selected('current-content', s.display?.defaultView)}>Actual</option><option value="collections" ${selected('collections', s.display?.defaultView)}>Colecciones</option></select></label>
      <label class="ui-field"><span>Items por página · Backlog</span><input data-setting="backlogItemsPerPage" type="number" min="1" max="60" value="${escapeAttr(s.views?.backlog?.itemsPerPage || 12)}"></label>
      <label class="ui-field"><span>Items por página · Colecciones</span><input data-setting="collectionsItemsPerPage" type="number" min="1" max="120" value="${escapeAttr(s.views?.collections?.itemsPerPage || 12)}"></label>
    </section>
    <section><h3>Diseño</h3>
      <label class="ui-field"><span>Color de acento</span><input data-setting="accentColor" type="color" value="${escapeAttr(s.design?.accentColor || '#8fafef')}"></label>
      <label class="ui-field"><span>Tamaño de fuente</span><select data-setting="fontScale"><option value="small" ${selected('small', s.design?.fontScale)}>Pequeño</option><option value="medium" ${selected('medium', s.design?.fontScale)}>Medio</option><option value="large" ${selected('large', s.design?.fontScale)}>Grande</option></select></label>
      <label class="ui-field"><span>Densidad UI</span><select data-setting="density"><option value="compact" ${selected('compact', s.design?.density)}>Compacta</option><option value="comfortable" ${selected('comfortable', s.design?.density)}>Cómoda</option><option value="large" ${selected('large', s.design?.density)}>Grande</option></select></label>
      <label class="ui-field"><span>Tamaño Backlog</span><select data-setting="backlogSize"><option value="small" ${selected('small', s.views?.backlog?.cardSize)}>Pequeño</option><option value="medium" ${selected('medium', s.views?.backlog?.cardSize)}>Medio</option><option value="large" ${selected('large', s.views?.backlog?.cardSize)}>Grande</option></select></label>
      <label class="ui-field"><span>Tamaño Colecciones</span><select data-setting="collectionsSize"><option value="small" ${selected('small', s.views?.collections?.cardSize)}>Pequeño</option><option value="medium" ${selected('medium', s.views?.collections?.cardSize)}>Medio</option><option value="large" ${selected('large', s.views?.collections?.cardSize)}>Grande</option></select></label>
    </section>
    <section><h3>Fuentes del Backlog</h3>
      <label class="ui-check"><input type="checkbox" data-setting="plexRecentlyAdded" ${checked(s.backlog?.sources?.plexRecentlyAdded !== false)}> Plex · nuevo contenido añadido</label>
      <label class="ui-check"><input type="checkbox" data-setting="plexPlayback" ${checked(s.backlog?.sources?.plexPlayback === true)}> Plex · contenido reproducido</label>
      <label class="ui-check"><input type="checkbox" data-setting="playniteStarted" ${checked(s.backlog?.sources?.playniteStarted !== false)}> Playnite · juegos lanzados</label>
    </section>
    <section><h3>Notificaciones</h3>
      <label class="ui-check"><input type="checkbox" data-setting="toastEnabled" ${checked(s.notifications?.toastEnabled !== false)}> Mostrar toast</label>
      <label class="ui-check"><input type="checkbox" data-setting="soundEnabled" ${checked(s.notifications?.soundEnabled === true)}> Sonido</label>
      <label class="ui-field"><span>Tamaño toast</span><select data-setting="toastSize"><option value="small" ${selected('small', s.notifications?.toastSize)}>Pequeño</option><option value="medium" ${selected('medium', s.notifications?.toastSize)}>Medio</option><option value="large" ${selected('large', s.notifications?.toastSize)}>Grande</option></select></label>
    </section>
    <section><h3>Plex</h3>
      <label class="ui-field"><span>URL</span><input data-setting="plexUrl" type="text" value="${escapeAttr(s.plex?.url || '')}" placeholder="http://IP:32400"></label>
      <label class="ui-field"><span>Token</span><input data-setting="plexToken" type="password" value="${escapeAttr(s.plex?.token || '')}"></label>
    </section>
    <section><h3>Debug</h3>
      <div class="debug-actions">
        <button type="button" data-debug="notification">Notificación</button>
        <button type="button" data-debug="plex">Plex</button>
        <button type="button" data-debug="game">Playnite</button>
      </div>
      <p class="settings-help">Los botones lanzan eventos de prueba sin cerrar las opciones.</p>
    </section>
    <section class="settings-modal-grid__wide"><h3>CSS personalizado</h3>
      <label class="ui-field"><span>CSS global</span><textarea data-setting="customCss" rows="8" spellcheck="false">${escapeHtml(customCss)}</textarea></label>
    </section>
  </div>`;
  const modalPromise = ui.open({
    title: 'Opciones',
    className: 'ui-modal-root--settings',
    body,
    actions: [
      { label: 'Cancelar', value: null },
      { label: 'Guardar', variant: 'primary', onClick: root => {
        const get = name => root.querySelector(`[data-setting="${name}"]`);
        return {
          display: { defaultView: get('defaultView')?.value || 'backlog' },
          design: { accentColor: get('accentColor')?.value || '#8fafef', fontScale: get('fontScale')?.value || 'medium', density: get('density')?.value || 'comfortable' },
          views: {
            backlog: { cardSize: get('backlogSize')?.value || 'medium', itemsPerPage: Number(get('backlogItemsPerPage')?.value || 12) },
            collections: { cardSize: get('collectionsSize')?.value || 'medium', itemsPerPage: Number(get('collectionsItemsPerPage')?.value || 12) }
          },
          backlog: { sources: { plexRecentlyAdded: get('plexRecentlyAdded')?.checked, plexPlayback: get('plexPlayback')?.checked, playniteStarted: get('playniteStarted')?.checked } },
          notifications: { toastEnabled: get('toastEnabled')?.checked, soundEnabled: get('soundEnabled')?.checked, toastSize: get('toastSize')?.value || 'medium' },
          plex: { url: get('plexUrl')?.value || '', token: get('plexToken')?.value || '' },
          customCssText: get('customCss')?.value || ''
        };
      }}
    ]
  });
  setTimeout(() => {
    modalRoot.querySelectorAll('[data-debug]').forEach(btn => btn.addEventListener('click', async () => {
      const kind = btn.dataset.debug === 'notification' ? 'notification' : btn.dataset.debug;
      btn.disabled = true;
      try { await api(`/api/simulate/${kind}`, { method: 'POST', body: JSON.stringify({}) }); ui.toast('Evento de prueba enviado'); }
      catch (error) { ui.toast('Error en debug', { detail: error.message || String(error) }); }
      finally { btn.disabled = false; }
    }));
  }, 0);
  const result = await modalPromise;
  if (!result) return;
  const { customCssText, ...settingsPatch } = result;
  state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(settingsPatch) });
  await saveCustomCssText('global', customCssText).catch(debugError);
  refreshCustomCss('global');
  applyDesign(state.settings);
  views.update('backlog', { settings: state.settings });
  views.update('collections', { settings: state.settings });
  ui.toast('Opciones guardadas');
}

window.addEventListener('error', event => debugError('Error no controlado', { message: event.message, filename: event.filename, line: event.lineno }));
socket.connect();

function escapeHtml(value) { return String(value ?? '').replace(/[&<>\'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
