function text(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" · ");
  return value ? String(value) : "";
}

function setOptional(el, label, value) {
  const formatted = text(value);
  el.textContent = formatted ? `${label}: ${formatted}` : "";
  el.hidden = !formatted;
}

export function createGameView() {
  let el;
  let progress;
  let timerEl;
  let config = { showProgressBar: true };

  return {
    id: "game-now-playing",
    mount(target) {
      el = target;
      el.innerHTML = `
        <div class="game-bg"></div>
        <div class="game-overlay"></div>
        <div class="game-layout">
          <img class="game-cover" alt="Carátula del videojuego">
          <div class="game-info">
            <span class="game-event">🎮 JUGANDO AHORA</span>
            <h1 class="game-title"></h1>
            <p class="game-platforms"></p>
            <p class="game-developer"></p>
            <p class="game-publisher"></p>
            <p class="game-year"></p>
            <p class="game-genres"></p>
          </div>
        </div>
        <div class="game-popup-timer" aria-hidden="true"><span></span></div>`;
      timerEl = el.querySelector(".game-popup-timer");
      progress = el.querySelector(".game-popup-timer span");
    },
    show() {
      el.classList.add("view--active");
      el.setAttribute("aria-hidden", "false");
    },
    hide() {
      el.classList.remove("view--active");
      el.setAttribute("aria-hidden", "true");
      this.stopTimer();
    },
    configure(nextConfig = {}) {
      config = { ...config, ...nextConfig };
      if (timerEl) timerEl.style.display = config.showProgressBar ? "block" : "none";
    },
    startTimer(durationMs) {
      if (!config.showProgressBar) return;
      if (!progress) return;
      progress.style.transition = "none";
      progress.style.transform = "scaleX(1)";
      progress.offsetWidth;
      progress.style.transition = `transform ${durationMs}ms linear`;
      progress.style.transform = "scaleX(0)";
    },
    stopTimer() {
      if (!progress) return;
      progress.style.transition = "none";
      progress.style.transform = "scaleX(0)";
    },
    update(game) {
      if (!game) return;
      el.querySelector(".game-title").textContent = game.title || "Juego sin título";
      el.querySelector(".game-platforms").textContent = text(game.platforms);
      setOptional(el.querySelector(".game-developer"), "Desarrollador", game.developers);
      setOptional(el.querySelector(".game-publisher"), "Distribuidor", game.publishers);
      setOptional(el.querySelector(".game-year"), "Lanzamiento", game.releaseYear);
      setOptional(el.querySelector(".game-genres"), "Géneros", game.genres);

      const cover = el.querySelector(".game-cover");
      cover.src = game.cover || "";
      cover.style.visibility = game.cover ? "visible" : "hidden";
      el.querySelector(".game-bg").style.backgroundImage = game.background ? `url("${game.background}")` : "none";
    }
  };
}
