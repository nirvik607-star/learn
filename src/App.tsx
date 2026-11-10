import { useState, useEffect, useMemo } from 'react';
import {
  Gauge,
  Zap,
  Network,
  AlertTriangle,
  Cpu,
  Sun,
  Moon,
  Timer,
  Pause,
  Play,
  RotateCcw,
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

type ActiveTab =
  | 'command_center'
  | 'quizlet_sprint'
  | 'socratic_graph'
  | 'mistakes_and_cram'
  | 'compiler_and_auth';

const STORAGE_KEYS = {
  COURSES: 'learnharness_pro_courses_v2',
  MASTERY: 'learnharness_pro_mastery_v2',
  MISTAKES: 'learnharness_pro_mistakes_v2',
  THEME: 'learnharness_pro_theme_v2',
};

function buildInitialSeedMastery(
  courses: CoursePack[]
): Record<string, NodeMasteryState> {
  const map: Record<string, NodeMasteryState> = {};
  const now = Date.now();
  courses.forEach((course, cIdx) => {
    course.nodes.forEach((node, nIdx) => {
      const base = createInitialNodeState(node.id);
      if (cIdx === 0) {
        if (nIdx === 0) {
          map[node.id] = {
            ...base,
            tier: 3,
            stabilityHours: 64,
            lastReviewedAt: now - 3 * 3600 * 1000,
            attempts: 4,
            correctStreak: 4,
            unaidedSuccesses: 3,
            confidenceHistory: [
              { confidence: 85, correct: true, timestamp: now - 5 * 3600 * 1000 },
              { confidence: 92, correct: true, timestamp: now - 3 * 3600 * 1000 },
            ],
            probeBracket: 'floor_held',
          };
          return;
        }
        if (nIdx === 1 || nIdx === 4) {
          map[node.id] = {
            ...base,
            tier: 2,
            stabilityHours: 32,
            lastReviewedAt: now - 6 * 3600 * 1000,
            attempts: 3,
            correctStreak: 2,
            unaidedSuccesses: 2,
            confidenceHistory: [
              { confidence: 80, correct: true, timestamp: now - 6 * 3600 * 1000 },
            ],
            probeBracket: 'floor_held',
          };
          return;
        }
        if (nIdx === 2 || nIdx === 5) {
          map[node.id] = {
            ...base,
            tier: 1,
            stabilityHours: 18,
            lastReviewedAt: now - 12 * 3600 * 1000,
            attempts: 2,
            correctStreak: 1,
            unaidedSuccesses: 1,
            confidenceHistory: [
              { confidence: 75, correct: true, timestamp: now - 12 * 3600 * 1000 },
            ],
            probeBracket: 'edge_target',
          };
          return;
        }
      }
      map[node.id] = base;
    });
  });
  return map;
}

function buildInitialSeedMistakes(courses: CoursePack[]): MistakeRecord[] {
  const firstCourse = courses[0];
  if (!firstCourse || firstCourse.nodes.length < 3) return [];
  const targetNode = firstCourse.nodes[2];
  return [
    {
      id: 'seed-mistake-1',
      courseId: firstCourse.id,
      unitId: targetNode.unitId,
      nodeId: targetNode.id,
      nodeTitle: targetNode.title,
      timestamp: Date.now() - 4 * 3600 * 1000,
      stage: 'discrimination',
      failureCategory: 'discrimination_error',
      question:
        'Why must future token logits be masked to -infinity BEFORE softmax rather than zeroing probabilities AFTER softmax?',
      learnerAnswer:
        'Zeroing after softmax is equivalent as long as we re-normalize later.',
      learnerThinking: 'Thought softmax denominator was unaffected.',
      confidence: 85,
      correctTarget: targetNode.statement,
      surgicalRepair:
        'Masking to -infinity BEFORE softmax ensures exp(-infinity) = 0 so future tokens never leak into the softmax normalization denominator.',
      retestedAndCleared: false,
    },
  ];
}

export function App() {
  const [courses, setCourses] = useState<CoursePack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COURSES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_COURSES;
  });

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses[0]?.id || DEFAULT_COURSES[0].id
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [sprintFocusNodeId, setSprintFocusNodeId] = useState<string | null>(null);
  const [socraticNodeId, setSocraticNodeId] = useState<string | null>(null);
  const [socraticSubMode, setSocraticSubMode] = useState<
    'graph_and_teach' | 'diagnostic_probe'
  >('graph_and_teach');

  const [activeTab, setActiveTab] = useState<ActiveTab>('command_center');
  const [mistakeSubTab, setMistakeSubTab] = useState<'mistakes' | 'cram_sheet'>(
    'mistakes'
  );
  const [simulatedHoursOffset, setSimulatedHoursOffset] = useState<number>(0);

  const [masteryMap, setMasteryMap] = useState<Record<string, NodeMasteryState>>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.MASTERY);
        if (saved) return JSON.parse(saved);
      } catch {
        // Fallback
      }
      return buildInitialSeedMastery(DEFAULT_COURSES);
    }
  );

  const [mistakes, setMistakes] = useState<MistakeRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MISTAKES);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return buildInitialSeedMistakes(DEFAULT_COURSES);
  });

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
    activeProvider: 'zero-token-local',
    codexCliAvailable: false,
    claudeCliAvailable: false,
    chatgptOAuthConnected: false,
    openaiKeyConfigured: false,
    anthropicKeyConfigured: false,
    tokenStats: {
      localZeroTokenActions: 14,
      aiAssistedActions: 0,
      estimatedTokensSaved: 18400,
      estimatedApiCostUsd: 0,
    },
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MASTERY, JSON.stringify(masteryMap));
  }, [masteryMap]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(mistakes));
  }, [mistakes]);

  const fetchAIStatus = async () => {
    try {
      const res = await fetch('/api/ai/status');
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      }
    } catch {
      // Offline / static fallback
    }
  };

  useEffect(() => {
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

  const currentCourse = useMemo(() => {
    return (
      courses.find((c) => c.id === selectedCourseId) ||
      courses[0] ||
      DEFAULT_COURSES[0]
    );
  }, [courses, selectedCourseId]);

  const simulatedNow = useMemo(() => {
    return Date.now() + simulatedHoursOffset * 3600 * 1000;
  }, [simulatedHoursOffset, masteryMap]);

  const readinessReport = useMemo(() => {
    return computeCourseReadiness(
      currentCourse,
      masteryMap,
      mistakes,
      simulatedNow
    );
  }, [currentCourse, masteryMap, mistakes, simulatedNow]);

  const openMistakesCount = useMemo(() => {
    return mistakes.filter(
      (m) => m.courseId === currentCourse.id && !m.retestedAndCleared
    ).length;
  }, [mistakes, currentCourse.id]);

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

    if (!params.correct || params.hintRungUsed >= 3) {
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
      // Clear any unresolved mistake for this node when solved unaided!
      setMistakes((prev) =>
        prev.map((m) =>
          m.nodeId === params.nodeId ? { ...m, retestedAndCleared: true } : m
        )
      );
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

  const handleResetCourseProgress = (courseId: string) => {
    const target = courses.find((c) => c.id === courseId);
    if (!target) return;
    setMasteryMap((prev) => {
      const next = { ...prev };
      target.nodes.forEach((n) => {
        next[n.id] = createInitialNodeState(n.id);
      });
      return next;
    });
    setMistakes((prev) => prev.filter((m) => m.courseId !== courseId));
    setSimulatedHoursOffset(0);
  };

  const handleFastTrackEntireCourseDemo = (courseId: string) => {
    const target = courses.find((c) => c.id === courseId);
    if (!target) return;
    const now = Date.now();
    setMasteryMap((prev) => {
      const next = { ...prev };
      target.nodes.forEach((n, idx) => {
        next[n.id] = {
          nodeId: n.id,
          tier: (idx % 6 === 0 ? 2 : 3) as MasteryTier,
          stabilityHours: 96,
          lastReviewedAt: now - 1 * 3600 * 1000,
          attempts: 4,
          correctStreak: 4,
          unaidedSuccesses: 3,
          hintedSuccesses: 1,
          maxHintRungUsed: 0,
          confidenceHistory: [
            { confidence: 90, correct: true, timestamp: now - 3600 * 1000 },
          ],
          probeBracket: 'floor_held',
          thinkingNotes: [],
        };
      });
      return next;
    });
    setMistakes((prev) =>
      prev.map((m) =>
        m.courseId === courseId ? { ...m, retestedAndCleared: true } : m
      )
    );
    setSimulatedHoursOffset(0);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="app-shell">
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
              onClick={() => setActiveTab('command_center')}
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

            <select
              className="input"
              style={{
                width: 'auto',
                maxWidth: '300px',
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
          </div>

          {/* Primary Mode Navigation */}
          <nav className="nav-tabs">
            <button
              className={`nav-tab ${
                activeTab === 'command_center' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('command_center')}
            >
              <Gauge size={15} />
              Readiness ({readinessReport.overallScore}% ·{' '}
              {readinessReport.letterGradePrediction})
            </button>
            <button
              className={`nav-tab ${
                activeTab === 'quizlet_sprint' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('quizlet_sprint')}
            >
              <Zap size={15} />
              Quizlet Learn Sprint
            </button>
            <button
              className={`nav-tab ${
                activeTab === 'socratic_graph' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('socratic_graph')}
            >
              <Network size={15} />
              Socratic Graph & Probe
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
              Mistakes & 80/20 Cram
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
            <button
              className={`nav-tab ${
                activeTab === 'compiler_and_auth' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('compiler_and_auth')}
            >
              <Cpu size={15} />
              Compile & Auth
            </button>
          </nav>

          {/* Right Controls: Focus / 2-Min NSDR Rest Timer + Theme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              title="Ultradian Focus Block + 2-Minute NSDR (Non-Sleep Deep Rest) Memory Consolidation Timer"
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
                {timerMode === 'focus_25m' ? 'Focus' : 'NSDR Rest'}
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
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="main-container">
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
              setActiveTab('quizlet_sprint');
            }}
            onOpenSocraticNode={(nodeId, startProbe) => {
              setSocraticNodeId(nodeId);
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
            initialNodeId={socraticNodeId}
            initialSubMode={socraticSubMode}
            onSelectUnit={(u) => setSelectedUnitId(u)}
            onFastTrackNode={handleFastTrackNode}
            onPracticeSingleNode={(nodeId) => {
              setSprintFocusNodeId(nodeId);
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

        {activeTab === 'compiler_and_auth' && (
          <CourseCompilerAndAuthModal
            course={currentCourse}
            allCourses={courses}
            aiStatus={aiStatus}
            onRefreshAIStatus={fetchAIStatus}
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
                  if (!next[n.id]) next[n.id] = createInitialNodeState(n.id);
                });
                return next;
              });
              setSelectedCourseId(imported.id);
              setSelectedUnitId(null);
              setActiveTab('command_center');
            }}
            onResetCourseProgress={handleResetCourseProgress}
            onFastTrackEntireCourseDemo={handleFastTrackEntireCourseDemo}
          />
        )}
      </main>
    </div>
  );
}

export default App;
