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

    const size = () => Math.min(340, Math.max(220, W * 0.7)); // длина дракона в пикселях экрана
    let x = W * 0.3, y = H * 0.35, th = (Math.random() - 0.5) * 0.6, turn = 0, speed = 38, t = 0, face = 1;
    let targetSpeed = 40, nextChange = 0;

    const draw = () => {
      if (!img.complete || !img.naturalWidth) return;
      const L = size(), h = L * img.naturalHeight / img.naturalWidth;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.translate(x, y);
      const dir = Math.cos(th) >= 0 ? 1 : -1; face += (dir - face) * 0.08; // мягкий разворот
      const tilt = Math.max(-0.32, Math.min(0.32, Math.atan2(Math.sin(th), Math.abs(Math.cos(th))) * 0.5));
      ctx.rotate(tilt * dir); ctx.scale(face, 1);
      ctx.globalAlpha = 0.5;
      const cols = 90, sw = img.naturalWidth / cols, dw = L / cols;
      const amp = h * 0.16, k = (Math.PI * 2) / (L * 0.75), w = 2.6 + speed / 40;
      for (let i = 0; i < cols; i++) {
        const px = i * dw;                       // 0 — хвост, L — голова
        const env = 0.25 + 0.75 * (1 - px / L);  // хвост машет сильнее головы
        const dy = Math.sin(k * (L - px) + t * w) * amp * env;
        ctx.drawImage(img, i * sw, 0, sw + 0.6, img.naturalHeight, px - L / 2, dy - h / 2, dw + 0.6, h);
      }
      ctx.restore();
    };

    const step = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
      if (now > nextChange) { targetSpeed = 22 + Math.random() * 45; turn = (Math.random() - 0.5) * 0.9; nextChange = now + 1500 + Math.random() * 3000; }
      speed += (targetSpeed - speed) * dt * 0.8;
      // отталкивание от краёв: разворачиваем к центру
      const m = size() * 0.45;
      const cx = W / 2 - x, cy = H / 2 - y;
      if (x < m || x > W - m || y < 110 || y > H - 110) { const want = Math.atan2(cy, cx); let d = want - th; d = Math.atan2(Math.sin(d), Math.cos(d)); th += d * dt * 1.4; }
      th += turn * dt * 0.6 + Math.sin(t * 0.7) * dt * 0.15;
      // держим курс ближе к горизонтали: дракон плывёт, а не падает
      const hor = Math.cos(th) >= 0 ? 0 : Math.PI; let dh = hor - th; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); th += dh * dt * 0.5;
      x += Math.cos(th) * speed * dt; y += Math.sin(th) * speed * dt * 0.45;
      draw(); raf = requestAnimationFrame(step);
    };
    img.onload = () => { if (still) draw(); else raf = requestAnimationFrame(step); };
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!still) { last = 0; raf = requestAnimationFrame(step); } };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return <canvas ref={ref} aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 2 }} />;
}
