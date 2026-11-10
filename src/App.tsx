import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AITutorPanel } from './components/AITutorPanel';
import { CelebrationBurst } from './components/CelebrationBurst';
import { detectBridge } from './engine/aiClient';
import {
  Gauge,
  Zap,
  Network,
  AlertTriangle,
  Sun,
  Moon,
  Timer,
  Pause,
  Play,
  RotateCcw,
  Compass,
  Bot,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import type {
  CoursePack,
  NodeMasteryState,
  MistakeRecord,
  AIProviderStatus,
  MasteryTier,
  FailureCategory,
} from './types/harness';
import { DEFAULT_COURSES } from './data/defaultCourses';
import {
  computeCourseReadiness,
  createInitialNodeState,
  recordNodeAttempt,
  type QuizletRoundItem,
} from './engine/learningEngine';
import { ReadinessCommandCenter } from './components/ReadinessCommandCenter';
import { QuizletLearnSprint } from './components/QuizletLearnSprint';
import { SocraticGraphView } from './components/SocraticGraphView';
import { MistakeNotebookAndCram } from './components/MistakeNotebookAndCram';
import { CourseCompilerAndAuthModal } from './components/CourseCompilerAndAuthModal';
import {
  SpotlightTutorialOverlay,
  type TutorialStep,
} from './components/SpotlightTutorialOverlay';

type ActiveTab =
  | 'command_center'
  | 'quizlet_sprint'
  | 'socratic_graph'
  | 'mistakes_and_cram'
  | 'compiler_and_auth';

// Clean v4 storage keys ensure zero pre-filled legacy data on GitHub Pages
const STORAGE_KEYS = {
  COURSES: 'learnharness_pro_clean_v4_courses',
  MASTERY: 'learnharness_pro_clean_v4_mastery',
  MISTAKES: 'learnharness_pro_clean_v4_mistakes',
  THEME: 'learnharness_pro_clean_v4_theme',
  TOUR_SEEN: 'learnharness_pro_clean_v4_tour_seen',
};

export function App() {
  // Starts with an empty course list (0 pre-filled data!) unless the user already imported their own class in v4
  const [courses, setCourses] = useState<CoursePack[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.location.search.includes('reset')) {
        localStorage.removeItem(STORAGE_KEYS.COURSES);
        localStorage.removeItem(STORAGE_KEYS.MASTERY);
        localStorage.removeItem(STORAGE_KEYS.MISTAKES);
        localStorage.removeItem(STORAGE_KEYS.TOUR_SEEN);
        return [];
      }
      const saved = localStorage.getItem(STORAGE_KEYS.COURSES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Purge legacy mock courses so returning visitors get clean slate
          const filtered = parsed.filter(
            (c) =>
              c.id !== 'cs-transformers-harness' &&
              c.id !== 'bio-premed-energetics' &&
              c.id !== 'econ-game-probability'
          );
          return filtered;
        }
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses[0]?.id || ''
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [sprintFocusNodeId, setSprintFocusNodeId] = useState<string | null>(null);
  const [socraticNodeId, setSocraticNodeId] = useState<string | null>(null);
  const [socraticSubMode, setSocraticSubMode] = useState<
    'graph_and_teach' | 'diagnostic_probe'
  >('graph_and_teach');

  // If no course is loaded yet, open directly on the Agent Class Harvester & OpenAI Auth Setup tab
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    courses.length > 0 ? 'command_center' : 'compiler_and_auth'
  );
  const [mistakeSubTab, setMistakeSubTab] = useState<'mistakes' | 'cram_sheet'>(
    'mistakes'
  );
  const [simulatedHoursOffset, setSimulatedHoursOffset] = useState<number>(0);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [studyContext, setStudyContext] = useState<string>('');
  const [burstKey, setBurstKey] = useState<number | null>(null);
  const [burstLabel, setBurstLabel] = useState<string>('');
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({});

  // Clean 0% Mastery Map (zero pre-filled answers!)
  const [masteryMap, setMasteryMap] = useState<Record<string, NodeMasteryState>>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.MASTERY);
        if (saved) return JSON.parse(saved);
      } catch {
        // Fallback
      }
      return {};
    }
  );

  // Clean 0-Mistake Log (zero pre-filled mistakes!)
  const [mistakes, setMistakes] = useState<MistakeRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MISTAKES);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return [];
  });

  // Spotlight Tutorial Overlay State (automatically opens on first visit or clean slate!)
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        if (window.location.search.includes('tour') || window.location.search.includes('reset')) {
          return true;
        }
      }
      return localStorage.getItem(STORAGE_KEYS.TOUR_SEEN) !== 'true';
    } catch {
      return true;
    }
  });
  const [tutorialStepIndex, setTutorialStepIndex] = useState<number>(0);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Fallback
    }
    return 'dark';
  });

  // Focus & 2-Minute NSDR Consolidation Timer state
  const [timerMode, setTimerMode] = useState<'focus_25m' | 'nsdr_2m'>('focus_25m');
  const [timerSeconds, setTimerSeconds] = useState<number>(25 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // AI Provider Bridge status
  const [aiStatus, setAiStatus] = useState<AIProviderStatus>({
    activeProvider: 'chatgpt-oauth',
    codexCliAvailable: false,
    claudeCliAvailable: false,
    chatgptOAuthConnected: false,
    openaiKeyConfigured: false,
    anthropicKeyConfigured: false,
    tokenStats: {
      localZeroTokenActions: 0,
      aiAssistedActions: 0,
      estimatedTokensSaved: 0,
      estimatedApiCostUsd: 0,
    },
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {
      // Ignore in sandboxed iframe
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    } catch {
      // Ignore in sandboxed iframe
    }
  }, [courses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MASTERY, JSON.stringify(masteryMap));
    } catch {
      // Ignore in sandboxed iframe
    }
  }, [masteryMap]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(mistakes));
    } catch {
      // Ignore in sandboxed iframe
    }
  }, [mistakes]);

  const fetchAIStatus = async () => {
    try {
      const res = await fetch('/api/ai/status');
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      }
    } catch {
      // Offline / static GitHub Pages fallback
    }
  };

  useEffect(() => {
    detectBridge();
    fetchAIStatus();
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          if (timerMode === 'focus_25m') {
            setTimerMode('nsdr_2m');
            return 2 * 60;
          } else {
            setTimerMode('focus_25m');
            return 25 * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, timerMode]);

  const currentCourse: CoursePack | null = useMemo(() => {
    if (courses.length === 0) return null;
    return courses.find((c) => c.id === selectedCourseId) || courses[0];
  }, [courses, selectedCourseId]);

  const isCorruptedCourse = useMemo(() => {
    if (!currentCourse || !currentCourse.nodes || currentCourse.nodes.length === 0) return false;
    const firstTitle = (currentCourse.nodes[0]?.title || '').replace(/["'{}[\]]/g, '').trim().toLowerCase();
    if (firstTitle === 'code' || firstTitle === 'id') return true;
    const schemaMatches = currentCourse.nodes.filter((n) => {
      const clean = (n.title || '').replace(/["'{}[\]]/g, '').trim().toLowerCase();
      return /^(id|code|title|subtitle|statement|primingsummary|motivatedhook|keyformulaorrule|examweight|units|nodes)$/i.test(clean);
    }).length;
    return schemaMatches >= 3;
  }, [currentCourse]);

  const simulatedNow = useMemo(() => {
    return Date.now() + simulatedHoursOffset * 3600 * 1000;
  }, [simulatedHoursOffset, masteryMap]);

  const readinessReport = useMemo(() => {
    if (!currentCourse) return null;
    return computeCourseReadiness(
      currentCourse,
      masteryMap,
      mistakes,
      simulatedNow
    );
  }, [currentCourse, masteryMap, mistakes, simulatedNow]);

  const openMistakesCount = useMemo(() => {
    if (!currentCourse) return 0;
    return mistakes.filter(
      (m) => m.courseId === currentCourse.id && !m.retestedAndCleared
    ).length;
  }, [mistakes, currentCourse]);

  // Record attempt from QuizletLearnSprint
  const handleRecordSprintAttempt = (params: {
    nodeId: string;
    unitId: string;
    nodeTitle: string;
    correct: boolean;
    confidence: number;
    hintRungUsed: number;
    itemType: QuizletRoundItem['itemType'];
    thinkingText: string;
    learnerAnswer: string;
    questionText: string;
    correctTargetText: string;
    failureCategory?: FailureCategory;
    surgicalRepair?: string;
  }) => {
    const prevState = masteryMap[params.nodeId];
    const result = recordNodeAttempt(prevState, params.nodeId, {
      correct: params.correct,
      confidence: params.confidence,
      hintRungUsed: params.hintRungUsed,
      itemType: params.itemType,
      thinkingText: params.thinkingText,
    });

    setMasteryMap((prev) => ({
      ...prev,
      [params.nodeId]: result.nextState,
    }));

    if (currentCourse && (!params.correct || params.hintRungUsed >= 3)) {
      const stageMap: Record<
        QuizletRoundItem['itemType'],
        MistakeRecord['stage']
      > = {
        priming_predict: 'predict',
        recognition_mcq: 'recognition',
        discrimination: 'discrimination',
        cued_recall: 'cued_recall',
        exam_application: 'application',
      };
      const newMistake: MistakeRecord = {
        id: `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        courseId: currentCourse.id,
        unitId: params.unitId,
        nodeId: params.nodeId,
        nodeTitle: params.nodeTitle,
        timestamp: Date.now(),
        stage: stageMap[params.itemType],
        failureCategory: params.failureCategory || 'cue_miss',
        question: params.questionText,
        learnerAnswer: params.learnerAnswer || '(Requested R3+ Hint)',
        learnerThinking: params.thinkingText || '',
        confidence: params.confidence,
        correctTarget: params.correctTargetText,
        surgicalRepair:
          params.surgicalRepair || params.correctTargetText,
        retestedAndCleared: false,
      };
      setMistakes((prev) => [newMistake, ...prev]);
    } else if (params.correct && params.hintRungUsed <= 1) {
      setMistakes((prev) =>
        prev.map((m) =>
          m.nodeId === params.nodeId ? { ...m, retestedAndCleared: true } : m
        )
      );
    }

    if (result.tierPromoted) {
      const tierNames = ['Unseen', 'Familiar', 'Learned', 'Mastered'];
      setBurstKey(Date.now());
      setBurstLabel(`${params.nodeTitle} · Promoted to ${tierNames[result.newTier]}!`);
      setTimeout(() => setBurstKey(null), 2800);
    }

    return {
      tierPromoted: result.tierPromoted,
      previousTier: result.previousTier,
      newTier: result.newTier,
    };
  };

  const handleFastTrackNode = (nodeId: string, targetTier: MasteryTier) => {
    const prev = masteryMap[nodeId] || createInitialNodeState(nodeId);
    setMasteryMap((map) => ({
      ...map,
      [nodeId]: {
        ...prev,
        tier: Math.max(prev.tier, targetTier) as MasteryTier,
        lastReviewedAt: Date.now(),
        stabilityHours: targetTier >= 2 ? 42 : 20,
        probeBracket: targetTier >= 2 ? 'floor_held' : prev.probeBracket,
      },
    }));
  };

  const handleLoadOptionalSampleCourse = () => {
    const sample = DEFAULT_COURSES[0];
    setCourses((prev) => [
      sample,
      ...prev.filter((c) => c.id !== sample.id),
    ]);
    setMasteryMap((prev) => {
      const next = { ...prev };
      sample.nodes.forEach((n) => {
        next[n.id] = createInitialNodeState(n.id); // 0% clean progress!
      });
      return next;
    });
    setSelectedCourseId(sample.id);
    setSelectedUnitId(null);
    setActiveTab('command_center');
  };

  const handleDeleteCourse = (courseId: string, skipPrompt = false) => {
    const target = courses.find((c) => c.id === courseId);
    const name = target?.title || target?.code || 'this study set';
    const isTargetCorrupted = target && (
      (target.nodes[0]?.title || '').replace(/["'{}[\]]/g, '').trim().toLowerCase() === 'code' ||
      target.nodes.filter(n => /^(id|code|title|subtitle|statement)$/i.test(n.title.replace(/["'{}[\]]/g, '').trim())).length >= 3
    );

    if (!skipPrompt && !isTargetCorrupted) {
      if (
        !window.confirm(
          `Are you sure you want to delete the study set "${name}"?\n\nThis will remove all its units, concepts, and progress.`
        )
      ) {
        return;
      }
    }
    const nextCourses = courses.filter((c) => c.id !== courseId);
    setCourses(nextCourses);
    if (target) {
      const nodeIds = new Set(target.nodes.map((n) => n.id));
      setMasteryMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          if (nodeIds.has(id)) delete next[id];
        });
        return next;
      });
      setMistakes((prev) => prev.filter((m) => m.courseId !== courseId));
    }
    const nextSelected = nextCourses[0]?.id || '';
    setSelectedCourseId(nextSelected);
    setSelectedUnitId(null);
    setSprintFocusNodeId(null);
    setFocusedNodeId(nextCourses[0]?.nodes[0]?.id || null);
    if (nextCourses.length === 0) {
      setActiveTab('compiler_and_auth');
    }
  };

  const handleClearAllData = () => {
    setCourses([]);
    setMasteryMap({});
    setMistakes([]);
    setSelectedCourseId('');
    setSelectedUnitId(null);
    setActiveTab('compiler_and_auth');
    try {
      localStorage.removeItem(STORAGE_KEYS.COURSES);
      localStorage.removeItem(STORAGE_KEYS.MASTERY);
      localStorage.removeItem(STORAGE_KEYS.MISTAKES);
    } catch {
      // Ignore
    }
  };

  const handleTutorialStepChange = (
    newIdx: number,
    reqTab: TutorialStep['requiredTab']
  ) => {
    setTutorialStepIndex(newIdx);
    if (reqTab === 'agent_setup') {
      setActiveTab('compiler_and_auth');
    } else {
      setActiveTab(reqTab);
    }
  };

  const handleCloseTutorial = () => {
    setIsTutorialOpen(false);
    try {
      localStorage.setItem(STORAGE_KEYS.TOUR_SEEN, 'true');
    } catch {
      // Ignore
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="app-shell">
      {/* Interactive Dimmed-Screen Spotlight Tutorial Overlay with Bright Circles & Curved Arrows */}
      <SpotlightTutorialOverlay
        isOpen={isTutorialOpen}
        stepIndex={tutorialStepIndex}
        onChangeStep={handleTutorialStepChange}
        onClose={handleCloseTutorial}
      />

      {/* Top Academic Studio Bar */}
      <header className="top-nav">
        <div className="top-nav-inner">
          {/* Brand + Course Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
            <div
              onClick={() =>
                setActiveTab(
                  currentCourse ? 'command_center' : 'compiler_and_auth'
                )
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                }}
              >
                LH
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    lineHeight: 1.1,
                  }}
                >
                  LearnHarness{' '}
                  <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
                </div>
                <div
                  className="mono"
                  style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}
                >
                  Quizlet Learn × Socratic Graph
                </div>
              </div>
            </div>

            {courses.length > 0 && currentCourse && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select
                  className="input"
                  style={{
                    width: 'auto',
                    maxWidth: '260px',
                    padding: '6px 10px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}
                  value={currentCourse.id}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    setSelectedUnitId(null);
                    setSprintFocusNodeId(null);
                  }}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                {isCorruptedCourse && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--danger)',
                      background: 'var(--danger-subtle)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Corrupted Set
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    padding: '6px 8px',
                    color: isCorruptedCourse ? '#fff' : 'var(--danger)',
                    background: isCorruptedCourse ? 'var(--danger)' : undefined,
                  }}
                  onClick={() => handleDeleteCourse(currentCourse.id)}
                  title={`Delete study set "${currentCourse.title}"`}
                  aria-label="Delete this study set"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Primary Mode Navigation */}
          <nav className="nav-tabs">
            <button
              className={`nav-tab ${
                activeTab === 'compiler_and_auth' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('compiler_and_auth')}
            >
              <Bot size={15} />
              Setup
            </button>

            <button
              data-tour-id="tour-nav-readiness"
              className={`nav-tab ${
                activeTab === 'command_center' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('command_center')}
            >
              <Gauge size={15} />
              Readiness (
              {readinessReport
                ? `${readinessReport.overallScore}% · ${readinessReport.letterGradePrediction}`
                : '0%'}
              )
            </button>

            <div
              data-tour-id="tour-nav-modes"
              style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}
            >
              <button
                className={`nav-tab ${
                  activeTab === 'quizlet_sprint' ? 'active' : ''
                }`}
                onClick={() => setActiveTab('quizlet_sprint')}
              >
                <Zap size={15} />
                Learn
              </button>
              <button
                className={`nav-tab ${
                  activeTab === 'socratic_graph' ? 'active' : ''
                }`}
                onClick={() => setActiveTab('socratic_graph')}
              >
                <Network size={15} />
                Graph
              </button>
              <button
                className={`nav-tab ${
                  activeTab === 'mistakes_and_cram' ? 'active' : ''
                }`}
                onClick={() => {
                  setMistakeSubTab('mistakes');
                  setActiveTab('mistakes_and_cram');
                }}
              >
                <AlertTriangle size={15} />
                Mistakes
                {openMistakesCount > 0 && (
                  <span
                    className="mono"
                    style={{
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'var(--danger-subtle)',
                      color: 'var(--danger)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {openMistakesCount}
                  </span>
                )}
              </button>
            </div>
          </nav>

          {/* Right Controls: Interactive Spotlight Tutorial Button + Focus / NSDR Timer + Theme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                setTutorialStepIndex(0);
                setActiveTab('compiler_and_auth');
                setIsTutorialOpen(true);
              }}
              title="Open Interactive Tour"
            >
              <Compass size={14} /> Tour
            </button>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
              }}
              title="25m Focus / 2m NSDR Rest Timer"
            >
              <Timer
                size={14}
                style={{
                  color:
                    timerMode === 'nsdr_2m'
                      ? 'var(--success)'
                      : 'var(--accent-primary)',
                }}
              />
              <button
                onClick={() => {
                  const nextMode =
                    timerMode === 'focus_25m' ? 'nsdr_2m' : 'focus_25m';
                  setTimerMode(nextMode);
                  setTimerSeconds(nextMode === 'focus_25m' ? 25 * 60 : 2 * 60);
                  setTimerRunning(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                {timerMode === 'focus_25m' ? 'Focus' : 'NSDR'}
              </button>
              <span className="mono" style={{ fontWeight: 700 }}>
                {formatTimer(timerSeconds)}
              </span>
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: '2px',
                }}
                aria-label="Toggle Timer"
              >
                {timerRunning ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(timerMode === 'focus_25m' ? 25 * 60 : 2 * 60);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: '2px',
                }}
                aria-label="Reset Timer"
              >
                <RotateCcw size={12} />
              </button>
            </div>

            <button
              className="btn btn-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle Light/Dark Theme"
              style={{ padding: '6px 9px' }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              className={`btn btn-sm ${rightPanelOpen ? 'btn-primary' : ''}`}
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              title={rightPanelOpen ? 'Collapse AI Tutor Panel' : 'Expand AI Tutor Panel'}
              style={{ padding: '6px 9px' }}
            >
              {rightPanelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          </div>
        </div>
      </header>

      {/* Celebration burst for tier promotions */}
      <CelebrationBurst burstKey={burstKey} label={burstLabel} />

      {/* Obsidian 3-Column Workspace */}
      <div className={`workspace ${rightPanelOpen ? '' : 'right-collapsed'}`}>
        {/* Left Obsidian File Tree Sidebar */}
        <aside className="ws-sidebar">
          {currentCourse ? (
            <>
              <div className="tree-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{currentCourse.code} · {currentCourse.units.length} Units</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ padding: '2px 5px', fontSize: '0.65rem', color: 'var(--danger)', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  onClick={() => handleDeleteCourse(currentCourse.id)}
                  title={`Delete study set "${currentCourse.title}"`}
                >
                  <Trash2 size={10} /> Delete Set
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {currentCourse.units.map((u) => {
                  const isOpen = openUnits[u.id] !== false; // open by default
                  const uNodes = currentCourse.nodes.filter((n) => n.unitId === u.id);
                  return (
                    <div key={u.id} style={{ marginBottom: 4 }}>
                      <button
                        type="button"
                        className="tree-item"
                        style={{ fontWeight: 600, color: 'var(--text-primary)' }}
                        onClick={() => setOpenUnits((prev) => ({ ...prev, [u.id]: !isOpen }))}
                      >
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Unit {u.number}: {u.title}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="tree-children">
                          {uNodes.map((n) => {
                            const tier = masteryMap[n.id]?.tier || 0;
                            const isSelected = (focusedNodeId || socraticNodeId || currentCourse.nodes[0]?.id) === n.id;
                            const tierColors = ['var(--tier-0)', 'var(--tier-1)', 'var(--tier-2)', 'var(--tier-3)'];
                            return (
                              <button
                                key={n.id}
                                type="button"
                                className={`tree-item ${isSelected ? 'active' : ''}`}
                                onClick={() => {
                                  setFocusedNodeId(n.id);
                                  setSocraticNodeId(n.id);
                                  if (activeTab === 'compiler_and_auth') setActiveTab('command_center');
                                }}
                                title={`${n.title} (Tier ${tier}/3)`}
                              >
                                <span className="tier-dot" style={{ background: tierColors[tier] }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {n.title}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="tree-heading" style={{ marginTop: 16 }}>Workspace Panes</div>
              <button
                type="button"
                className={`tree-item ${activeTab === 'command_center' ? 'active' : ''}`}
                onClick={() => setActiveTab('command_center')}
              >
                <Gauge size={13} /> Readiness Dashboard
              </button>
              <button
                type="button"
                className={`tree-item ${activeTab === 'quizlet_sprint' ? 'active' : ''}`}
                onClick={() => setActiveTab('quizlet_sprint')}
              >
                <Zap size={13} /> Quizlet Learn Sprint
              </button>
              <button
                type="button"
                className={`tree-item ${activeTab === 'socratic_graph' ? 'active' : ''}`}
                onClick={() => setActiveTab('socratic_graph')}
              >
                <Network size={13} /> Socratic Knowledge Graph
              </button>
              <button
                type="button"
                className={`tree-item ${activeTab === 'mistakes_and_cram' ? 'active' : ''}`}
                onClick={() => { setMistakeSubTab('mistakes'); setActiveTab('mistakes_and_cram'); }}
              >
                <AlertTriangle size={13} /> Mistake Notebook ({openMistakesCount})
              </button>
              <button
                type="button"
                className={`tree-item ${activeTab === 'compiler_and_auth' ? 'active' : ''}`}
                onClick={() => setActiveTab('compiler_and_auth')}
              >
                <Bot size={13} /> Class Harvester & Setup
              </button>
            </>
          ) : (
            <div style={{ padding: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No course loaded yet. Open Setup to harvest notes or load a sample set.
            </div>
          )}
        </aside>

        {/* Center Main Stage (Animated page transitions) */}
        <main className="ws-center">
          {/* Corrupted Course Detection Banner */}
          {isCorruptedCourse && currentCourse && (
            <div
              style={{
                margin: '14px 16px 0 16px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.88rem' }}>
                    Corrupted Study Set Detected ({currentCourse.nodes.length} cards with raw JSON keys like &quot;code&quot; and &quot;id&quot;)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    This set was created from unparsed JSON keys. The compiler and handoff parser have been upgraded to cleanly extract structured concepts.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: 'var(--danger)',
                    color: '#fff',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                  }}
                  onClick={() => handleDeleteCourse(currentCourse.id, true)}
                >
                  <Trash2 size={13} /> Delete Corrupted Set
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setActiveTab('compiler_and_auth')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={13} /> Open Setup to Repaste
                </button>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            >
              {activeTab === 'compiler_and_auth' ? (
                <CourseCompilerAndAuthModal
                  course={currentCourse}
                  allCourses={courses}
                  aiStatus={aiStatus}
                  onRefreshAIStatus={fetchAIStatus}
                  onDeleteCourse={handleDeleteCourse}
                  onAddCompiledCourse={(newCourse) => {
                    setCourses((prev) => [newCourse, ...prev]);
                    setMasteryMap((prev) => {
                      const next = { ...prev };
                      newCourse.nodes.forEach((n) => {
                        next[n.id] = createInitialNodeState(n.id);
                      });
                      return next;
                    });
                    setSelectedCourseId(newCourse.id);
                    setSelectedUnitId(null);
                    setFocusedNodeId(newCourse.nodes[0]?.id || null);
                    setActiveTab('command_center');
                  }}
                  onImportCourseJson={(imported) => {
                    setCourses((prev) => [
                      imported,
                      ...prev.filter((c) => c.id !== imported.id),
                    ]);
                    setMasteryMap((prev) => {
                      const next = { ...prev };
                      imported.nodes.forEach((n) => {
                        next[n.id] = createInitialNodeState(n.id);
                      });
                      return next;
                    });
                    setSelectedCourseId(imported.id);
                    setSelectedUnitId(null);
                    setFocusedNodeId(imported.nodes[0]?.id || null);
                    setActiveTab('command_center');
                  }}
                  onLoadOptionalSampleCourse={handleLoadOptionalSampleCourse}
                  onClearAllCoursesAndReset={handleClearAllData}
                  onOpenSpotlightTutorial={() => {
                    setTutorialStepIndex(0);
                    setIsTutorialOpen(true);
                  }}
                />
              ) : !currentCourse || !readinessReport ? (
                <div
                  className="card"
                  style={{
                    padding: '36px 24px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <Bot size={36} style={{ color: 'var(--accent-primary)' }} />
                  <h2 className="serif-heading" style={{ fontSize: '1.4rem' }}>
                    No Study Set Loaded Yet
                  </h2>
                  <p style={{ maxWidth: '420px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                    Import your class materials in Setup or try a sample set to start.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => setActiveTab('compiler_and_auth')}
                    >
                      Go to Setup
                    </button>
                    <button className="btn" onClick={handleLoadOptionalSampleCourse}>
                      <Sparkles size={14} /> Try Sample Set (0%)
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === 'command_center' && (
                    <ReadinessCommandCenter
                      course={currentCourse}
                      report={readinessReport}
                      masteryMap={masteryMap}
                      onStartQuizletSprint={(unitId, focusNodeId) => {
                        if (unitId && unitId !== 'all') {
                          setSelectedUnitId(unitId);
                        } else {
                          setSelectedUnitId(null);
                        }
                        setSprintFocusNodeId(focusNodeId || null);
                        setFocusedNodeId(focusNodeId || null);
                        setActiveTab('quizlet_sprint');
                      }}
                      onOpenSocraticNode={(nodeId, startProbe) => {
                        setSocraticNodeId(nodeId);
                        setFocusedNodeId(nodeId);
                        setSocraticSubMode(
                          startProbe ? 'diagnostic_probe' : 'graph_and_teach'
                        );
                        setActiveTab('socratic_graph');
                      }}
                      onOpenMistakeDrill={() => {
                        setMistakeSubTab('mistakes');
                        setActiveTab('mistakes_and_cram');
                      }}
                      onOpenCramSheet={() => {
                        setMistakeSubTab('cram_sheet');
                        setActiveTab('mistakes_and_cram');
                      }}
                      onFastForwardDecayDemo={() => {
                        setSimulatedHoursOffset((prev) => (prev === 0 ? 48 : 0));
                      }}
                    />
                  )}

                  {activeTab === 'quizlet_sprint' && (
                    <QuizletLearnSprint
                      course={currentCourse}
                      report={readinessReport}
                      masteryMap={masteryMap}
                      mistakes={mistakes}
                      initialUnitFilter={selectedUnitId || 'all'}
                      focusNodeId={sprintFocusNodeId}
                      onRecordAttempt={handleRecordSprintAttempt}
                      onBackToDashboard={() => setActiveTab('command_center')}
                      onStudyContext={(nodeId, ctx) => {
                        setFocusedNodeId(nodeId);
                        setStudyContext(ctx);
                      }}
                      onConnectAI={() => setActiveTab('compiler_and_auth')}
                      onLocalZeroTokenTick={() => {
                        setAiStatus((prev) => ({
                          ...prev,
                          tokenStats: {
                            ...prev.tokenStats,
                            localZeroTokenActions:
                              prev.tokenStats.localZeroTokenActions + 1,
                            estimatedTokensSaved:
                              prev.tokenStats.estimatedTokensSaved + 850,
                          },
                        }));
                      }}
                    />
                  )}

                  {activeTab === 'socratic_graph' && (
                    <SocraticGraphView
                      course={currentCourse}
                      masteryMap={masteryMap}
                      selectedUnitId={selectedUnitId}
                      initialNodeId={socraticNodeId || focusedNodeId}
                      initialSubMode={socraticSubMode}
                      onSelectUnit={(u) => setSelectedUnitId(u)}
                      onFastTrackNode={handleFastTrackNode}
                      onFocusNode={(nodeId) => setFocusedNodeId(nodeId)}
                      onConnectAI={() => setActiveTab('compiler_and_auth')}
                      onPracticeSingleNode={(nodeId) => {
                        setSprintFocusNodeId(nodeId);
                        setFocusedNodeId(nodeId);
                        setActiveTab('quizlet_sprint');
                      }}
                    />
                  )}

                  {activeTab === 'mistakes_and_cram' && (
                    <MistakeNotebookAndCram
                      course={currentCourse}
                      mistakes={mistakes}
                      readiness={readinessReport}
                      initialTab={mistakeSubTab}
                      onStartMistakeDrill={() => {
                        setSprintFocusNodeId(null);
                        setActiveTab('quizlet_sprint');
                      }}
                      onConnectAI={() => setActiveTab('compiler_and_auth')}
                      onResolveMistake={(mistakeId) =>
                        setMistakes((prev) =>
                          prev.map((m) =>
                            m.id === mistakeId ? { ...m, retestedAndCleared: true } : m
                          )
                        )
                      }
                      onAddManualMistake={(
                        nodeId,
                        questionPrompt,
                        learnerAnswer,
                        failureType
                      ) => {
                        const node = currentCourse.nodes.find((n) => n.id === nodeId);
                        if (!node) return;
                        const newMistake: MistakeRecord = {
                          id: `manual-${Date.now()}`,
                          courseId: currentCourse.id,
                          unitId: node.unitId,
                          nodeId: node.id,
                          nodeTitle: node.title,
                          timestamp: Date.now(),
                          stage: 'application',
                          failureCategory: failureType,
                          question: questionPrompt,
                          learnerAnswer,
                          learnerThinking: '',
                          confidence: 75,
                          correctTarget: node.statement,
                          surgicalRepair: node.statement,
                          retestedAndCleared: false,
                        };
                        setMistakes((prev) => [newMistake, ...prev]);
                      }}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Right Obsidian Panel: Persistent Multi-Turn AI Socratic Tutor */}
        <aside className="ws-right">
          <AITutorPanel
            node={
              currentCourse
                ? currentCourse.nodes.find((n) => n.id === (focusedNodeId || socraticNodeId)) || currentCourse.nodes[0]
                : null
            }
            studyContext={studyContext}
            onConnect={() => setActiveTab('compiler_and_auth')}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
