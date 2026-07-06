export class ViewManager {
  constructor(root) {
    this.root = root;
    this.views = new Map();
    this.activeId = null;
    this.hideTimers = new Map();
  }

  register(view) {
    this.views.set(view.id, view);
    view.mount(this.root.querySelector(`[data-view="${view.id}"]`));
  }

  show(id) {
    if (!this.views.has(id) || id === this.activeId) return;

    const previous = this.views.get(this.activeId);
    const next = this.views.get(id);
    const nextEl = this.root.querySelector(`[data-view="${id}"]`);

    const pendingHide = this.hideTimers.get(id);
    if (pendingHide) {
      clearTimeout(pendingHide);
      this.hideTimers.delete(id);
    }

    // Fuerza que la vista entrante vuelva al árbol de render antes de animarla.
    nextEl.classList.remove("view--render-hidden");
    nextEl.offsetHeight;

    previous?.hide();
    next.show();

    if (this.activeId) {
      const previousId = this.activeId;
      const previousEl = this.root.querySelector(`[data-view="${previousId}"]`);
      const timer = setTimeout(() => {
        previousEl.classList.add("view--render-hidden");
        this.hideTimers.delete(previousId);
      }, 460);
      this.hideTimers.set(previousId, timer);
    }

    this.activeId = id;
  }

  update(id, data) { this.views.get(id)?.update(data); }
  notify(id, data) { this.views.get(id)?.notify?.(data); }
}
