function label(event) { return ({ play: "▶ REPRODUCIENDO", pause: "⏸ PAUSADO", stop: "■ DETENIDO", recently_added: "🆕 AÑADIDO" }[event] || String(event || "PLEX").toUpperCase()); }
export function createPlexView() {
  let el;
  return {
    id: "plex-now-playing",
    mount(target) {
      el = target;
      el.innerHTML = `<div class="plex-bg"></div><div class="plex-overlay"></div><div class="plex-layout"><img class="plex-poster" alt=""><div class="plex-info"><span class="plex-event"></span><h1 class="plex-title"></h1><p class="plex-subtitle"></p><p class="plex-year"></p></div></div>`;
    },
    show() { el.classList.add("view--active"); el.setAttribute("aria-hidden", "false"); },
    hide() { el.classList.remove("view--active"); el.setAttribute("aria-hidden", "true"); },
    update(data) {
      if (!data) return;
      el.querySelector(".plex-event").textContent = label(data.event);
      el.querySelector(".plex-title").textContent = data.title || "Sin título";
      el.querySelector(".plex-subtitle").textContent = data.subtitle || "";
      el.querySelector(".plex-year").textContent = data.year || "";
      const poster = el.querySelector(".plex-poster");
      poster.src = data.posterUrl || "";
      poster.style.visibility = data.posterUrl ? "visible" : "hidden";
      el.querySelector(".plex-bg").style.backgroundImage = data.backdropUrl ? `url("${data.backdropUrl}")` : "none";
    }
  };
}
