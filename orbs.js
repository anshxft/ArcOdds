// Thinking-orb loaders for plain HTML. Drop a canvas anywhere, including HTML
// rendered later via innerHTML:
//   <canvas data-orb="searching" data-orb-size="20"></canvas>
// States: working searching solving listening connecting weaving composing breathing shaping
// Sizes: 64 (default) or 20. Load with <script type="module" src="orbs.js">.
import { resolvePreset, MODE_DRAWS } from "./assets/vendor/thinking-orbs/engine.es.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const isDark = () => document.documentElement.dataset.theme !== "light";
const visible = new Set();

function setup(canvas) {
  if (canvas._orb) return;
  const size = Number(canvas.dataset.orbSize) === 20 ? 20 : 64;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = canvas.height = Math.round(size * dpr);
  canvas.style.width = canvas.style.height = `${size}px`;
  canvas.setAttribute("role", "img");
  if (!canvas.hasAttribute("aria-label")) canvas.setAttribute("aria-label", "Loading");
  canvas._orb = { ctx: canvas.getContext("2d"), size, dpr };
  paint(canvas, performance.now() / 1000); // first frame right away, before the observer reports
  observer.observe(canvas);
}

function paint(canvas, t) {
  const { ctx, size, dpr } = canvas._orb;
  const { mode, speed, opts } = resolvePreset(canvas.dataset.orb || "working", size);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  MODE_DRAWS[mode](ctx, size, reduced.matches ? 0.6 : t * speed, isDark(), opts);
}

// Only animate orbs on screen; one shared clock keeps them in phase.
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) visible.add(entry.target);
    else visible.delete(entry.target);
    paint(entry.target, performance.now() / 1000);
  });
});

function loop(now) {
  visible.forEach((canvas) => (canvas.isConnected ? paint(canvas, now / 1000) : visible.delete(canvas)));
  requestAnimationFrame(loop);
}

function scan(root = document) {
  root.querySelectorAll?.("canvas[data-orb]").forEach(setup);
}

new MutationObserver((mutations) => mutations.forEach((m) => m.addedNodes.forEach((node) => {
  if (node.nodeType !== 1) return;
  if (node.matches("canvas[data-orb]")) setup(node);
  scan(node);
}))).observe(document.documentElement, { childList: true, subtree: true });

scan();
requestAnimationFrame(loop);
window.PredictArcOrbs = { scan };
