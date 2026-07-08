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
function setStatus(id, msg) { document.getElementById(id).textContent = msg; }
function checked(id, value) { document.getElementById(id).checked = Boolean(value); }
function value(id, next) { document.getElementById(id).value = next ?? ''; }

async function loadSettings() {
  const s = await api('/api/settings');
  value('plex-url', s.plex?.url || '');
  value('plex-token', s.plex?.token || '');
  value('wallpaper-interval', s.display?.wallpaperIntervalSeconds || 35);
  checked('dim-enabled', s.display?.dimEnabled);
  value('dim-timeout', s.display?.dimTimeoutSeconds || 10);
  value('dim-opacity', s.display?.dimOpacity ?? 0.5);
  checked('dock-autohide', s.display?.dockAutoHide !== false);
  value('dock-seconds', s.display?.dockAutoHideSeconds || 4);
  value('notifications-limit', s.views?.notifications?.itemsPerPage || 5);
  checked('toast-enabled', s.notifications?.toastEnabled !== false);
  value('toast-duration', s.notifications?.toastDurationSeconds || 6);
  checked('allow-gifs', s.wallpapers?.allowGifs !== false);
}
async function saveSettings() {
  const patch = {
    plex: { url: document.getElementById('plex-url').value.trim(), token: document.getElementById('plex-token').value.trim() },
    display: {
      wallpaperIntervalSeconds: Number(document.getElementById('wallpaper-interval').value),
      dimEnabled: document.getElementById('dim-enabled').checked,
      dimTimeoutSeconds: Number(document.getElementById('dim-timeout').value),
      dimOpacity: Number(document.getElementById('dim-opacity').value),
      dockAutoHide: document.getElementById('dock-autohide').checked,
      dockAutoHideSeconds: Number(document.getElementById('dock-seconds').value)
    },
    views: { notifications: { itemsPerPage: Number(document.getElementById('notifications-limit').value) } },
    notifications: { toastEnabled: document.getElementById('toast-enabled').checked, toastDurationSeconds: Number(document.getElementById('toast-duration').value) },
    wallpapers: { allowGifs: document.getElementById('allow-gifs').checked }
  };
  await api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
  setStatus('settings-status', 'Ajustes guardados.');
}
async function loadCollections() {
  const collections = await api('/api/collections');
  const select = document.getElementById('collection-select');
  select.innerHTML = collections.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}
async function loadCss(name) {
  document.getElementById('css-editor').value = await fetch(`/api/custom-css/${name}?v=${Date.now()}`).then(r => r.text());
}

document.getElementById('save-settings').addEventListener('click', () => saveSettings().catch(e => setStatus('settings-status', e.message || String(e))));
document.getElementById('reset-settings').addEventListener('click', async () => { try { await api('/api/settings/reset', { method:'POST' }); await loadSettings(); setStatus('settings-status','Ajustes restaurados.'); } catch(e) { setStatus('settings-status', e.message || String(e)); } });
document.querySelectorAll('[data-simulate]').forEach(btn => btn.addEventListener('click', async () => {
  try { await api(`/api/simulate/${btn.dataset.simulate}`, { method:'POST', body: JSON.stringify({}) }); setStatus('simulate-status', `Simulado: ${btn.textContent}`); }
  catch(e) { setStatus('simulate-status', e.message || String(e)); }
}));
document.getElementById('upload-wallpaper').addEventListener('click', async () => {
  try {
    const file = document.getElementById('wallpaper-file').files[0];
    if (!file) return setStatus('wallpaper-status', 'Selecciona una imagen.');
    if (file.type === 'image/gif' && !document.getElementById('allow-gifs').checked) return setStatus('wallpaper-status', 'Los GIFs están desactivados en ajustes.');
    const image = await fileToDataUri(file);
    await api('/api/wallpapers', { method: 'POST', body: JSON.stringify({ title: file.name, source: 'upload', image }) });
    setStatus('wallpaper-status', 'Wallpaper subido.');
  } catch (e) { setStatus('wallpaper-status', e.message || String(e)); }
});
document.getElementById('upload-collection').addEventListener('click', async () => {
  try {
    const file = document.getElementById('collection-file').files[0];
    const collectionId = document.getElementById('collection-select').value;
    if (!file) return setStatus('collection-status', 'Selecciona una imagen.');
    if (!collectionId) return setStatus('collection-status', 'No hay colección seleccionada.');
    const image = await fileToDataUri(file);
    await api(`/api/collections/${collectionId}/items`, { method: 'POST', body: JSON.stringify({ title: file.name, source: 'upload', image }) });
    setStatus('collection-status', 'Imagen subida a colección.');
  } catch (e) { setStatus('collection-status', e.message || String(e)); }
});
document.getElementById('css-name').addEventListener('change', e => loadCss(e.target.value));
document.getElementById('save-css').addEventListener('click', async () => {
  try {
    const name = document.getElementById('css-name').value;
    await fetch(`/api/custom-css/${name}`, { method: 'PUT', headers: { 'Content-Type': 'text/css' }, body: document.getElementById('css-editor').value });
    setStatus('css-status', 'CSS guardado.');
  } catch (e) { setStatus('css-status', e.message || String(e)); }
});
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
loadSettings().catch(e => setStatus('settings-status', e.message || String(e)));
loadCollections().catch(e => setStatus('collection-status', e.message || String(e)));
loadCss('global').catch(e => setStatus('css-status', e.message || String(e)));
