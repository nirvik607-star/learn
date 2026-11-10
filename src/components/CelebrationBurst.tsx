import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface CelebrationBurstProps {
  /** Changing this key fires a new burst. null hides it. */
  burstKey: number | null;
  label: string;
}

/** Full-screen particle burst + spring banner when a node is promoted to a new mastery tier. */
export const CelebrationBurst: React.FC<CelebrationBurstProps> = ({ burstKey, label }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (burstKey == null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const palette = ['--accent-primary', '--tier-3', '--tier-2', '--tier-1'].map((v) => css.getPropertyValue(v).trim() || '#8b6cf6');
    const cx = innerWidth / 2;
    const cy = innerHeight * 0.38;
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 9;
      return { x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, r: 2 + Math.random() * 3.5, c: palette[(Math.random() * palette.length) | 0], life: 1, spin: Math.random() * 6 };
    });
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      let alive = false;
      parts.forEach((p) => {
        p.vy += 0.22;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.011;
        p.spin += 0.2;
        if (p.life > 0) {
          alive = true;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.c;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin);
          ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
          ctx.restore();
        }
      });
      if (alive) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burstKey]);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9000 }} />
      <AnimatePresence>
        {burstKey != null && (
          <motion.div
            key={burstKey}
            initial={{ opacity: 0, y: -40, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            style={{
              position: 'fixed',
              top: 72,
              left: '50%',
              translateX: '-50%',
              zIndex: 9001,
              padding: '10px 18px',
              borderRadius: 9999,
              background: 'var(--bg-surface)',
              border: '1px solid var(--accent-primary)',
              boxShadow: '0 0 40px var(--accent-glow)',
              fontWeight: 600,
              fontSize: '0.88rem',
              pointerEvents: 'none',
            }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
