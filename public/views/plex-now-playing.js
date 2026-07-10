function label(event) {
  return ({ play: "REPRODUCIENDO", pause: "PAUSADO", stop: "DETENIDO", recently_added: "AÑADIDO" }[event] || "PLEX");
}

async function resolveCollection({ api, ui }) {
  const collections = await api("/api/collections");
  const choice = await ui.chooseCollection(collections);
  if (!choice) return null;
  if (choice.newName) return api("/api/collections", { method: "POST", body: JSON.stringify({ name: choice.newName }) });
  return collections.find(c => c.id === choice.selectedId) || null;
}

export function createPlexView({ api, ui } = {}) {
  let el, current = null;

  async function addWallpaper() {
    if (!current?.backdropUrl) return ui.alert("No hay backdrop disponible.");
    await api("/api/wallpapers", {
      method: "POST",
      body: JSON.stringify({
        title: current.title || "Plex backdrop",
        source: "plex",
        image: current.backdropUrl,
        meta: { type: current.type, ratingKey: current.ratingKey }
      })
    });
    ui.toast("Backdrop añadido a wallpapers");
  }

  async function addPosterToCollection() {
    if (!current?.posterUrl) return ui.alert("No hay póster disponible.");
    const collection = await resolveCollection({ api, ui });
    if (!collection) return;
    await api(`/api/collections/${collection.id}/items`, {
      method: "POST",
      body: JSON.stringify({
        title: current.title || "Póster Plex",
        source: "plex",
        coverImage: current.posterUrl,
        backdropImage: current.backdropUrl,
        meta: { type: current.type, ratingKey: current.ratingKey, year: current.year }
      })
    });
    ui.toast("Póster añadido a colección", { detail: collection.name });
  }

  function openActions() {
    ui.actionSheet({
      title: current?.title || "Acciones de Plex",
      actions: [
        {
          id: "wallpaper",
          label: "Añadir backdrop a wallpapers",
          description: current?.backdropUrl ? "Usar el fondo actual en el Dashboard" : "No hay fondo disponible",
          disabled: !current?.backdropUrl,
          run: addWallpaper
        },
        {
          id: "collection",
          label: "Añadir póster a colección",
          description: current?.posterUrl ? "Guardar póster y fondo en una colección" : "No hay póster disponible",
          disabled: !current?.posterUrl,
          run: addPosterToCollection
        }
      ]
    });
  }

  return {
    id: "plex-now-playing",
    mount(target) {
      el = target;
      el.innerHTML = `<div class="media-view media-view--plex">
        <img class="media-bg-img" alt="">
        <div class="media-overlay"></div>
        <button class="media-menu-button" type="button" data-actions aria-label="Acciones">...</button>
        <div class="media-layout">
          <img class="media-poster" alt="">
          <div class="media-info">
            <span class="media-event"></span>
            <h1 class="media-title"></h1>
            <p class="media-subtitle"></p>
            <p class="media-year"></p>
          </div>
        </div>
      </div>`;
      el.querySelector("[data-actions]").addEventListener("click", openActions);
    },
    show() { el.classList.add("view--active"); el.setAttribute("aria-hidden", "false"); },
    hide() { el.classList.remove("view--active"); el.setAttribute("aria-hidden", "true"); },
    update(data) {
      if (!data) return;
      current = data;
      el.querySelector(".media-event").textContent = label(data.event);
      el.querySelector(".media-title").textContent = data.title || "Sin reproducción";
      el.querySelector(".media-subtitle").textContent = data.subtitle || "";
      el.querySelector(".media-year").textContent = data.year || "";
      const poster = el.querySelector(".media-poster");
      poster.src = data.posterUrl || "";
      poster.style.visibility = data.posterUrl ? "visible" : "hidden";
      const bg = el.querySelector(".media-bg-img");
      bg.src = data.backdropUrl || "";
      bg.classList.toggle("media-bg-img--visible", Boolean(data.backdropUrl));
      applyAccentFromImage(el.querySelector(".media-view"), data.posterUrl || data.backdropUrl);
    }
  };
}

function applyAccentFromImage(container, src) {
  if (!container || !src || !String(src).startsWith('/assets/')) return;
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const size = 24;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        const a = data[i + 3];
        if (a < 160) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
      }
      if (!count) return;
      r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
      container.style.setProperty('--accent-color', `rgb(${r}, ${g}, ${b})`);
    } catch {}
  };
  img.src = src;
}
