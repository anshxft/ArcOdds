// Lenis smooth scrolling. Skipped for reduced-motion users; touch keeps native scrolling.
// When GSAP is on the page, Lenis runs on GSAP's ticker so ScrollTrigger stays in sync.
// Put data-lenis-prevent on any element that should scroll on its own (modals, lists).
(function () {
  if (!window.Lenis || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const gsap = window.gsap;
  const lenis = new Lenis({ autoRaf: !gsap });
  // Lenis' own `anchors` option lets the browser jump first, so handle in-page links here.
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    const id = link && decodeURIComponent(link.getAttribute("href").slice(1));
    const target = id && document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target, { offset: -(document.querySelector("nav")?.offsetHeight || 0) - 12 });
    history.pushState(null, "", `#${id}`);
  });
  if (gsap) {
    if (window.ScrollTrigger) lenis.on("scroll", window.ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  window.PredictArcLenis = lenis;
})();
