export function createIdleView() {
  let el;
  return { id: "idle", mount(target) { el = target; }, show() { el.classList.add("view--active"); el.setAttribute("aria-hidden", "false"); }, hide() { el.classList.remove("view--active"); el.setAttribute("aria-hidden", "true"); }, update() {} };
}
