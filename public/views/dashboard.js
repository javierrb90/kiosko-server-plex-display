function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function isVideo(item = {}) { return item.type === 'video' || String(item.mime || '').startsWith('video/'); }
function text(value) { return Array.isArray(value) ? value.filter(Boolean).join(' · ') : (value ? String(value) : ''); }
function shouldWaitForVideo(slide) {
  if (slide?.mediaType !== 'video') return false;
  if (slide?.kind === 'collection') return slide?.item?.videoFinishBeforeNext === true || slide?.item?.meta?.videoFinishBeforeNext === true;
  return slide?.wallpaper?.finishBeforeNext === true;
}
function lockSvg(locked) {
  return locked
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 9h-2V7a3 3 0 0 0-5.6-1.5L7.7 4.4A5 5 0 0 1 17 7v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1h11Z"/></svg>`;
}
function menuSvg() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>`; }
function muteSvg(muted) { return muted
  ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3 2.2-2.2 1.4 1.4L17.9 13.4l2.2 2.2-1.4 1.4-2.2-2.2-2.2 2.2-1.4-1.4 2.2-2.2-2.2-2.2 1.4-1.4 2.2 2.2Z"/></svg>`
  : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.8-2.2-1.4 1.4a5.5 5.5 0 0 1 0 7.8l1.4 1.4a7.5 7.5 0 0 0 0-10.6Zm-3 3-1.4 1.4a2 2 0 0 1 0 2.8l1.4 1.4a4 4 0 0 0 0-5.6Z"/></svg>`; }

export function createDashboardView({ api, ui, onTogglePrivacy } = {}) {
  let el, timer, progressFrame, backgroundMotionFrame;
  let wallpapers = [];
  let collections = [];
  let settings = {};
  let currentSlide = null;
  let isVisible = false;
  let unreadCount = 0;
  let privacyLocked = false;
  let paused = false;
  let startedAt = 0;
  let videoMuted = true;
  let sourceOrder = [];
  let sourceQueues = new Map();
  let sourceIndex = 0;
  let recentSlideKeys = [];

  async function loadData() {
    try { wallpapers = await api('/api/wallpapers'); } catch { wallpapers = []; }
    try { collections = await api('/api/collections'); } catch { collections = []; }
  }

  function activeWallpapers() {
    return wallpapers.filter(w => (w.status || 'active') === 'active' && w.assetPath);
  }
  function selectedCollectionIds() {
    const selected = settings.dashboard?.sources?.collections;
    if (Array.isArray(selected) && selected.length) return selected;
    return collections.filter(c => c.dashboardEnabled).map(c => c.id);
  }
  function makeSources() {
    const sources = [];
    if (settings.dashboard?.sources?.wallpapers !== false && activeWallpapers().length) {
      sources.push({ id: 'wallpapers', type: 'wallpapers', items: activeWallpapers().map(w => ({ kind: 'wallpaper', id: w.id, title: w.title, mediaType: isVideo(w) ? 'video' : 'image', media: w.assetPath, wallpaper: w })) });
    }
    for (const id of selectedCollectionIds()) {
      const c = collections.find(x => x.id === id);
      const items = (c?.items || []).filter(item => item.coverPath || item.assetPath || item.backdropPath || item.videoPath).map(item => ({ kind: 'collection', id: item.id, title: item.title || c.name, collectionName: c.name, mediaType: item.videoPath ? 'video' : 'image', media: item.videoPath || item.backdropPath || item.assetPath || item.coverPath, cover: item.coverPath || item.assetPath, item, collection: c }));
      if (items.length) sources.push({ id: `collection:${c.id}`, type: 'collection', collection: c, items });
    }
    return sources;
  }
  function resetQueues() {
    const sources = makeSources();
    sourceOrder = shuffle(sources.map(s => s.id));
    sourceQueues = new Map(sources.map(s => [s.id, { source: s, queue: shuffle(s.items) }]));
    sourceIndex = 0;
  }
  function slideKey(slide) {
    if (!slide) return '';
    return `${slide.kind}:${slide.collection?.id || slide.wallpaper?.id || 'source'}:${slide.id || slide.media}`;
  }
  function rememberSlide(slide) {
    const key = slideKey(slide);
    if (!key) return;
    recentSlideKeys = [key, ...recentSlideKeys.filter(item => item !== key)].slice(0, 8);
  }
  function pickFromRecord(record, direction) {
    if (!record?.queue?.length) return null;
    const queue = record.queue;
    if (queue.length === 1) return direction < 0 ? queue.pop() : queue.shift();
    const avoid = new Set(recentSlideKeys);
    for (let i = 0; i < queue.length; i += 1) {
      const index = direction < 0 ? queue.length - 1 - i : i;
      const candidate = queue[index];
      if (!avoid.has(slideKey(candidate))) {
        queue.splice(index, 1);
        return candidate;
      }
    }
    return direction < 0 ? queue.pop() : queue.shift();
  }
  function nextSlide(direction = 1) {
    if (!sourceOrder.length || ![...sourceQueues.values()].some(v => v.queue.length)) resetQueues();
    if (!sourceOrder.length) return null;
    let attempts = 0;
    while (attempts < sourceOrder.length) {
      const id = sourceOrder[sourceIndex % sourceOrder.length];
      const record = sourceQueues.get(id);
      if (record?.queue?.length) {
        const slide = pickFromRecord(record, direction);
        if (!record.queue.length) sourceIndex = (sourceIndex + 1) % sourceOrder.length;
        return slide;
      }
      sourceIndex = (sourceIndex + 1) % sourceOrder.length;
      attempts += 1;
    }
    resetQueues();
    const id = sourceOrder[0];
    return pickFromRecord(sourceQueues.get(id), direction) || null;
  }

  function stopBackgroundMotion() {
    cancelAnimationFrame(backgroundMotionFrame);
    backgroundMotionFrame = null;
    const media = el?.querySelector('.dashboard-bg-media');
    if (media) {
      media.style.animation = '';
      media.style.transform = '';
    }
  }

  function startBackgroundMotion() {
    cancelAnimationFrame(backgroundMotionFrame);
    backgroundMotionFrame = null;
    const media = el?.querySelector('img.dashboard-bg-media');
    if (!media || settings.dashboard?.wallpaperMotion === false) {
      stopBackgroundMotion();
      return;
    }

    // Movimiento controlado por JS para que no dependa de CSS heredado/custom.
    // Se aplica sólo a imágenes. Los vídeos no reciben movimiento extra.
    media.style.animation = 'none';
    media.style.transformOrigin = 'center center';
    media.style.willChange = 'transform';

    const started = performance.now();
    const loop = (now) => {
      if (!isVisible || !el?.contains(media) || settings.dashboard?.wallpaperMotion === false) {
        stopBackgroundMotion();
        return;
      }
      const elapsed = (now - started) / 1000;
      const x = Math.sin(elapsed / 9) * 2.6;
      const y = Math.cos(elapsed / 12) * 1.4;
      const scale = 1.08 + (Math.sin(elapsed / 15) + 1) * 0.025;
      media.style.transform = `scale(${scale.toFixed(4)}) translate(${x.toFixed(3)}%, ${y.toFixed(3)}%)`;
      backgroundMotionFrame = requestAnimationFrame(loop);
    };
    backgroundMotionFrame = requestAnimationFrame(loop);
  }

  function showEmpty() {
    const stage = el.querySelector('.dashboard-stage');
    stage.innerHTML = `<div class="dashboard-empty">Añade wallpapers o activa colecciones como fuente del Dashboard desde Admin.</div>`;
    currentSlide = null;
    updateOverlay();
  }
  function renderMedia(slide) {
    if (!slide) return showEmpty();
    currentSlide = slide;
    rememberSlide(slide);
    startedAt = Date.now();
    videoMuted = !(slide.wallpaper?.audioEnabled && settings.dashboard?.videoAudioGlobalEnabled !== false && settings.wallpapers?.allowVideoAudio !== false);
    if (settings.dashboard?.videoAudioDefaultMuted !== false) videoMuted = true;
    const stage = el.querySelector('.dashboard-stage');
    const waitForVideo = shouldWaitForVideo(slide);
    const media = slide.mediaType === 'video'
      ? `<video class="dashboard-bg-media" src="${slide.media}" autoplay ${videoMuted ? 'muted' : ''} ${waitForVideo ? '' : 'loop'} playsinline></video>`
      : `<img class="dashboard-bg-media" src="${slide.media}" alt="">`;
    const isCollection = slide.kind === 'collection';
    stage.innerHTML = `<div class="dashboard-slide ${isCollection ? 'dashboard-slide--collection' : 'dashboard-slide--wallpaper'}">
      ${media}
      <div class="dashboard-vignette"></div>
      ${isCollection ? `<div class="dashboard-ambient-hero">
        <img class="dashboard-ambient-cover" src="${slide.cover || slide.media}" alt="">
        <div class="dashboard-ambient-copy">
          <p class="dashboard-ambient-kicker">Desde colección · ${escapeHtml(slide.collectionName || 'Colección')}</p>
          <h1>${escapeHtml(slide.title || 'Sin título')}</h1>
          <p>${escapeHtml(text(slide.item?.meta?.platforms || slide.item?.meta?.type || slide.source || 'Recordatorio visual'))}</p>
        </div>
      </div>` : ''}
    </div>`;
    const video = stage.querySelector('video.dashboard-bg-media');
    if (video && shouldWaitForVideo(slide)) {
      video.addEventListener('ended', () => { if (isVisible && currentSlide?.id === slide.id) renderNext(1); }, { once: true });
    }
    startBackgroundMotion();
    applyAccent(slide.media || slide.cover, slide.wallpaper?.meta?.accent);
    schedule();
    updateOverlay();
    updateProgress();
  }
  function renderNext(direction = 1) {
    const slide = nextSlide(direction);
    renderMedia(slide);
  }
  function schedule() {
    clearInterval(timer); cancelAnimationFrame(progressFrame);
    const seconds = Number(settings.dashboard?.wallpaperIntervalSeconds || 35);
    if (!paused && !shouldWaitForVideo(currentSlide)) timer = setInterval(() => renderNext(1), Math.max(5, seconds) * 1000);
    const tick = () => { updateProgress(); if (isVisible) progressFrame = requestAnimationFrame(tick); };
    progressFrame = requestAnimationFrame(tick);
  }
  function updateProgress() {
    const bar = el?.querySelector('.dashboard-progress__bar');
    const wrap = el?.querySelector('.dashboard-progress');
    if (!bar || !wrap) return;
    const enabled = settings.dashboard?.showProgressBar !== false;
    wrap.hidden = !enabled || privacyLocked;
    if (!enabled) return;
    const video = el?.querySelector('video.dashboard-bg-media');
    let ratio = 0;
    if (shouldWaitForVideo(currentSlide) && video && Number.isFinite(video.duration) && video.duration > 0) {
      ratio = Math.min(1, Math.max(0, video.currentTime / video.duration));
    } else {
      const seconds = Math.max(5, Number(settings.dashboard?.wallpaperIntervalSeconds || 35));
      ratio = Math.min(1, Math.max(0, (Date.now() - startedAt) / (seconds * 1000)));
    }
    bar.style.transform = `scaleX(${ratio})`;
    wrap.style.opacity = String(settings.dashboard?.progressBarOpacity ?? 0.75);
  }
  function updateOverlay() {
    if (!el) return;
    const unread = el.querySelector('.dashboard-unread');
    unread.hidden = privacyLocked || unreadCount < 1;
    unread.textContent = unreadCount === 1 ? '1 notificación nueva' : `${unreadCount} notificaciones nuevas`;
    const lock = el.querySelector('.privacy-lock-button');
    lock.classList.toggle('privacy-lock-button--locked', privacyLocked);
    lock.innerHTML = lockSvg(privacyLocked);
    lock.setAttribute('aria-label', privacyLocked ? 'Desactivar privacidad' : 'Activar privacidad');
    const mute = el.querySelector('.dashboard-mute-button');
    const showMute = currentSlide?.mediaType === 'video' && currentSlide?.wallpaper?.audioEnabled && settings.dashboard?.videoAudioGlobalEnabled !== false;
    mute.hidden = !showMute || privacyLocked;
    mute.innerHTML = muteSvg(videoMuted);
    const video = el.querySelector('video.dashboard-bg-media');
    if (video) { video.muted = videoMuted; video.volume = Math.max(0, Math.min(1, Number(currentSlide?.wallpaper?.volume ?? 0.35))); }
    el.classList.toggle('dashboard-view--privacy', privacyLocked);
    el.classList.toggle('dashboard-view--no-motion', settings.dashboard?.wallpaperMotion === false);
    if (settings.dashboard?.wallpaperMotion === false) stopBackgroundMotion();
    else startBackgroundMotion();
    updateProgress();
  }
  function openMenu() {
    ui?.actionSheet({
      title: 'Dashboard',
      actions: [
        { id: 'next', label: 'Siguiente fondo', description: 'Cambiar al siguiente elemento', run: () => renderNext(1) },
        { id: 'prev', label: 'Fondo anterior', description: 'Volver a un elemento anterior', run: () => renderNext(-1) },
        { id: 'pause', label: paused ? 'Reanudar rotación' : 'Pausar rotación', description: paused ? 'Los fondos volverán a rotar' : 'Mantener el fondo actual', run: () => { paused = !paused; schedule(); updateOverlay(); } },
        { id: 'admin', label: 'Abrir Admin', description: 'Gestionar fuentes, vídeos, dock y ajustes', run: () => { window.location.href = '/admin.html'; } },
        { id: 'privacy', label: privacyLocked ? 'Desactivar privacidad' : 'Activar privacidad', description: 'Bloquear navegación automática y ocultar avisos', run: () => onTogglePrivacy?.() }
      ]
    });
  }
  function applyAccent(src, fallback) {
    const color = fallback || '#7da2ff';
    el?.style.setProperty('--accent-color', color);
    if (!src || !String(src).startsWith('/assets/') || currentSlide?.mediaType === 'video') return;
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = 18; canvas.height = 18;
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, 18, 18);
        const data = ctx.getImageData(0, 0, 18, 18).data; let r=0,g=0,b=0,c=0;
        for (let i=0;i<data.length;i+=16) { if (data[i+3] < 180) continue; r+=data[i]; g+=data[i+1]; b+=data[i+2]; c++; }
        if (c) el.style.setProperty('--accent-color', `rgb(${Math.round(r/c)}, ${Math.round(g/c)}, ${Math.round(b/c)})`);
      } catch {}
    };
    img.src = src;
  }

  let startX = 0, startY = 0;
  function onPointerDown(event) { startX = event.clientX; startY = event.clientY; }
  function onPointerUp(event) {
    const dx = event.clientX - startX, dy = event.clientY - startY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) renderNext(dx < 0 ? 1 : -1);
  }

  return {
    id: 'dashboard',
    mount(target) {
      el = target;
      el.innerHTML = `<div class="dashboard-view">
        <div class="dashboard-stage"></div>
        <button class="dashboard-unread kiosk-control" type="button" hidden></button>
        <button class="dashboard-menu-button kiosk-control" type="button" aria-label="Opciones">${menuSvg()}</button>
        <button class="dashboard-mute-button kiosk-control" type="button" aria-label="Silenciar vídeo" hidden></button>
        <button class="privacy-lock-button kiosk-control" type="button" aria-label="Activar privacidad"></button>
        <div class="dashboard-progress"><div class="dashboard-progress__bar"></div></div>
      </div>`;
      el.querySelector('.dashboard-unread').addEventListener('click', (event) => { event.stopPropagation(); document.dispatchEvent(new CustomEvent('kiosk:open-notifications')); });
      el.querySelector('.privacy-lock-button').addEventListener('click', (event) => { event.stopPropagation(); onTogglePrivacy?.(); });
      el.querySelector('.dashboard-menu-button').addEventListener('click', (event) => { event.stopPropagation(); openMenu(); });
      el.querySelector('.dashboard-mute-button').addEventListener('click', (event) => { event.stopPropagation(); videoMuted = !videoMuted; updateOverlay(); });
      el.addEventListener('pointerdown', onPointerDown, { passive: true });
      el.addEventListener('pointerup', onPointerUp, { passive: true });
    },
    async show() {
      isVisible = true; el.classList.add('view--active'); el.setAttribute('aria-hidden', 'false');
      await loadData(); resetQueues(); if (!currentSlide) renderNext(1); else renderMedia(currentSlide);
    },
    hide() { isVisible = false; el.classList.remove('view--active'); el.setAttribute('aria-hidden', 'true'); clearInterval(timer); cancelAnimationFrame(progressFrame); stopBackgroundMotion(); },
    async update(data = {}) {
      if (Array.isArray(data.wallpapers)) wallpapers = data.wallpapers;
      if (Array.isArray(data.collections)) collections = data.collections;
      settings = data.settings ?? settings;
      if (typeof data.unreadCount === 'number') unreadCount = data.unreadCount;
      if (typeof data.privacyLocked === 'boolean') privacyLocked = data.privacyLocked;
      updateOverlay();
      if (!wallpapers.length && !collections.length && !('wallpapers' in data)) await loadData();
      if (isVisible && ('wallpapers' in data || 'collections' in data || 'settings' in data)) { resetQueues(); if (!currentSlide) renderNext(1); schedule(); }
    },
    destroy() { clearInterval(timer); cancelAnimationFrame(progressFrame); stopBackgroundMotion(); }
  };
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
