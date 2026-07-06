export class ViewManager {
  constructor(root, { debug = () => {} } = {}) {
    this.root = root;
    this.debug = debug;
    this.views = new Map();
    this.activeId = null;
    this.hideTimers = new Map();
  }

  register(view) {
    this.views.set(view.id, view);
    const target = this.root.querySelector(`[data-view="${view.id}"]`);
    if (!target) throw new Error(`No existe el contenedor de la vista: ${view.id}`);
    view.mount(target);
    this.debug("Vista registrada", view.id);
  }

  show(id) {
    if (!this.views.has(id)) {
      this.debug("No se puede mostrar una vista no registrada", id);
      return;
    }

    if (id === this.activeId) {
      this.debug("La vista solicitada ya está activa", id);
      return;
    }

    this.debug("Cambiando vista", { from: this.activeId, to: id });
    const previous = this.views.get(this.activeId);
    const next = this.views.get(id);
    const nextEl = this.root.querySelector(`[data-view="${id}"]`);

    const pendingHide = this.hideTimers.get(id);
    if (pendingHide) {
      clearTimeout(pendingHide);
      this.hideTimers.delete(id);
    }

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
        this.debug("Vista retirada del render", previousId);
      }, 460);
      this.hideTimers.set(previousId, timer);
    }

    this.activeId = id;
  }

  call(id, method, ...args) {
    const view = this.views.get(id);
    if (typeof view?.[method] !== "function") {
      this.debug("Método de vista no disponible", { id, method });
      return;
    }
    view[method](...args);
  }

  update(id, data) { this.views.get(id)?.update(data); }
  notify(id, data) { this.views.get(id)?.notify?.(data); }
}
