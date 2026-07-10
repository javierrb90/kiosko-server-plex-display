let settings = null;
let collections = [];
let wallpapers = [];
let editingItem = null;

async function api(path, options = {}) {
  const headers = options.body && !options.headers?.['Content-Type'] ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers || {};
  const res = await fetch(path, { ...options, headers });
  const isJson = String(res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || data || `HTTP ${res.status}`);
  return data;
}
function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}
function $(id) { return document.getElementById(id); }
function setStatus(id, msg) { const el = $(id); if (el) el.textContent = msg; }
function checked(id, value) { $(id).checked = Boolean(value); }
function value(id, next) { $(id).value = next ?? ''; }
function pct(value, fallback = 0) { const n = Number(value); if (!Number.isFinite(n)) return fallback; return n <= 1 ? Math.round(n * 100) : Math.round(n); }
function fromPct(id) { return Math.max(0, Math.min(100, Number($(id).value) || 0)) / 100; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }

function activeTab(name) {
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-active', b.dataset.tab === name));
  document.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('is-active', p.dataset.panel === name));
}
document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => activeTab(btn.dataset.tab)));

async function loadAll() {
  settings = await api('/api/settings');
  collections = await api('/api/collections');
  wallpapers = await api('/api/wallpapers');
  renderSettings(); renderCollections(); renderWallpapers();
}
function renderSettings() {
  const s = settings;
  value('plex-url', s.plex?.url || ''); value('plex-token', s.plex?.token || '');
  checked('toast-enabled', s.notifications?.toastEnabled !== false); value('toast-duration', s.notifications?.toastDurationSeconds || 6);
  value('toast-size', s.notifications?.toastSize || 'large');
  checked('notification-sound', s.notifications?.soundEnabled);
  value('notification-volume', pct(s.notifications?.soundVolume ?? 0.35, 35));
  checked('allow-gifs', s.wallpapers?.allowGifs !== false); checked('allow-videos', s.wallpapers?.allowVideos !== false); checked('allow-video-audio', s.wallpapers?.allowVideoAudio !== false);
  value('wallpaper-interval', s.dashboard?.wallpaperIntervalSeconds || 35); value('wallpaper-fade', s.dashboard?.wallpaperFadeSeconds ?? 1);
  checked('wallpaper-motion', s.dashboard?.wallpaperMotion !== false); checked('show-progress', s.dashboard?.showProgressBar !== false); value('progress-opacity', pct(s.dashboard?.progressBarOpacity ?? .75, 75));
  checked('video-audio-global', s.dashboard?.videoAudioGlobalEnabled !== false); checked('video-default-muted', s.dashboard?.videoAudioDefaultMuted !== false);
  checked('dim-enabled', s.display?.dimEnabled !== false); value('dock-position', s.display?.dockPosition || 'bottom'); checked('dock-autohide', s.display?.dockAutoHide !== false); value('dock-seconds', s.display?.dockAutoHideSeconds || 4);
  const by = s.display?.dimByView || {};
  value('dim-dashboard', pct(by.dashboard?.opacity ?? .45, 45)); value('dim-dashboard-time', by.dashboard?.afterSeconds || 45);
  value('dim-current', pct(by['current-content']?.opacity ?? by['plex-now-playing']?.opacity ?? by['game-now-playing']?.opacity ?? .75, 75)); value('dim-current-time', by['current-content']?.afterSeconds || by['plex-now-playing']?.afterSeconds || by['game-now-playing']?.afterSeconds || 30);
  value('dim-collections', pct(by.collections?.opacity ?? .25, 25)); value('dim-collections-time', by.collections?.afterSeconds || 60);
  checked('source-wallpapers', s.dashboard?.sources?.wallpapers !== false);
  renderDashboardSources();
}
function renderDashboardSources() {
  const selected = new Set(settings.dashboard?.sources?.collections || []);
  $('dashboard-source-collections').innerHTML = collections.map(c => `<label class="check-line"><input type="checkbox" data-source-collection="${c.id}" ${selected.has(c.id) || c.dashboardEnabled ? 'checked' : ''}> ${escapeHtml(c.name)} <small>(${c.items?.length || 0})</small></label>`).join('') || '<p>No hay colecciones.</p>';
}
function patchFromGeneral() { return { notifications: { toastEnabled: $('toast-enabled').checked, toastDurationSeconds: Number($('toast-duration').value), toastSize: $('toast-size').value, soundEnabled: $('notification-sound').checked, soundVolume: fromPct('notification-volume') }, wallpapers: { allowGifs: $('allow-gifs').checked, allowVideos: $('allow-videos').checked, allowVideoAudio: $('allow-video-audio').checked } }; }
function patchFromDashboard() { return { dashboard: { wallpaperIntervalSeconds: Number($('wallpaper-interval').value), wallpaperFadeSeconds: Number($('wallpaper-fade').value), wallpaperMotion: $('wallpaper-motion').checked, showProgressBar: $('show-progress').checked, progressBarOpacity: fromPct('progress-opacity'), videoAudioGlobalEnabled: $('video-audio-global').checked, videoAudioDefaultMuted: $('video-default-muted').checked, sources: { wallpapers: $('source-wallpapers').checked, collections: [...document.querySelectorAll('[data-source-collection]:checked')].map(i => i.dataset.sourceCollection) } } }; }
function patchFromDisplay() { return { display: { dimEnabled: $('dim-enabled').checked, dockPosition: $('dock-position').value, dockAutoHide: $('dock-autohide').checked, dockAutoHideSeconds: Number($('dock-seconds').value), dimByView: { dashboard: { enabled: true, opacity: fromPct('dim-dashboard'), afterSeconds: Number($('dim-dashboard-time').value) }, 'current-content': { enabled: true, opacity: fromPct('dim-current'), afterSeconds: Number($('dim-current-time').value) }, collections: { enabled: true, opacity: fromPct('dim-collections'), afterSeconds: Number($('dim-collections-time').value) } } } }; }
function patchFromPlex() { return { plex: { url: $('plex-url').value.trim(), token: $('plex-token').value.trim() } }; }
async function savePatch(patch, label='Ajustes guardados.') { settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }); renderSettings(); setStatus('settings-status', label); }
$('save-settings-general').addEventListener('click', () => savePatch(patchFromGeneral()).catch(e => setStatus('settings-status', e.message)));
$('save-settings-dashboard').addEventListener('click', () => savePatch(patchFromDashboard()).catch(e => setStatus('settings-status', e.message)));
$('save-settings-display').addEventListener('click', () => savePatch(patchFromDisplay()).catch(e => setStatus('settings-status', e.message)));
$('save-settings-plex').addEventListener('click', () => savePatch(patchFromPlex(), 'Plex guardado.').catch(e => setStatus('settings-status', e.message)));

function renderWallpapers() {
  $('wallpaper-list').innerHTML = wallpapers.map(w => `<article class="asset-card">
    ${w.type === 'video' ? `<video src="${w.assetPath}" muted></video>` : `<img src="${w.assetPath}" alt="">`}
    <div><strong>${escapeHtml(w.title || 'Wallpaper')}</strong><small>${escapeHtml(w.type || 'image')} · ${escapeHtml(w.source || '')}</small>
    <label class="check-line"><input type="checkbox" data-audio-wallpaper="${w.id}" ${w.audioEnabled ? 'checked' : ''} ${w.type !== 'video' ? 'disabled' : ''}> Audio</label>
    <label class="check-line"><input type="checkbox" data-finish-wallpaper="${w.id}" ${w.finishBeforeNext ? 'checked' : ''} ${w.type !== 'video' ? 'disabled' : ''}> Esperar fin</label>
    <button data-delete-wallpaper="${w.id}" class="danger">Eliminar</button></div>
  </article>`).join('') || '<p>No hay wallpapers.</p>';
}
$('wallpaper-list').addEventListener('click', async e => {
  const del = e.target.closest('[data-delete-wallpaper]'); if (!del) return;
  if (!confirm('¿Eliminar wallpaper?')) return;
  await api(`/api/wallpapers/${del.dataset.deleteWallpaper}`, { method: 'DELETE' });
  wallpapers = await api('/api/wallpapers'); renderWallpapers();
});
$('wallpaper-list').addEventListener('change', async e => {
  const input = e.target.closest('[data-audio-wallpaper], [data-finish-wallpaper]'); if (!input) return;
  const id = input.dataset.audioWallpaper || input.dataset.finishWallpaper;
  const patch = input.dataset.audioWallpaper ? { audioEnabled: input.checked } : { finishBeforeNext: input.checked };
  await api(`/api/wallpapers/${id}`, { method:'PATCH', body: JSON.stringify(patch) });
  wallpapers = await api('/api/wallpapers'); renderWallpapers();
});
$('upload-wallpaper').addEventListener('click', async () => {
  try {
    const file = $('wallpaper-file').files[0]; if (!file) return setStatus('wallpaper-status', 'Selecciona un archivo.');
    const media = await fileToDataUri(file);
    await api('/api/wallpapers', { method:'POST', body: JSON.stringify({ title: file.name, source: 'upload', media, audioEnabled: $('wallpaper-audio').checked, finishBeforeNext: $('wallpaper-finish').checked, volume: Number($('wallpaper-volume').value || 35) / 100 }) });
    $('wallpaper-file').value = ''; setStatus('wallpaper-status', 'Wallpaper subido.'); wallpapers = await api('/api/wallpapers'); renderWallpapers();
  } catch(e) { setStatus('wallpaper-status', e.message || String(e)); }
});

function renderCollections() {
  $('collection-select').innerHTML = collections.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const id = $('collection-select').value || collections[0]?.id;
  const c = collections.find(x => x.id === id) || collections[0];
  $('collection-list').innerHTML = c ? (c.items || []).map(item => `<article class="asset-card"><img src="${item.coverPath || item.assetPath}" alt=""><div><strong>${escapeHtml(item.title || 'Imagen')}</strong><small>${item.backdropPath ? 'backdrop' : 'sin backdrop'} · ${item.videoPath ? (item.videoFinishBeforeNext ? 'vídeo completo' : 'vídeo') : 'sin vídeo'}</small><button data-edit-collection-item="${item.id}">Editar</button><button data-delete-collection-item="${item.id}" class="danger">Eliminar</button></div></article>`).join('') || '<p>Esta colección está vacía.</p>' : '<p>No hay colecciones.</p>';
}
$('collection-select').addEventListener('change', renderCollections);
$('new-collection').addEventListener('click', async () => { const name = prompt('Nombre de la colección'); if (!name) return; await api('/api/collections', { method:'POST', body: JSON.stringify({ name }) }); collections = await api('/api/collections'); renderCollections(); renderDashboardSources(); });
$('rename-collection').addEventListener('click', async () => { const id = $('collection-select').value; const c = collections.find(x => x.id === id); if (!c) return; const name = prompt('Nuevo nombre', c.name); if (!name) return; await api(`/api/collections/${id}`, { method:'PATCH', body: JSON.stringify({ name }) }); collections = await api('/api/collections'); renderCollections(); renderDashboardSources(); });
$('delete-collection').addEventListener('click', async () => { const id = $('collection-select').value; if (!id || !confirm('¿Eliminar colección?')) return; await api(`/api/collections/${id}`, { method:'DELETE' }); collections = await api('/api/collections'); renderCollections(); renderDashboardSources(); });
$('collection-list').addEventListener('click', async e => {
  const del = e.target.closest('[data-delete-collection-item]');
  const edit = e.target.closest('[data-edit-collection-item]');
  const id = $('collection-select').value;
  const c = collections.find(x => x.id === id);
  if (edit) {
    const item = c?.items?.find(x => x.id === edit.dataset.editCollectionItem);
    if (!item) return;
    openEditItemModal(id, item);
    return;
  }
  if (!del) return;
  if (!confirm('¿Eliminar item?')) return;
  await api(`/api/collections/${id}/items/${del.dataset.deleteCollectionItem}`, { method:'DELETE' });
  collections = await api('/api/collections'); renderCollections(); renderDashboardSources();
});
function assetLabel(path) { return path ? path.split('/').pop() : 'Sin archivo'; }
function openEditItemModal(collectionId, item) {
  editingItem = { collectionId, itemId: item.id };
  value('edit-item-title', item.title || '');
  $('edit-item-cover-file').value = '';
  $('edit-item-backdrop-file').value = '';
  $('edit-item-video-file').value = '';
  $('edit-item-remove-backdrop').checked = false;
  $('edit-item-remove-video').checked = false;
  $('edit-item-video-finish').checked = Boolean(item.videoFinishBeforeNext);
  $('edit-item-current-cover').textContent = assetLabel(item.coverPath || item.assetPath);
  $('edit-item-current-backdrop').textContent = assetLabel(item.backdropPath);
  $('edit-item-current-video').textContent = assetLabel(item.videoPath);
  setStatus('edit-item-status', '');
  $('edit-item-modal').hidden = false;
}
function closeEditItemModal() {
  $('edit-item-modal').hidden = true;
  editingItem = null;
}
document.querySelectorAll('[data-close-edit-item]').forEach(btn => btn.addEventListener('click', closeEditItemModal));
$('save-edit-item').addEventListener('click', async () => {
  if (!editingItem) return;
  try {
    const payload = { title: $('edit-item-title').value.trim() || 'Imagen' };
    const coverFile = $('edit-item-cover-file').files[0];
    const backdropFile = $('edit-item-backdrop-file').files[0];
    const videoFile = $('edit-item-video-file').files[0];

    if (coverFile) payload.image = await fileToDataUri(coverFile);
    if ($('edit-item-remove-backdrop').checked) payload.backdropImage = null;
    else if (backdropFile) payload.backdropImage = await fileToDataUri(backdropFile);
    if ($('edit-item-remove-video').checked) payload.video = null;
    else if (videoFile) payload.video = await fileToDataUri(videoFile);
    payload.videoFinishBeforeNext = $('edit-item-video-finish').checked;

    await api(`/api/collections/${editingItem.collectionId}/items/${editingItem.itemId}`, { method:'PATCH', body: JSON.stringify(payload) });
    collections = await api('/api/collections');
    renderCollections();
    renderDashboardSources();
    setStatus('collection-status', 'Item actualizado.');
    closeEditItemModal();
  } catch(e) {
    setStatus('edit-item-status', e.message || String(e));
  }
});

$('upload-collection').addEventListener('click', async () => {
  try {
    const file = $('collection-file').files[0]; const id = $('collection-select').value;
    if (!file) return setStatus('collection-status', 'Selecciona una portada.');
    if (!id) return setStatus('collection-status', 'No hay colección seleccionada.');
    const image = await fileToDataUri(file);
    const backdropFile = $('collection-backdrop-file').files[0];
    const videoFile = $('collection-video-file').files[0];
    const payload = { title: $('collection-item-title').value.trim() || file.name, source: 'upload', image };
    if (backdropFile) payload.backdrop = await fileToDataUri(backdropFile);
    if (videoFile) payload.video = await fileToDataUri(videoFile);
    payload.videoFinishBeforeNext = $('collection-video-finish').checked;
    await api(`/api/collections/${id}/items`, { method:'POST', body: JSON.stringify(payload) });
    $('collection-file').value=''; $('collection-backdrop-file').value=''; $('collection-video-file').value=''; $('collection-video-finish').checked=false; $('collection-item-title').value='';
    setStatus('collection-status','Item subido.'); collections = await api('/api/collections'); renderCollections(); renderDashboardSources();
  } catch(e) { setStatus('collection-status', e.message || String(e)); }
});

async function loadCss(name) { $('css-editor').value = await fetch(`/api/custom-css/${name}?v=${Date.now()}`).then(r => r.text()); }
$('css-name').addEventListener('change', e => loadCss(e.target.value));
$('save-css').addEventListener('click', async () => { try { const name = $('css-name').value; await fetch(`/api/custom-css/${name}`, { method:'PUT', headers:{'Content-Type':'text/css'}, body:$('css-editor').value }); setStatus('css-status','CSS guardado.'); } catch(e) { setStatus('css-status', e.message || String(e)); } });
document.querySelectorAll('[data-simulate]').forEach(btn => btn.addEventListener('click', async () => { try { await api(`/api/simulate/${btn.dataset.simulate}`, { method:'POST', body: JSON.stringify({}) }); setStatus('simulate-status', `Simulado: ${btn.textContent}`); } catch(e) { setStatus('simulate-status', e.message || String(e)); } }));

loadAll().catch(e => setStatus('settings-status', e.message || String(e)));
loadCss('global').catch(e => setStatus('css-status', e.message || String(e)));
