import React, { useEffect, useRef } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type { CoursePack, MasteryTier, NodeMasteryState } from '../types/harness';

interface GNode extends SimulationNodeDatum {
  id: string;
  title: string;
  tier: MasteryTier;
  weight: number;
  root: boolean;
}
type GLink = SimulationLinkDatum<GNode>;

interface ForceGraphProps {
  course: CoursePack;
  masteryMap: Record<string, NodeMasteryState>;
  unitFilter: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  height?: number;
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Obsidian-style force-directed knowledge graph on canvas (zoom, pan, drag, hover-highlight, click-to-open). */
export const ForceGraph: React.FC<ForceGraphProps> = ({ course, masteryMap, unitFilter, selectedId, onSelect, height = 620 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation<GNode, GLink> | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  const linksRef = useRef<GLink[]>([]);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(selectedId);
  const pulseRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  selectedRef.current = selectedId;

  // Keep tier colors live when mastery changes without restarting the layout
  useEffect(() => {
    nodesRef.current.forEach((n) => {
      n.tier = (masteryMap[n.id]?.tier || 0) as MasteryTier;
    });
  }, [masteryMap]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    let w = wrap.clientWidth;
    const h = height;
    const resize = () => {
      w = wrap.clientWidth;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();

    const src = unitFilter ? course.nodes.filter((n) => n.unitId === unitFilter) : course.nodes;
    const ids = new Set(src.map((n) => n.id));
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const nodes: GNode[] = src.map((n) => {
      const p = prev.get(n.id);
      return {
        id: n.id,
        title: n.title,
        tier: (masteryMap[n.id]?.tier || 0) as MasteryTier,
        weight: n.examWeight,
        root: n.isUnconditionalTruth,
        x: p?.x ?? (Math.random() - 0.5) * 200,
        y: p?.y ?? (Math.random() - 0.5) * 200,
      };
    });
    const links: GLink[] = src.flatMap((n) => n.prerequisites.filter((p) => ids.has(p)).map((p) => ({ source: p, target: n.id })));
    nodesRef.current = nodes;
    linksRef.current = links;

    const radius = (n: GNode) => 4 + n.weight * 1.8;
    const sim = forceSimulation<GNode>(nodes)
      .force('link', forceLink<GNode, GLink>(links).id((d) => d.id).distance(70).strength(0.6))
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.04))
      .force('collide', forceCollide<GNode>().radius((d) => radius(d) + 6))
      .alphaDecay(0.02);
    simRef.current = sim;
    view.current = { x: w / 2, y: h / 2, k: 1 };

    const neighbors = (id: string) => {
      const s = new Set<string>([id]);
      links.forEach((l) => {
        const a = (l.source as GNode).id;
        const b = (l.target as GNode).id;
        if (a === id) s.add(b);
        if (b === id) s.add(a);
      });
      return s;
    };

    let raf = 0;
    const draw = () => {
      pulseRef.current += 0.04;
      const colors = {
        bg: cssVar('--bg-canvas', '#1e1e1e'),
        line: cssVar('--border-strong', 'rgba(255,255,255,0.14)'),
        text: cssVar('--text-secondary', '#a3a3a3'),
        textHi: cssVar('--text-primary', '#dadada'),
        accent: cssVar('--accent-primary', '#8b6cf6'),
        tiers: [cssVar('--tier-0', '#5a5a5a'), cssVar('--tier-1', '#e0ac00'), cssVar('--tier-2', '#53dfdd'), cssVar('--tier-3', '#44cf6e')],
      };
      const { x: tx, y: ty, k } = view.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);

      const focus = hoverRef.current || selectedRef.current;
      const near = focus ? neighbors(focus) : null;

      // edges with direction arrows (prerequisite -> dependent)
      links.forEach((l) => {
        const a = l.source as GNode;
        const b = l.target as GNode;
        if (a.x == null || b.x == null) return;
        const hi = near && near.has(a.id) && near.has(b.id) && (a.id === focus || b.id === focus);
        ctx.globalAlpha = near ? (hi ? 1 : 0.12) : 0.55;
        ctx.strokeStyle = hi ? colors.accent : colors.line;
        ctx.lineWidth = (hi ? 1.6 : 1) / k;
        ctx.beginPath();
        ctx.moveTo(a.x!, a.y!);
        ctx.lineTo(b.x!, b.y!);
        ctx.stroke();
        const ang = Math.atan2(b.y! - a.y!, b.x! - a.x!);
        const r = radius(b) + 3;
        const ax = b.x! - Math.cos(ang) * r;
        const ay = b.y! - Math.sin(ang) * r;
        ctx.fillStyle = hi ? colors.accent : colors.line;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(ang - 0.4) * 6, ay - Math.sin(ang - 0.4) * 6);
        ctx.lineTo(ax - Math.cos(ang + 0.4) * 6, ay - Math.sin(ang + 0.4) * 6);
        ctx.fill();
      });

      nodes.forEach((n) => {
        if (n.x == null) return;
        const r = radius(n);
        const dim = near && !near.has(n.id);
        const isSel = n.id === selectedRef.current;
        ctx.globalAlpha = dim ? 0.18 : 1;
        if (isSel) {
          const pr = r + 5 + Math.sin(pulseRef.current) * 2.5;
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 2 / k;
          ctx.beginPath();
          ctx.arc(n.x, n.y!, pr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowColor = colors.accent;
          ctx.shadowBlur = 18;
        }
        ctx.fillStyle = colors.tiers[n.tier];
        ctx.beginPath();
        ctx.arc(n.x, n.y!, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (n.root) {
          ctx.strokeStyle = colors.textHi;
          ctx.lineWidth = 1.2 / k;
          ctx.stroke();
        }
        const showLabel = k > 0.75 || n.id === focus || (near && near.has(n.id));
        if (showLabel) {
          ctx.globalAlpha = dim ? 0.15 : 1;
          ctx.fillStyle = n.id === focus || isSel ? colors.textHi : colors.text;
          ctx.font = `${n.id === focus ? 600 : 500} ${11 / Math.max(k, 0.8)}px Instrument Sans, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(n.title.length > 34 ? `${n.title.slice(0, 32)}…` : n.title, n.x, n.y! + r + 13 / Math.max(k, 0.8));
        }
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // Interaction: pan, zoom, drag, hover, click
    const toWorld = (cx: number, cy: number) => {
      const { x, y, k } = view.current;
      return { x: (cx - x) / k, y: (cy - y) / k };
    };
    const pick = (cx: number, cy: number) => {
      const p = toWorld(cx, cy);
      let best: GNode | null = null;
      let bd = Infinity;
      nodes.forEach((n) => {
        const d = Math.hypot((n.x || 0) - p.x, (n.y || 0) - p.y);
        if (d < radius(n) + 6 && d < bd) {
          bd = d;
          best = n;
        }
      });
      return best as GNode | null;
    };
    let drag: GNode | null = null;
    let panning = false;
    let moved = false;
    let last = { x: 0, y: 0 };
    const rel = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      const p = rel(e);
      moved = false;
      last = p;
      drag = pick(p.x, p.y);
      if (drag) {
        sim.alphaTarget(0.3).restart();
        drag.fx = drag.x;
        drag.fy = drag.y;
      } else panning = true;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const p = rel(e);
      if (Math.hypot(p.x - last.x, p.y - last.y) > 3) moved = true;
      if (drag) {
        const wpt = toWorld(p.x, p.y);
        drag.fx = wpt.x;
        drag.fy = wpt.y;
      } else if (panning) {
        view.current.x += p.x - last.x;
        view.current.y += p.y - last.y;
        last = p;
      } else {
        const hit = pick(p.x, p.y);
        hoverRef.current = hit?.id || null;
        canvas.style.cursor = hit ? 'pointer' : 'grab';
      }
    };
    const onUp = () => {
      if (drag) {
        if (!moved) onSelectRef.current(drag.id);
        sim.alphaTarget(0);
        drag.fx = null;
        drag.fy = null;
      }
      drag = null;
      panning = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const v = view.current;
      const nk = Math.min(4, Math.max(0.25, v.k * Math.exp(-e.deltaY * 0.0015)));
      v.x = cx - ((cx - v.x) / v.k) * nk;
      v.y = cy - ((cy - v.y) / v.k) * nk;
      v.k = nk;
    };
    const onLeave = () => (hoverRef.current = null);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      sim.stop();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, unitFilter, height]);

  return (
    <div ref={wrapRef} className="graph-canvas-wrap" style={{ height }}>
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'grab', touchAction: 'none' }} />
      <div className="graph-legend">
        <span><i className="tier-dot" style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--tier-0)' }} />Unseen</span>
        <span><i style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--tier-1)' }} />Familiar</span>
        <span><i style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--tier-2)' }} />Learned</span>
        <span><i style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--tier-3)' }} />Mastered</span>
        <span>◯ ring = unconditional truth · size = exam weight</span>
      </div>
    </div>
  );
};
