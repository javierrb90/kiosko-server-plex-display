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
async function loadCollections() {
  const collections = await api('/api/collections');
  const select = document.getElementById('collection-select');
  select.innerHTML = collections.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
async function loadCss(name) {
  document.getElementById('css-editor').value = await fetch(`/api/custom-css/${name}?v=${Date.now()}`).then(r => r.text());
}
document.getElementById('upload-wallpaper').addEventListener('click', async () => {
  try {
    const file = document.getElementById('wallpaper-file').files[0];
    if (!file) return setStatus('wallpaper-status', 'Selecciona una imagen.');
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
loadCollections().catch(e => setStatus('collection-status', e.message || String(e)));
loadCss('global').catch(e => setStatus('css-status', e.message || String(e)));
