// Confetti when an element reaches 100% (§10). Self-contained (no library, one canvas that
// removes itself). It always plays (owner's choice); when the device asks for reduced motion it's
// a calm version: fewer pieces drifting down slowly from the top, no burst or spin.

const COLOURS = ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#9B5DE5'];

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function celebrate(): void {
  if (typeof document === 'undefined') return;
  const calm = prefersReducedMotion();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '60',
  });
  document.body.appendChild(canvas);
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: calm ? 40 : 120 }, (_, i) =>
    calm
      ? {
          x: Math.random() * w,
          y: -20 - Math.random() * h * 0.3,
          vx: 0,
          vy: 1.5 + Math.random() * 1.5,
          size: 7 + Math.random() * 5,
          spin: 0,
          angle: Math.random() * Math.PI,
          colour: COLOURS[i % COLOURS.length]!,
        }
      : {
          x: w / 2 + (Math.random() - 0.5) * w * 0.3,
          y: h * 0.35,
          vx: (Math.random() - 0.5) * 12,
          vy: -Math.random() * 12 - 4,
          size: 6 + Math.random() * 6,
          spin: (Math.random() - 0.5) * 0.4,
          angle: Math.random() * Math.PI,
          colour: COLOURS[i % COLOURS.length]!,
        },
  );
  const gravity = calm ? 0 : 0.35;

  const start = performance.now();
  const DURATION = calm ? 2500 : 1500;
  function frame(now: number) {
    const t = now - start;
    ctx!.clearRect(0, 0, w, h);
    ctx!.globalAlpha = Math.max(0, 1 - t / DURATION);
    for (const p of pieces) {
      p.vy += gravity;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.angle);
      ctx!.fillStyle = p.colour;
      ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx!.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
