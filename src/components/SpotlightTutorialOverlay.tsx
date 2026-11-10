import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Sparkles,
  X,
} from 'lucide-react';

export interface TutorialStep {
  id: string;
  targetSelector: string;
  requiredTab:
    | 'agent_setup'
    | 'command_center'
    | 'quizlet_sprint'
    | 'socratic_graph'
    | 'mistakes_and_cram';
  badge: string;
  title: string;
  explanation: string;
  actionBullets: string[];
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'step-1-agent-harvester',
    targetSelector: '[data-tour-id="tour-agent-playbook"]',
    requiredTab: 'agent_setup',
    badge: 'STEP 1 OF 6 · AGENT CLASS HARVESTER',
    title: 'How Your AI Agent Gathers All Your Class Materials',
    explanation:
      'No pre-filled fluff: this workspace starts 100% clean for your real college exams. Follow this 4-step playbook to have OpenAI Codex, ChatGPT, or Claude Code read all your syllabus PDFs, lecture slides, and practice exams and assemble your course automatically.',
    actionBullets: [
      '1. Drop your lecture slides, PDFs, syllabus, and past exams into one folder on your Mac (or attach them in ChatGPT / Codex).',
      '2. Enter your Course Code & Exam Name in Step 2 below to generate your custom Master Harvester Prompt.',
      '3. Your agent extracts every 80/20 Pareto generator, prerequisite chain, and 4-stage Quizlet Learn question automatically.',
    ],
  },
  {
    id: 'step-2-master-prompt',
    targetSelector: '[data-tour-id="tour-copy-prompt"]',
    requiredTab: 'agent_setup',
    badge: 'STEP 2 OF 6 · 1-CLICK MASTER AGENT PROMPT',
    title: 'Copy the Master Prompt & Run Your Agent',
    explanation:
      'Click "Copy Master Agent Prompt" here and paste it into OpenAI Codex (Mac app or CLI), ChatGPT, or Claude Code. It forces the agent to follow the strict LearnHarness schema so your study rounds run at 0ms latency and 0 token cost.',
    actionBullets: [
      'Works with OpenAI Codex CLI (`codex`), ChatGPT file uploads, or Claude Code (`claude`).',
      'Instructs your agent to separate Principle (i) Unconditional Truths from Principle (ii) Motivated Derivations.',
      'Outputs a single CoursePack JSON block ready to paste or drop into Step 3.',
    ],
  },
  {
    id: 'step-3-openai-auth',
    targetSelector: '[data-tour-id="tour-openai-auth"]',
    requiredTab: 'agent_setup',
    badge: 'STEP 3 OF 6 · OPENAI ACCOUNT AUTHENTICATION',
    title: 'Connect Your OpenAI Account (OAuth, Codex Login, or API Key)',
    explanation:
      'Authenticate your OpenAI account here so live Socratic hints, Strict Examiner stress-tests, and AI course compilation run directly through your OpenAI login.',
    actionBullets: [
      'Option A (OpenAI Account PKCE OAuth / Codex Login): Sign in via auth.openai.com or run `npx @openai/codex login` (uses your ChatGPT Plus/Pro/Edu account) and paste your token.',
      'Option B (Local Mac Bridge): If you run `./scripts/mac-codex-setup.sh` on your Mac, GitHub Pages connects directly to your local Codex/OAuth session.',
      'Option C (Direct OpenAI API Key): Enter an `sk-...` key and click "Verify OpenAI Account Connection" to test live in your browser.',
    ],
  },
  {
    id: 'step-4-import-compile',
    targetSelector: '[data-tour-id="tour-import-box"]',
    requiredTab: 'agent_setup',
    badge: 'STEP 4 OF 6 · BUILD YOUR CLEAN COURSE WORKSPACE',
    title: 'Paste or Drop Your Agent Output (or Raw Lecture Notes)',
    explanation:
      'Once your agent finishes reading your class materials, paste its JSON output (or raw `# Unit` + `Concept: Explanation` notes) right here and click "Build My Course Pack". Your course loads with a clean 0% progress slate.',
    actionBullets: [
      'Accepts full Agent CoursePack JSON files (.json) OR plain-text lecture notes (.md / .txt).',
      'Want to test the study tools before importing your own class? Click "Load Optional Sample Course (0% Clean Progress)" right inside this box.',
    ],
  },
  {
    id: 'step-5-readiness-score',
    targetSelector: '[data-tour-id="tour-nav-readiness"]',
    requiredTab: 'agent_setup',
    badge: 'STEP 5 OF 6 · UNIT & OVERALL EXAM READINESS (0–100%)',
    title: 'Real-Time 0–100% Exam Readiness & A/A+ Predictor',
    explanation:
      'This tab tracks your live Unit & Overall Exam Readiness from 0% to 100%. Reaching 90–100% means you have verified unaided retrieval across all 80/20 high-yield concepts and are on track for an A or A+.',
    actionBullets: [
      'Tracks Quizlet Learn 4-Stage Mastery: Unseen (0) → Familiar (1) → Learned (2) → Mastered (3).',
      'Accounts for Ebbinghaus/FSRS memory decay over time so you know exactly which unit needs a quick refresher before exam day.',
    ],
  },
  {
    id: 'step-6-study-modes',
    targetSelector: '[data-tour-id="tour-nav-modes"]',
    requiredTab: 'agent_setup',
    badge: 'STEP 6 OF 6 · QUIZLET LEARN SPRINTS, GRAPH & MISTAKE LOG',
    title: 'Incremental Sprints, Binary-Search Probe & Mistake Notebook',
    explanation:
      'Use these three study engines to reach 100% readiness in half the time:',
    actionBullets: [
      '⚡ Quizlet Learn Sprint: Adaptive 7-question rounds with Cover-Options mode, Confidence Calibration, and the R0–R5 Minimal Hint Ladder.',
      '🕸 Socratic Graph & Probe: Binary-search your prerequisite graph (`floor_held` auto-credits upstream prerequisites!) and step through Predict → Teach → Check.',
      '📓 Mistakes & 80/20 Cram: Every miss is classified into your "Screw-Up Log" alongside a 1-Page Pre-Exam Cram Sheet.',
    ],
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
  centerX: number;
  centerY: number;
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
      centerX: r.left + r.width / 2,
      centerY: r.top + r.height / 2,
    });
  }, [isOpen, currentStep.targetSelector]);

  useEffect(() => {
    if (!isOpen) return;
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t1 = window.setTimeout(measureTarget, 120);
    const t2 = window.setTimeout(measureTarget, 380);
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
  const pad = 10;
  const boxTop = rect ? Math.max(8, rect.top - pad) : vh / 2 - 60;
  const boxLeft = rect ? Math.max(8, rect.left - pad) : vw / 2 - 120;
  const boxW = rect ? Math.min(vw - 16, rect.width + pad * 2) : 240;
  const boxH = rect ? Math.min(vh - 16, rect.height + pad * 2) : 120;

  // Bright Circle Beacon position (top-left or center-top of the highlighted element)
  const circleX = rect
    ? Math.min(vw - 48, Math.max(48, rect.left + Math.min(140, rect.width / 2)))
    : vw / 2;
  const circleY = rect
    ? Math.min(vh - 48, Math.max(36, rect.top + Math.min(32, rect.height / 2)))
    : vh / 3;
  const circleRadius = 28;

  // Determine where to place the floating explanation card so it doesn't cover the spotlight
  const cardWidth = Math.min(480, vw - 32);
  const placeCardBelow = boxTop < vh * 0.46;
  const cardTop = placeCardBelow
    ? Math.min(vh - 340, Math.max(20, boxTop + boxH + 46))
    : Math.max(16, boxTop - 320);
  const cardLeft = Math.min(
    vw - cardWidth - 16,
    Math.max(16, circleX - cardWidth / 2 + 40)
  );

  // Compute SVG Arrow start (on card edge) and end (pointing to the bright glowing circle)
  const arrowStartX = cardLeft + cardWidth * 0.45;
  const arrowStartY = placeCardBelow ? cardTop - 6 : cardTop + 290;
  const arrowEndX = circleX;
  const arrowEndY = placeCardBelow
    ? circleY + circleRadius + 6
    : circleY - circleRadius - 6;
  const ctrlX = (arrowStartX + arrowEndX) / 2 + (arrowStartX > arrowEndX ? -45 : 45);
  const ctrlY = (arrowStartY + arrowEndY) / 2;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
      aria-modal="true"
      role="dialog"
    >
      {/* Full-Screen Dimmed Backdrop + Spotlight Cutout + Bright Pulsing Circles + Curved Arrow */}
      <svg
        width={vw}
        height={vh}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <mask id="learnharness-spotlight-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {rect && (
              <>
                <rect
                  x={boxLeft}
                  y={boxTop}
                  width={boxW}
                  height={boxH}
                  rx="12"
                  ry="12"
                  fill="black"
                />
                <circle cx={circleX} cy={circleY} r={circleRadius + 8} fill="black" />
              </>
            )}
          </mask>
          <marker
            id="spotlight-arrowhead"
            markerWidth="12"
            markerHeight="12"
            refX="9"
            refY="6"
            orient="auto"
          >
            <path d="M 0 1 L 11 6 L 0 11 z" fill="#38BDF8" />
          </marker>
          <filter id="bright-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dimmed Screen Overlay */}
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="rgba(4, 7, 15, 0.84)"
          mask="url(#learnharness-spotlight-mask)"
        />

        {/* Highlighted Box Outline */}
        {rect && (
          <rect
            x={boxLeft}
            y={boxTop}
            width={boxW}
            height={boxH}
            rx="12"
            ry="12"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2.5"
            strokeDasharray="8 4"
            filter="url(#bright-glow)"
          />
        )}

        {/* Bright Glowing Target Circle & Halo */}
        <circle
          cx={circleX}
          cy={circleY}
          r={circleRadius + 12}
          fill="none"
          stroke="rgba(56, 189, 248, 0.45)"
          strokeWidth="3"
        />
        <circle
          cx={circleX}
          cy={circleY}
          r={circleRadius}
          fill="rgba(56, 189, 248, 0.14)"
          stroke="#FBBF24"
          strokeWidth="3.5"
          filter="url(#bright-glow)"
        />
        <circle cx={circleX} cy={circleY} r="6" fill="#FBBF24" />

        {/* Curved Bright Arrow from Explanation Card to the Bright Circle */}
        <path
          d={`M ${arrowStartX} ${arrowStartY} Q ${ctrlX} ${ctrlY} ${arrowEndX} ${arrowEndY}`}
          fill="none"
          stroke="#38BDF8"
          strokeWidth="3.5"
          markerEnd="url(#spotlight-arrowhead)"
          filter="url(#bright-glow)"
        />
        <circle cx={arrowStartX} cy={arrowStartY} r="5" fill="#38BDF8" />
      </svg>

      {/* Floating Step-by-Step Explanation Card */}
      <div
        style={{
          position: 'fixed',
          top: `${cardTop}px`,
          left: `${cardLeft}px`,
          width: `${cardWidth}px`,
          background: '#0F172A',
          color: '#F8FAFC',
          border: '2px solid #38BDF8',
          borderRadius: '14px',
          padding: '20px 22px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 28px rgba(56, 189, 248, 0.28)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: '6px',
              background: 'rgba(56, 189, 248, 0.18)',
              color: '#38BDF8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
            }}
          >
            <Compass size={12} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
            {currentStep.badge}
          </span>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(148, 163, 184, 0.15)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              color: '#CBD5E1',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.74rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <X size={13} /> Skip Tour
          </button>
        </div>

        <h3
          className="serif-heading"
          style={{ fontSize: '1.35rem', color: '#FFFFFF', lineHeight: 1.2 }}
        >
          {currentStep.title}
        </h3>

        <p style={{ fontSize: '0.86rem', color: '#CBD5E1', lineHeight: 1.55 }}>
          {currentStep.explanation}
        </p>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {currentStep.actionBullets.map((b, i) => (
            <div
              key={i}
              style={{
                fontSize: '0.8rem',
                color: '#E2E8F0',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
              }}
            >
              <Sparkles
                size={13}
                style={{ color: '#FBBF24', flexShrink: 0, marginTop: '3px' }}
              />
              <span>{b}</span>
            </div>
          ))}
        </div>

        {/* Step Navigation Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '6px',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
          }}
        >
          {/* Step Dots */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {TUTORIAL_STEPS.map((st, idx) => (
              <button
                key={st.id}
                onClick={() => onChangeStep(idx, st.requiredTab)}
                style={{
                  width: idx === stepIndex ? '22px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: idx === stepIndex ? '#38BDF8' : 'rgba(148, 163, 184, 0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {stepIndex > 0 && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  const prevIdx = stepIndex - 1;
                  onChangeStep(prevIdx, TUTORIAL_STEPS[prevIdx].requiredTab);
                }}
              >
                <ArrowLeft size={14} /> Previous
              </button>
            )}

            {stepIndex < TUTORIAL_STEPS.length - 1 ? (
              <button
                className="btn btn-sm btn-primary"
                style={{
                  background: '#0284C7',
                  borderColor: '#38BDF8',
                  color: '#FFFFFF',
                }}
                onClick={() => {
                  const nextIdx = stepIndex + 1;
                  onChangeStep(nextIdx, TUTORIAL_STEPS[nextIdx].requiredTab);
                }}
              >
                Next Step <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="btn btn-sm btn-primary"
                style={{
                  background: '#059669',
                  borderColor: '#10B981',
                  color: '#FFFFFF',
                }}
                onClick={onClose}
              >
                <CheckCircle2 size={14} /> Start Using LearnHarness
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
