export function createCollectionsView({ api, ui } = {}) {
  let el;
  let collections = [];
  let selectedId = null;
  let isVisible = false;
  let mode = "presentation";
  let itemSize = "xl";

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

  async function refresh() {
    collections = await api("/api/collections");
    if (!selectedId || !selected()) selectedId = collections[0]?.id;
    render();
  }

  function applySizeClass() {
    const grid = el?.querySelector(".collections-grid");
    if (!grid) return;
    grid.classList.remove("collections-grid--l", "collections-grid--xl", "collections-grid--xxl", "collections-grid--all");
    grid.classList.add(`collections-grid--${itemSize}`);
    el.querySelectorAll("[data-size]").forEach(btn => btn.classList.toggle("is-active", btn.dataset.size === itemSize));
  }

  function render() {
    if (!el || !isVisible) return;
    const c = selected();
    el.querySelector(".collection-title").textContent = c?.name || "Colecciones";
    el.querySelector(".collection-count").textContent = c ? `${c.items?.length || 0} imágenes` : "0 imágenes";
    el.querySelector(".collection-mode").textContent = mode === "manage" ? "Modo gestión" : "Modo presentación";
    el.classList.toggle("collections--manage", mode === "manage");
    const grid = el.querySelector(".collections-grid");
    applySizeClass();

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

  return {
    id: "collections",
    mount(target) {
      el = target;
      el.innerHTML = `<div class="collections-view">
        <header>
          <div>
            <p class="eyebrow">COLECCIONES</p>
            <h1 class="collection-title">Colecciones</h1>
            <div class="collection-meta"><span class="collection-mode">Modo presentación</span><span class="collection-count">0 imágenes</span></div>
          </div>
          <div class="collection-toolbar">
            <button data-prev-collection>Anterior</button>
            <button data-next-collection>Siguiente</button>
            <div class="collection-size-controls" aria-label="Tamaño de miniaturas">
              <button data-size="l" title="Tamaño L">L</button>
              <button data-size="xl" title="Tamaño XL">XL</button>
              <button data-size="xxl" title="Tamaño XXL">XXL</button>
              <button data-size="all" title="Mostrar todo">Todos</button>
            </div>
            <button data-mode>Cambiar modo</button>
            <button data-new>Nueva</button>
            <button data-rename>Renombrar</button>
            <button data-delete-collection>Eliminar</button>
          </div>
        </header>
        <section class="collections-grid"></section>
      </div>`;

      el.querySelector("[data-prev-collection]").addEventListener("click", () => {
        if (!collections.length) return;
        const current = Math.max(0, collections.findIndex(c => c.id === selectedId));
        selectedId = collections[(current - 1 + collections.length) % collections.length].id;
        render();
      });
      el.querySelector("[data-next-collection]").addEventListener("click", () => {
        if (!collections.length) return;
        const current = Math.max(0, collections.findIndex(c => c.id === selectedId));
        selectedId = collections[(current + 1) % collections.length].id;
        render();
      });
      el.querySelector("[data-mode]").addEventListener("click", () => { mode = mode === "manage" ? "presentation" : "manage"; render(); });
      el.querySelectorAll("[data-size]").forEach(btn => btn.addEventListener("click", () => {
        itemSize = btn.dataset.size;
        render();
      }));
      el.querySelector("[data-new]").addEventListener("click", async () => {
        const name = await ui.prompt({ title: "Nueva colección", placeholder: "Nombre", defaultValue: "Nueva colección" });
        if (!name) return;
        const c = await api("/api/collections", { method: "POST", body: JSON.stringify({ name }) });
        selectedId = c.id;
        await refresh();
      });
      el.querySelector("[data-rename]").addEventListener("click", async () => {
        const c = selected();
        if (!c) return;
        const name = await ui.prompt({ title: "Renombrar colección", placeholder: "Nombre", defaultValue: c.name });
        if (!name) return;
        await api(`/api/collections/${c.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
        await refresh();
      });
      el.querySelector("[data-delete-collection]").addEventListener("click", async () => {
        const c = selected();
        if (!c) return;
        const ok = await ui.confirm({ title: "Eliminar colección", message: `¿Eliminar ${c.name}? También se borrarán sus imágenes.`, confirmText: "Eliminar", danger: true });
        if (!ok) return;
        await api(`/api/collections/${c.id}`, { method: "DELETE" });
        selectedId = null;
        await refresh();
      });
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
