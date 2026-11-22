import { useEffect, useRef } from 'react';

/**
 * Дракон с эмблемы, плавающий по главному экрану.
 * Картинка режется на вертикальные полоски, каждая сдвигается по синусоиде — волна бежит от головы к хвосту.
 * Траектория — случайное блуждание с плавными поворотами и отталкиванием от краёв.
 */
export function Dragon() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext('2d')!;
    const img = new Image(); img.src = `${import.meta.env.BASE_URL}art/dragon.webp`;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0, alive = true;
    const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`; };
    resize(); addEventListener('resize', resize);

    const size = () => Math.min(380, Math.max(240, W * 0.55)); // длина дракона в пикселях экрана
    // Дракон не разворачивается на месте: он проплывает экран насквозь, исчезает за краем
    // и через пару секунд появляется с другой стороны на другой высоте.
    let x = 0, y = 0, th = 0, dir = 1, speed = 40, t = 0, wait = 0, base = 0;
    let targetSpeed = 40, nextChange = 0, wob = Math.random() * 10;
    const spawn = (first = false) => {
      const L = size();
      dir = Math.random() < 0.5 ? 1 : -1;
      x = first ? W * (dir > 0 ? 0.25 : 0.75) : dir > 0 ? -L * 0.6 : W + L * 0.6;
      base = 140 + Math.random() * Math.max(10, H - 300); y = base;
      th = dir > 0 ? 0 : Math.PI; speed = targetSpeed = 30 + Math.random() * 25;
    };
    spawn(true);

    const draw = () => {
      if (!img.complete || !img.naturalWidth) return;
      const L = size(), h = L * img.naturalHeight / img.naturalWidth;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      if (wait > 0) return;
      ctx.save(); ctx.translate(x, y);
      const tilt = Math.max(-0.28, Math.min(0.28, Math.atan2(Math.sin(th), Math.abs(Math.cos(th)))));
      ctx.rotate(tilt * dir); ctx.scale(dir, 1);
      const cols = 110, sw = img.naturalWidth / cols, dw = L / cols;
      const amp = h * 0.15, k = (Math.PI * 2) / (L * 0.8), w = 2.2 + speed / 45;
      for (let i = 0; i < cols; i++) {
        const px = i * dw;                       // 0 — хвост, L — голова
        const env = 0.2 + 0.8 * Math.pow(1 - px / L, 1.2); // голова почти неподвижна, хвост машет
        const dy = Math.sin(k * (L - px) + t * w) * amp * env;
        ctx.drawImage(img, i * sw, 0, sw + 0.7, img.naturalHeight, px - L / 2, dy - h / 2, dw + 0.7, h);
      }
      ctx.restore();
    };

    const step = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
      if (wait > 0) { wait -= dt; if (wait <= 0) spawn(); draw(); raf = requestAnimationFrame(step); return; }
      if (now > nextChange) { targetSpeed = 26 + Math.random() * 38; nextChange = now + 2000 + Math.random() * 3000; }
      speed += (targetSpeed - speed) * dt * 0.6;
      // плавное парение: курс колышется вокруг горизонтали, высота медленно дрейфует
      const sway = Math.sin(t * 0.45 + wob) * 0.22 + Math.sin(t * 0.17 + wob * 2) * 0.12;
      const pull = Math.max(-0.25, Math.min(0.25, (base - y) / 400));
      const want = (dir > 0 ? 0 : Math.PI) + (sway + pull) * dir;
      let d = want - th; d = Math.atan2(Math.sin(d), Math.cos(d)); th += d * dt * 1.2;
      if (Math.random() < dt * 0.15) base = Math.max(130, Math.min(H - 130, base + (Math.random() - 0.5) * 220));
      x += Math.cos(th) * speed * dt; y += Math.sin(th) * speed * dt;
      const L = size();
      if ((dir > 0 && x > W + L * 0.65) || (dir < 0 && x < -L * 0.65)) wait = 1.5 + Math.random() * 3;
      draw(); raf = requestAnimationFrame(step);
    };
    img.onload = () => { if (still) draw(); else raf = requestAnimationFrame(step); };
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!still) { last = 0; raf = requestAnimationFrame(step); } };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return <canvas ref={ref} aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}
