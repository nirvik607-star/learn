import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';

export interface TutorialStep {
  id: string;
  targetSelector: string;
  requiredTab:
    | 'agent_setup'
    | 'command_center'
    | 'quizlet_sprint'
    | 'socratic_graph'
    | 'mistakes_and_cram';
  stepLabel: string;
  title: string;
  text: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'step-1-agent',
    targetSelector: '[data-tour-id="tour-copy-prompt"]',
    requiredTab: 'agent_setup',
    stepLabel: '1 / 4',
    title: '1. Gather Your Class Materials',
    text: 'Copy this prompt (or open ChatGPT) and drop in your lecture slides, syllabus, or practice exams.',
  },
  {
    id: 'step-2-import',
    targetSelector: '[data-tour-id="tour-import-box"]',
    requiredTab: 'agent_setup',
    stepLabel: '2 / 4',
    title: '2. Paste Output to Build Set',
    text: 'Paste what your agent generates—or raw class notes—to create your study set at 0% progress.',
  },
  {
    id: 'step-3-auth',
    targetSelector: '[data-tour-id="tour-openai-auth"]',
    requiredTab: 'agent_setup',
    stepLabel: '3 / 4',
    title: '3. Connect Grok, Claude, or OpenAI',
    text: 'Link SuperGrok (xAI), Claude Pro / Max, OpenAI Codex, or API keys for deep AI curriculum architecture and personalized Socratic tutoring.',
  },
  {
    id: 'step-4-study',
    targetSelector: '[data-tour-id="tour-nav-modes"]',
    requiredTab: 'agent_setup',
    stepLabel: '4 / 4',
    title: '4. Study & Track Readiness (0–100%)',
    text: 'Run Quizlet Learn sprints, probe the concept graph, and reach 90%+ for A/A+ exam readiness.',
  },
];

interface SpotlightTutorialOverlayProps {
  isOpen: boolean;
  stepIndex: number;
  onChangeStep: (newIndex: number, requiredTab: TutorialStep['requiredTab']) => void;
  onClose: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const SpotlightTutorialOverlay: React.FC<SpotlightTutorialOverlayProps> = ({
  isOpen,
  stepIndex,
  onChangeStep,
  onClose,
}) => {
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [viewport, setViewport] = useState({
    vw: typeof window !== 'undefined' ? window.innerWidth : 1280,
    vh: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const currentStep = TUTORIAL_STEPS[stepIndex] || TUTORIAL_STEPS[0];

  const measureTarget = useCallback(() => {
    if (!isOpen) return;
    setViewport({ vw: window.innerWidth, vh: window.innerHeight });
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [isOpen, currentStep.targetSelector]);

  useEffect(() => {
    if (!isOpen) return;
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t1 = window.setTimeout(measureTarget, 80);
    const t2 = window.setTimeout(measureTarget, 300);
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [isOpen, stepIndex, currentStep.targetSelector, measureTarget]);

  if (!isOpen) return null;

  const { vw, vh } = viewport;
  const pad = 8;
  const boxTop = rect ? Math.max(8, rect.top - pad) : vh / 2 - 50;
  const boxLeft = rect ? Math.max(8, rect.left - pad) : vw / 2 - 100;
  const boxW = rect ? Math.min(vw - 16, rect.width + pad * 2) : 200;
  const boxH = rect ? Math.min(vh - 16, rect.height + pad * 2) : 100;

  // Bright Circle Beacon position
  const circleX = rect
    ? Math.min(vw - 44, Math.max(44, rect.left + Math.min(90, rect.width / 2)))
    : vw / 2;
  const circleY = rect
    ? Math.min(vh - 44, Math.max(36, rect.top + Math.min(28, rect.height / 2)))
    : vh / 3;
  const circleRadius = 24;

  // Compact tooltip card placement
  const cardWidth = Math.min(340, vw - 32);
  const placeCardBelow = boxTop < vh * 0.5;
  const cardTop = placeCardBelow
    ? Math.min(vh - 190, Math.max(16, boxTop + boxH + 38))
    : Math.max(16, boxTop - 185);
  const cardLeft = Math.min(
    vw - cardWidth - 16,
    Math.max(16, circleX - cardWidth / 2 + 24)
  );

  // Curved SVG arrow coordinates
  const arrowStartX = cardLeft + cardWidth * 0.45;
  const arrowStartY = placeCardBelow ? cardTop - 6 : cardTop + 152;
  const arrowEndX = circleX;
  const arrowEndY = placeCardBelow
    ? circleY + circleRadius + 6
    : circleY - circleRadius - 6;
  const ctrlX = (arrowStartX + arrowEndX) / 2 + 32;
  const ctrlY = (arrowStartY + arrowEndY) / 2;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} role="dialog" aria-modal="true">
      <svg
        width={vw}
        height={vh}
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none' }}
      >
        <defs>
          <mask id="lh-spot-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {rect && (
              <>
                <rect x={boxLeft} y={boxTop} width={boxW} height={boxH} rx="12" fill="black" />
                <circle cx={circleX} cy={circleY} r={circleRadius + 6} fill="black" />
              </>
            )}
          </mask>
          <marker id="lh-arrow" markerWidth="11" markerHeight="11" refX="8" refY="5.5" orient="auto">
            <path d="M 0 1 L 10 5.5 L 0 10 z" fill="#e2a336" />
          </marker>
        </defs>

        {/* Dimmed Screen */}
        <rect x="0" y="0" width={vw} height={vh} fill="rgba(5, 7, 10, 0.82)" mask="url(#lh-spot-mask)" />

        {/* Spotlight Outline */}
        {rect && (
          <rect
            x={boxLeft}
            y={boxTop}
            width={boxW}
            height={boxH}
            rx="10"
            fill="none"
            stroke="#e2a336"
            strokeWidth="1.5"
          />
        )}

        {/* Bright Circle Target */}
        <circle cx={circleX} cy={circleY} r={circleRadius + 9} fill="none" stroke="rgba(226, 163, 54, 0.35)" strokeWidth="2" />
        <circle cx={circleX} cy={circleY} r={circleRadius} fill="rgba(226, 163, 54, 0.14)" stroke="#e2a336" strokeWidth="2.5" />
        <circle cx={circleX} cy={circleY} r="4.5" fill="#e2a336" />

        {/* Curved Arrow */}
        <path
          d={`M ${arrowStartX} ${arrowStartY} Q ${ctrlX} ${ctrlY} ${arrowEndX} ${arrowEndY}`}
          fill="none"
          stroke="#e2a336"
          strokeWidth="2.25"
          markerEnd="url(#lh-arrow)"
        />
      </svg>

      {/* Compact Tooltip Card */}
      <div
        style={{
          position: 'fixed',
          top: `${cardTop}px`,
          left: `${cardLeft}px`,
          width: `${cardWidth}px`,
          background: '#0f1217',
          color: '#f2f4f8',
          border: '1px solid rgba(226, 163, 54, 0.48)',
          borderRadius: '10px',
          padding: '14px 16px',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 20px 48px rgba(0, 0, 0, 0.78)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e2a336', letterSpacing: '0.06em' }}>
            STEP {currentStep.stepLabel}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ba3b2',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
            }}
            aria-label="Close tutorial"
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ fontWeight: 600, fontSize: '0.96rem', color: '#f2f4f8', letterSpacing: '-0.015em' }}>
          {currentStep.title}
        </div>

        <p style={{ fontSize: '0.82rem', color: '#9ba3b2', lineHeight: 1.48 }}>
          {currentStep.text}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {TUTORIAL_STEPS.map((st, idx) => (
              <span
                key={st.id}
                style={{
                  width: idx === stepIndex ? '16px' : '6px',
                  height: '5px',
                  borderRadius: '3px',
                  background: idx === stepIndex ? '#e2a336' : 'rgba(155, 163, 178, 0.28)',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {stepIndex > 0 && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  const prev = stepIndex - 1;
                  onChangeStep(prev, TUTORIAL_STEPS[prev].requiredTab);
                }}
              >
                <ArrowLeft size={13} />
              </button>
            )}
            {stepIndex < TUTORIAL_STEPS.length - 1 ? (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  const next = stepIndex + 1;
                  onChangeStep(next, TUTORIAL_STEPS[next].requiredTab);
                }}
              >
                Next <ArrowRight size={13} />
              </button>
            ) : (
              <button className="btn btn-sm btn-primary" onClick={onClose}>
                <Check size={13} /> Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
