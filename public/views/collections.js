export function createCollectionsView({ api, ui } = {}) {
  let el;
  let collections = [];
  let selectedId = null;
  let isVisible = false;
  let mode = "presentation";
  let itemSize = "xl";
  let layout = "masonry"; // masonry | square

  const sizeBase = { l: 120, xl: 165, xxl: 230, all: 76 };

  function selected() {
    return collections.find(c => c.id === selectedId) || collections[0];
  }

  function getColumnCount() {
    const grid = el?.querySelector(".collections-grid");
    const width = grid?.clientWidth || window.innerWidth || 960;
    const base = sizeBase[itemSize] || sizeBase.xl;
    return Math.max(1, Math.floor(width / base));
  }

  function splitIntoColumns(items) {
    const count = getColumnCount();
    const cols = Array.from({ length: count }, () => []);
    items.forEach((item, index) => cols[index % count].push({ item, index }));
    return cols;
  }

  function updateSquareSize() {
    const grid = el?.querySelector('.collections-grid');
    if (!grid) return;
    const count = getColumnCount();
    const gap = itemSize === 'all' ? 8 : 12;
    const width = grid.clientWidth || 960;
    const size = Math.max(42, Math.floor((width - gap * (count - 1)) / count));
    grid.style.setProperty('--collection-square-size', `${size}px`);
  }

  async function refresh() {
    collections = await api("/api/collections");
    if (!selectedId || !selected()) selectedId = collections[0]?.id;
    render();
  }

  function applyClasses() {
    const grid = el?.querySelector(".collections-grid");
    if (!grid) return;
    grid.classList.remove("collections-grid--l", "collections-grid--xl", "collections-grid--xxl", "collections-grid--all", "collections-grid--masonry", "collections-grid--square");
    grid.classList.add(`collections-grid--${itemSize}`, `collections-grid--${layout}`);
    updateSquareSize();
  }

  function render() {
    if (!el || !isVisible) return;
    const c = selected();
    el.querySelector(".collection-title").textContent = c?.name || "Colecciones";
    el.querySelector(".collection-count").textContent = c ? `${c.items?.length || 0} imágenes` : "0 imágenes";
    el.classList.toggle("collections--manage", mode === "manage");
    const grid = el.querySelector(".collections-grid");
    applyClasses();

    if (!c?.items?.length) {
      grid.innerHTML = `<div class="collections-empty">Esta colección todavía no tiene imágenes.</div>`;
      return;
    }

    const columns = splitIntoColumns(c.items);
    grid.innerHTML = `<div class="collections-masonry">${columns.map(column => `<div class="collection-column">${column.map(({ item, index }) => `<article class="collection-item">
      <img src="${escapeAttr(item.assetPath)}" alt="${escapeAttr(item.title || "")}">
      <div class="collection-item-controls">
        <button data-move="up" data-id="${item.id}" ${index === 0 ? "disabled" : ""}>←</button>
        <button data-move="down" data-id="${item.id}" ${index === c.items.length - 1 ? "disabled" : ""}>→</button>
        <button data-delete="${item.id}">×</button>
      </div>
    </article>`).join("")}</div>`).join("")}</div>`;
  }

  function changeCollection(delta) {
    if (!collections.length) return;
    const current = Math.max(0, collections.findIndex(c => c.id === selectedId));
    selectedId = collections[(current + delta + collections.length) % collections.length].id;
    render();
  }

  async function createCollection() {
    const name = await ui.prompt({ title: "Nueva colección", placeholder: "Nombre", defaultValue: "Nueva colección" });
    if (!name) return;
    const c = await api("/api/collections", { method: "POST", body: JSON.stringify({ name }) });
    selectedId = c.id;
    await refresh();
  }

  async function renameCollection() {
    const c = selected();
    if (!c) return;
    const name = await ui.prompt({ title: "Renombrar colección", placeholder: "Nombre", defaultValue: c.name });
    if (!name) return;
    await api(`/api/collections/${c.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    await refresh();
  }

  async function deleteCollection() {
    const c = selected();
    if (!c) return;
    const ok = await ui.confirm({ title: "Eliminar colección", message: `¿Eliminar ${c.name}? También se borrarán sus imágenes.`, confirmText: "Eliminar", danger: true });
    if (!ok) return;
    await api(`/api/collections/${c.id}`, { method: "DELETE" });
    selectedId = null;
    await refresh();
  }

  function openMenu() {
    const c = selected();
    ui.actionSheet({
      title: c?.name || 'Colecciones',
      actions: [
        { id: 'prev', label: 'Colección anterior', description: 'Cambiar a la colección previa', disabled: collections.length < 2, run: () => changeCollection(-1) },
        { id: 'next', label: 'Colección siguiente', description: 'Cambiar a la siguiente colección', disabled: collections.length < 2, run: () => changeCollection(1) },
        { id: 'mode', label: mode === 'manage' ? 'Modo presentación' : 'Modo gestión', description: mode === 'manage' ? 'Ocultar controles de items' : 'Mostrar mover/eliminar items', run: () => { mode = mode === 'manage' ? 'presentation' : 'manage'; render(); } },
        { id: 'layout', label: layout === 'masonry' ? 'Cuadrícula cuadrada' : 'Masonry ratio original', description: layout === 'masonry' ? 'Mostrar todos los items en cuadrados' : 'Preservar formato original de portadas/fondos', run: () => { layout = layout === 'masonry' ? 'square' : 'masonry'; render(); } },
        { id: 'size-l', label: 'Tamaño L', description: 'Más columnas', run: () => { itemSize = 'l'; render(); } },
        { id: 'size-xl', label: 'Tamaño XL', description: 'Tamaño medio', run: () => { itemSize = 'xl'; render(); } },
        { id: 'size-xxl', label: 'Tamaño XXL', description: 'Piezas grandes', run: () => { itemSize = 'xxl'; render(); } },
        { id: 'size-all', label: 'Ver todos', description: 'Miniaturas pequeñas para maximizar cantidad visible', run: () => { itemSize = 'all'; render(); } },
        { id: 'new', label: 'Nueva colección', description: 'Crear una colección vacía', run: createCollection },
        { id: 'rename', label: 'Renombrar colección', description: 'Cambiar el nombre actual', disabled: !c, run: renameCollection },
        { id: 'delete', label: 'Eliminar colección', description: 'Borrar colección e imágenes', disabled: !c, run: deleteCollection }
      ]
    });
  }

  return {
    id: "collections",
    mount(target) {
      el = target;
      el.innerHTML = `<div class="collections-view">
        <header>
          <div>
            <p class="eyebrow">COLECCIONES</p>
            <h1 class="collection-title">Colecciones</h1>
            <div class="collection-meta"><span class="collection-count">0 imágenes</span></div>
          </div>
          <button class="collection-menu-button" type="button" data-menu aria-label="Acciones">...</button>
        </header>
        <section class="collections-grid"></section>
      </div>`;
      el.querySelector('[data-menu]').addEventListener('click', openMenu);
      el.querySelector(".collections-grid").addEventListener("click", async e => {
        const del = e.target.closest("[data-delete]");
        const move = e.target.closest("[data-move]");
        const c = selected();
        if (!c) return;
        if (del) {
          const ok = await ui.confirm({ title: "Eliminar imagen", message: "¿Eliminar esta imagen de la colección?", confirmText: "Eliminar", danger: true });
          if (!ok) return;
          await api(`/api/collections/${c.id}/items/${del.dataset.delete}`, { method: "DELETE" });
          await refresh();
          ui.toast("Imagen eliminada");
        }
        if (move && !move.disabled) {
          await api(`/api/collections/${c.id}/items/${move.dataset.id}/move`, {
            method: "POST",
            body: JSON.stringify({ direction: move.dataset.move === "down" ? "down" : "up" })
          });
          await refresh();
        }
      });
      window.addEventListener("resize", () => { if (isVisible) render(); });
    },
    show() { isVisible = true; el.classList.add("view--active"); el.setAttribute("aria-hidden", "false"); refresh().catch(console.error); },
    hide() { isVisible = false; el.classList.remove("view--active"); el.setAttribute("aria-hidden", "true"); },
    update(data = {}) {
      if (data.collections) {
        collections = data.collections;
        if (!selectedId || !selected()) selectedId = data.state?.selectedCollectionId || collections[0]?.id;
        if (isVisible) render();
      }
    }
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
