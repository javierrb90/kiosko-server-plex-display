function text(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(" · ") : (value ? String(value) : "");
}
function setOptional(el, label, value) {
  const formatted = text(value);
  el.textContent = formatted ? `${label}: ${formatted}` : "";
  el.hidden = !formatted;
}
async function resolveCollection({ api, ui }) {
  const collections = await api("/api/collections");
  const choice = await ui.chooseCollection(collections);
  if (!choice) return null;
  if (choice.newName) return api("/api/collections", { method: "POST", body: JSON.stringify({ name: choice.newName }) });
  return collections.find(c => c.id === choice.selectedId) || null;
}

export function createGameView({ api, ui } = {}) {
  let el, current = null;

  async function addWallpaper() {
    if (!current?.background) return ui.alert("No hay fondo disponible.");
    await api("/api/wallpapers", {
      method: "POST",
      body: JSON.stringify({
        title: current.title || "Game background",
        source: "playnite",
        image: current.background,
        meta: { platforms: current.platforms }
      })
    });
    ui.toast("Fondo añadido a wallpapers");
  }

  async function addCoverToCollection() {
    if (!current?.cover) return ui.alert("No hay carátula disponible.");
    const collection = await resolveCollection({ api, ui });
    if (!collection) return;
    await api(`/api/collections/${collection.id}/items`, {
      method: "POST",
      body: JSON.stringify({
        title: current.title || "Carátula",
        source: "playnite",
        coverImage: current.cover,
        backdropImage: current.background,
        meta: { platforms: current.platforms, developers: current.developers, releaseYear: current.releaseYear }
      })
    });
    ui.toast("Carátula añadida a colección", { detail: collection.name });
  }

  function openActions() {
    ui.actionSheet({
      title: current?.title || "Acciones de juego",
      actions: [
        {
          id: "wallpaper",
          label: "Añadir fondo a wallpapers",
          description: current?.background ? "Usar el fondo actual en el Dashboard" : "No hay fondo disponible",
          disabled: !current?.background,
          run: addWallpaper
        },
        {
          id: "collection",
          label: "Añadir carátula a colección",
          description: current?.cover ? "Guardar carátula y fondo en una colección" : "No hay carátula disponible",
          disabled: !current?.cover,
          run: addCoverToCollection
        }
      ]
    });
  }

  return {
    id: "game-now-playing",
    mount(target) {
      el = target;
      el.innerHTML = `<div class="media-view media-view--game">
        <img class="media-bg-img" alt="">
        <div class="media-overlay"></div>
        <button class="media-menu-button" type="button" data-actions aria-label="Acciones">...</button>
        <div class="media-layout">
          <img class="media-poster" alt="Carátula">
          <div class="media-info">
            <span class="media-event">JUGANDO AHORA</span>
            <h1 class="media-title"></h1>
            <p class="media-subtitle"></p>
            <p class="game-developer"></p>
            <p class="game-publisher"></p>
            <p class="game-year"></p>
            <p class="game-genres"></p>
          </div>
        </div>
      </div>`;
      el.querySelector("[data-actions]").addEventListener("click", openActions);
    },
    show() { el.classList.add("view--active"); el.setAttribute("aria-hidden", "false"); },
    hide() { el.classList.remove("view--active"); el.setAttribute("aria-hidden", "true"); },
    update(game) {
      if (!game) return;
      current = game;
      el.querySelector(".media-title").textContent = game.title || "Juego sin título";
      el.querySelector(".media-subtitle").textContent = text(game.platforms);
      setOptional(el.querySelector(".game-developer"), "Desarrollador", game.developers);
      setOptional(el.querySelector(".game-publisher"), "Distribuidor", game.publishers);
      setOptional(el.querySelector(".game-year"), "Lanzamiento", game.releaseYear);
      setOptional(el.querySelector(".game-genres"), "Géneros", game.genres);
      const cover = el.querySelector(".media-poster");
      cover.src = game.cover || "";
      cover.style.visibility = game.cover ? "visible" : "hidden";
      const bg = el.querySelector(".media-bg-img");
      bg.src = game.background || "";
      bg.classList.toggle("media-bg-img--visible", Boolean(game.background));
      applyAccentFromImage(el.querySelector(".media-view"), game.cover || game.background);
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
