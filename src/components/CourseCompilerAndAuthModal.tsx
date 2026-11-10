import React, { useState } from 'react';
import {
  Sparkles,
  KeyRound,
  Download,
  Upload,
  ExternalLink,
  Copy,
  Zap,
  FolderOpen,
  Bot,
  ShieldCheck,
  Compass,
  Trash2,
} from 'lucide-react';
import type {
  CoursePack,
  AIProviderStatus,
  AIProviderId,
} from '../types/harness';
import { compileNotesToCoursePackLocally } from '../engine/courseCompiler';

interface CourseCompilerAndAuthModalProps {
  course: CoursePack | null;
  allCourses: CoursePack[];
  aiStatus: AIProviderStatus;
  onRefreshAIStatus: () => void;
  onAddCompiledCourse: (newCourse: CoursePack) => void;
  onImportCourseJson: (importedCourse: CoursePack) => void;
  onLoadOptionalSampleCourse: () => void;
  onClearAllCoursesAndReset: () => void;
  onOpenSpotlightTutorial: () => void;
}

function buildMasterAgentPrompt(params: {
  courseCode: string;
  courseTitle: string;
  examName: string;
  folderPath: string;
  agentTarget: 'codex_cli' | 'chatgpt_web' | 'claude_code';
}): string {
  const code = params.courseCode.trim() || 'COURSE 101';
  const title = params.courseTitle.trim() || 'My College Course';
  const exam = params.examName.trim() || 'Upcoming Exam';
  const folder = params.folderPath.trim() || './imports';

  const header =
    params.agentTarget === 'codex_cli'
      ? `You are running in OpenAI Codex. Scan all lecture slides, PDFs, syllabi, homework sets, and practice exams inside "${folder}" for "${code}: ${title}" (${exam}).`
      : params.agentTarget === 'claude_code'
      ? `You are running in Claude Code. Read all class materials, PDFs, notes, and practice exams inside "${folder}" for "${code}: ${title}" (${exam}).`
      : `Read all the class files, lecture slides, syllabus, and practice exam PDFs I uploaded in this chat for "${code}: ${title}" (${exam}).`;

  return `${header}

Your job is to deconstruct my class materials into a complete LearnHarness Pro CoursePack JSON so I can study at 0ms latency with Quizlet Learn 4-stage incremental mastery, Socratic Knowledge Graph probing, and a 0-100% Exam Readiness Predictor.

Follow these strict cognitive science rules:
1. Deconstruct the material into 2-5 Units (with examSharePercent summing to 100).
2. Extract the high-yield Propositions (nodes). Rank each by examWeight (1 to 5, where 5 = 80/20 Pareto generator that unlocks multiple exam questions).
3. Separate Principle (i) Unconditional Truths (isUnconditionalTruth: true — foundational facts/definitions) from Principle (ii) Motivated Derivations (isUnconditionalTruth: false — derived rules with prerequisites: ["upstream-node-id"] and a motivatedHook explaining "What problem forces us to invent this?").
4. For EVERY node, generate:
   - predictionPrompt (question, 3 options, correctIndex, resolution)
   - teachingStep (coreExplanation, ASCII visualMentalModel diagram, keyFormulaOrRule, checkQuestion)
   - quizletStages:
     * recognition (diagnostic MCQ where every wrong option names the exact misconception)
     * discrimination (near-twin trap contrasting two easily confused concepts)
     * cuedRecall (active recall prompt, acceptedKeywords array, canonicalAnswer, and 6-rung hints array [R0..R5] from R0 attention redirect to R5 worked step)
     * application (examProblem, feynmanPrompt, requiredMoves rubric, modelSolution, commonTraps, and 6-rung hints [R0..R5])

Output ONLY valid JSON matching this exact structure (no markdown commentary outside the JSON block):
{
  "id": "${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}",
  "code": "${code}",
  "title": "${code}: ${title}",
  "institutionTag": "Compiled by AI Agent from Class Materials",
  "examTitle": "${exam}",
  "description": "80/20 Pareto Knowledge Graph & 4-Stage Quizlet Learn Pack",
  "lastUpdated": "${new Date().toISOString().slice(0, 10)}",
  "units": [
    {
      "id": "unit-1",
      "number": 1,
      "title": "Unit 1 Title",
      "subtitle": "Core mechanisms & definitions",
      "examSharePercent": 50,
      "primingSummary": "High-level 80/20 overview of Unit 1",
      "unconditionalTruthSummary": "Bedrock premises of Unit 1"
    }
  ],
  "nodes": [
    {
      "id": "node-1",
      "unitId": "unit-1",
      "title": "Concept Title",
      "statement": "Exact causal invariant or definition",
      "isUnconditionalTruth": true,
      "prerequisites": [],
      "examWeight": 5,
      "motivatedHook": "Why does this concept need to exist?",
      "predictionPrompt": {
        "question": "Before seeing the rule, what happens when...?",
        "options": ["Correct prediction", "Misconception A", "Misconception B"],
        "correctIndex": 0,
        "resolution": "Why the prediction holds"
      },
      "teachingStep": {
        "coreExplanation": "First-principles explanation",
        "visualMentalModel": "[Input] ---> [Mechanism] ---> [Outcome]",
        "keyFormulaOrRule": "Key equation or law",
        "checkQuestion": {
          "question": "Immediate landing check question",
          "options": [
            { "text": "Correct answer", "diagnosticFeedback": "Why right" },
            { "text": "Trap answer", "misconceptionTag": "Inverted rule", "diagnosticFeedback": "Why wrong" }
          ],
          "correctIndex": 0
        }
      },
      "quizletStages": {
        "recognition": {
          "question": "Exam-style recognition MCQ",
          "options": [
            { "text": "Correct option", "misconception": "None", "explanation": "Exact reason" },
            { "text": "Distractor 1", "misconception": "Named trap", "explanation": "Why students fall for this" }
          ],
          "correctIndex": 0
        },
        "discrimination": {
          "scenario": "Boundary scenario",
          "confusableWith": "Near-twin concept",
          "question": "How do you distinguish this from its near-twin?",
          "options": [
            { "text": "Correct distinction", "whyRightOrWrong": "Exact boundary" },
            { "text": "Confused distinction", "whyRightOrWrong": "Reverses boundary" }
          ],
          "correctIndex": 0
        },
        "cuedRecall": {
          "prompt": "Without options, state the mechanism of...",
          "acceptedKeywords": ["keyword1", "keyword2"],
          "canonicalAnswer": "Full canonical answer",
          "hints": ["R0: Attention redirect", "R1: Pattern class", "R2: Candidate cluster", "R3: Named proposition", "R4: Move outline", "R5: Worked step"]
        },
        "application": {
          "examProblem": "Multi-step exam application problem",
          "feynmanPrompt": "Explain this to a classmate without jargon",
          "requiredMoves": [
            { "id": "m1", "label": "Move 1 description", "keywords": ["keyword1"] }
          ],
          "modelSolution": "Complete model derivation",
          "commonTraps": ["Trap 1 to avoid"],
          "hints": ["R0: ...", "R1: ...", "R2: ...", "R3: ...", "R4: ...", "R5: ..."]
        }
      }
    }
  ]
}`;
}

async function generateBrowserPKCEChallenge(): Promise<{
  verifier: string;
  challenge: string;
  state: string;
}> {
  const bytes = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  }
  const base64UrlEncode = (buf: Uint8Array) =>
    btoa(String.fromCharCode(...Array.from(buf)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  const verifier = base64UrlEncode(bytes);
  let challenge = verifier;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    challenge = base64UrlEncode(new Uint8Array(digest));
  }
  const stateBytes = new Uint8Array(16);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(stateBytes);
  }
  const state = base64UrlEncode(stateBytes);
  return { verifier, challenge, state };
}

export const CourseCompilerAndAuthModal: React.FC<
  CourseCompilerAndAuthModalProps
> = ({
  course,
  allCourses,
  aiStatus,
  onRefreshAIStatus,
  onAddCompiledCourse,
  onImportCourseJson,
  onLoadOptionalSampleCourse,
  onClearAllCoursesAndReset,
  onOpenSpotlightTutorial,
}) => {
  // Agent Harvester Prompt Builder State
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [examName, setExamName] = useState('');
  const [folderPath, setFolderPath] = useState('./imports');
  const [agentTarget, setAgentTarget] = useState<
    'codex_cli' | 'chatgpt_web' | 'claude_code'
  >('codex_cli');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Import / Raw Notes Compiler State (Starts Empty — No Pre-Filled Data!)
  const [importOrNotesInput, setImportOrNotesInput] = useState('');
  const [compileNotice, setCompileNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // OpenAI Account Authentication & Multi-Auth State
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>(
    aiStatus.activeProvider || 'chatgpt-oauth'
  );
  const [openaiTokenOrKey, setOpenaiTokenOrKey] = useState(() => {
    try {
      return localStorage.getItem('lh_openai_account_token') || '';
    } catch {
      return '';
    }
  });
  const [anthropicKey, setAnthropicKey] = useState(() => {
    try {
      return localStorage.getItem('lh_anthropic_key') || '';
    } catch {
      return '';
    }
  });
  const [localBridgeUrl, setLocalBridgeUrl] = useState('http://127.0.0.1:5173');
  const [oauthStatusText, setOauthStatusText] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{
    ok: boolean;
    provider: string;
    latencyMs: number;
    reply: string;
  } | null>(null);

  const generatedPrompt = buildMasterAgentPrompt({
    courseCode,
    courseTitle,
    examName,
    folderPath,
    agentTarget,
  });

  const handleCopyPrompt = () => {
    try {
      navigator.clipboard.writeText(generatedPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Handles either Agent JSON output OR raw lecture notes
  const handleBuildOrImportCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = importOrNotesInput.trim();
    if (!trimmed) {
      setCompileNotice({
        ok: false,
        text: 'Paste the JSON output from your AI agent (or paste your raw lecture notes) first.',
      });
      return;
    }

    // Check if input contains JSON CoursePack
    const jsonMatch =
      trimmed.startsWith('{')
        ? trimmed
        : trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)?.[1] || null;

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch) as CoursePack;
        if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          onImportCourseJson(parsed);
          setImportOrNotesInput('');
          setCompileNotice({
            ok: true,
            text: `Loaded "${parsed.title}" (${parsed.units?.length || 1} units, ${parsed.nodes.length} nodes) with a clean 0% progress slate!`,
          });
          return;
        }
      } catch {
        setCompileNotice({
          ok: false,
          text: 'The JSON block had a syntax error. Make sure you copied the complete JSON object from your agent.',
        });
        return;
      }
    }

    // Otherwise compile raw notes deterministically at 0 tokens
    const compiled = compileNotesToCoursePackLocally({
      title: courseTitle.trim() || 'Custom Class Study Pack',
      code: courseCode.trim() || 'CLASS 101',
      examTitle: examName.trim() || 'Upcoming Exam',
      rawText: trimmed,
    });
    onAddCompiledCourse(compiled);
    setImportOrNotesInput('');
    setCompileNotice({
      ok: true,
      text: `Compiled "${compiled.title}" (${compiled.units.length} units, ${compiled.nodes.length} nodes) with 0% fresh progress!`,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportOrNotesInput(reader.result);
      }
    };
    reader.readAsText(file);
  };

  // Launch OpenAI Account PKCE OAuth Flow (works with Local Bridge or Direct Browser PKCE)
  const handleStartOpenAIAccountOAuth = async () => {
    setOauthStatusText('Initializing OpenAI Account PKCE S256 Handshake...');
    try {
      // First try local Mac bridge if running
      const res = await fetch(`${localBridgeUrl}/api/ai/oauth/chatgpt/start`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authorizeUrl) {
          window.open(data.authorizeUrl, '_blank', 'noopener,noreferrer');
          setOauthStatusText(
            'Opened OpenAI Account Sign-In via your local Mac bridge. Complete sign-in in the new tab.'
          );
          return;
        }
      }
    } catch {
      // Running on static GitHub Pages without local bridge daemon — run browser-native PKCE S256
    }

    const pkce = await generateBrowserPKCEChallenge();
    try {
      sessionStorage.setItem('lh_openai_pkce_verifier', pkce.verifier);
      sessionStorage.setItem('lh_openai_pkce_state', pkce.state);
    } catch {
      // Ignore
    }

    const redirectUri =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'http://127.0.0.1:5173/auth/callback';

    const params = new URLSearchParams({
      client_id: 'dynamic_agent_client',
      agent_name_hint: 'LearnHarnessPro',
      response_type: 'code',
      redirect_uri: redirectUri,
      scope:
        'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      resource: 'https://api.openai.com/v1',
      state: pkce.state,
      code_challenge_method: 'S256',
      code_challenge: pkce.challenge,
    });

    const authorizeUrl = `https://auth.openai.com/api/accounts/authorize?${params.toString()}`;
    window.open(authorizeUrl, '_blank', 'noopener,noreferrer');
    setOauthStatusText(
      'Opened auth.openai.com PKCE Sign-In! Note: On static GitHub Pages, you can also run `npx @openai/codex login` in terminal and paste your OpenAI token below, or start `./scripts/mac-codex-setup.sh` for automatic localhost callback.'
    );
  };

  // Extract token if user pasted full ~/.codex/auth.json or bearer token
  const extractCleanToken = (raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return (
          parsed.access_token ||
          parsed.token ||
          parsed.OPENAI_API_KEY ||
          parsed.apiKey ||
          trimmed
        );
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  };

  const handleSaveAndVerifyOpenAI = async () => {
    setTestingConnection(true);
    setTestConnectionResult(null);
    const t0 = performance.now();
    const cleanOpenAIToken = extractCleanToken(openaiTokenOrKey);

    try {
      if (cleanOpenAIToken) {
        localStorage.setItem('lh_openai_account_token', cleanOpenAIToken);
      }
      if (anthropicKey.trim()) {
        localStorage.setItem('lh_anthropic_key', anthropicKey.trim());
      }
    } catch {
      // Ignore in sandboxed iframe
    }

    // 1. If OpenAI Token / API Key is provided, verify directly against https://api.openai.com/v1/chat/completions
    if (cleanOpenAIToken.length > 12) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanOpenAIToken}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are the LearnHarness Pro Socratic Examiner. Confirm in 2 short sentences that the user’s OpenAI account is authenticated and ready for exam prep.',
              },
              {
                role: 'user',
                content: 'Verify my OpenAI account connection.',
              },
            ],
            max_tokens: 120,
          }),
        });
        const data = await res.json();
        if (res.ok && data.choices?.[0]?.message?.content) {
          setTestConnectionResult({
            ok: true,
            provider: 'OpenAI Account Authenticated (Direct Browser Bridge · gpt-4o-mini)',
            latencyMs: Math.round(performance.now() - t0),
            reply: data.choices[0].message.content,
          });
          setTestingConnection(false);
          return;
        } else {
          setTestConnectionResult({
            ok: false,
            provider: 'OpenAI Auth Response',
            latencyMs: Math.round(performance.now() - t0),
            reply:
              data.error?.message ||
              'Token was rejected by api.openai.com. Verify your OpenAI token or API key.',
          });
          setTestingConnection(false);
          return;
        }
      } catch (err) {
        setTestConnectionResult({
          ok: false,
          provider: 'Browser Network Check',
          latencyMs: 0,
          reply: `Could not reach api.openai.com: ${(err as Error).message}`,
        });
        setTestingConnection(false);
        return;
      }
    }

    // 2. If Anthropic Key is provided
    if (anthropicKey.trim().startsWith('sk-ant-')) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey.trim(),
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 120,
            messages: [
              {
                role: 'user',
                content:
                  'Confirm in 2 short sentences that my Anthropic account is connected to LearnHarness Pro.',
              },
            ],
          }),
        });
        const data = await res.json();
        if (res.ok && data.content?.[0]?.text) {
          setTestConnectionResult({
            ok: true,
            provider: 'Anthropic Account Authenticated (claude-3-5-haiku)',
            latencyMs: Math.round(performance.now() - t0),
            reply: data.content[0].text,
          });
          setTestingConnection(false);
          return;
        }
      } catch {
        // Fall through
      }
    }

    // 3. Try Local Mac Bridge (http://127.0.0.1:5173/api/ai/status)
    try {
      const res = await fetch(`${localBridgeUrl}/api/ai/status`);
      if (res.ok) {
        const statusData = await res.json();
        onRefreshAIStatus();
        setTestConnectionResult({
          ok: true,
          provider: `Local Mac Bridge Connected (${statusData.activeProvider})`,
          latencyMs: Math.round(performance.now() - t0),
          reply: `Connected to local bridge at ${localBridgeUrl}. Codex CLI: ${
            statusData.codexCliAvailable ? 'Ready' : 'Not detected'
          } · OpenAI OAuth: ${
            statusData.chatgptOAuthConnected ? 'Connected' : 'Ready'
          }.`,
        });
        setTestingConnection(false);
        return;
      }
    } catch {
      // Not running local server
    }

    // 4. Confirm 0-Token Engine + instructions for OpenAI Token
    setTestConnectionResult({
      ok: true,
      provider: '0-Token Pre-Compiled Engine Active (Paste OpenAI Token Above for Live LLM)',
      latencyMs: 1,
      reply:
        'Your 0-Token Quizlet Learn & Socratic Hint Engine is ready at 0ms latency! To use live OpenAI responses on GitHub Pages, either paste your OpenAI token/key in the box above or click "Sign In with OpenAI Account (PKCE OAuth)".',
    });
    setTestingConnection(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Banner: Clean-Slate Guarantee + Launch Interactive Spotlight Tutorial */}
      <div
        className="card"
        style={{
          padding: '18px 22px',
          borderLeft: '4px solid var(--accent-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-accent">100% Clean-Slate Workspace</span>
            <span className="badge badge-success">
              {allCourses.length === 0
                ? '0 Pre-Filled Courses · Ready for Your Class'
                : `${allCourses.length} Custom Course(s) Loaded`}
            </span>
          </div>
          <h2 className="serif-heading" style={{ fontSize: '1.4rem' }}>
            Agent Class Material Harvester & OpenAI Account Setup
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Have your AI agent (OpenAI Codex, ChatGPT, or Claude) gather all your class lectures & exams into a custom study pack, and hook up your OpenAI account below.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={onOpenSpotlightTutorial}
          >
            <Compass size={15} /> Launch Spotlight Tutorial (Dim Screen + Arrows)
          </button>
          {allCourses.length > 0 && (
            <button
              className="btn btn-sm"
              onClick={onClearAllCoursesAndReset}
              title="Wipe all courses and progress back to an empty slate"
            >
              <Trash2 size={14} /> Clear All Data
            </button>
          )}
        </div>
      </div>

      {/* ROW 1: STEP-BY-STEP AGENT CLASS HARVESTER + MASTER PROMPT GENERATOR */}
      <div className="grid-12" style={{ alignItems: 'start' }}>
        {/* Left: Step-by-Step Agent Instructions */}
        <div
          className="card"
          data-tour-id="tour-agent-playbook"
          style={{
            gridColumn: 'span 6',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={18} style={{ color: 'var(--accent-primary)' }} />
            <span className="mono" style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
              Part 1 · Step-by-Step Agent Class Harvester
            </span>
          </div>

          <h3 className="serif-heading" style={{ fontSize: '1.3rem' }}>
            How to Have Your Agent Gather All Your Class Materials & Build Your Study Pack
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '3px' }}>
                Step 1 · Gather Your Class Files (Canvas / Blackboard / Slides / Exams)
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Download your course syllabus, lecture slides/PDFs, study guides, and practice exams into a single folder on your computer (e.g., <code>./imports</code> or <code>~/Desktop/MyClass</code>), or attach them directly into a ChatGPT / OpenAI Codex / Claude chat.
              </p>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px' }}>
                Step 2 · Customize Your Class Details & Choose Your Agent
              </div>

              <div className="grid-12" style={{ gap: '8px', marginBottom: '8px' }}>
                <div style={{ gridColumn: 'span 4' }}>
                  <label className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                    Course Code
                  </label>
                  <input
                    className="input"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. BIO 202"
                  />
                </div>
                <div style={{ gridColumn: 'span 8' }}>
                  <label className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                    Course Name
                  </label>
                  <input
                    className="input"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="e.g. Cellular Physiology & Biochemistry"
                  />
                </div>
              </div>

              <div className="grid-12" style={{ gap: '8px' }}>
                <div style={{ gridColumn: 'span 6' }}>
                  <label className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                    Target Exam
                  </label>
                  <input
                    className="input"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="e.g. Midterm 1"
                  />
                </div>
                <div style={{ gridColumn: 'span 6' }}>
                  <label className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                    Materials Folder (For Codex/Claude CLI)
                  </label>
                  <input
                    className="input mono"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    placeholder="./imports"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Copy Master Agent Prompt */}
            <div
              data-tour-id="tour-copy-prompt"
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: 'var(--accent-subtle)',
                border: '1.5px solid var(--accent-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  Step 3 · Copy the Master Agent Prompt
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${agentTarget === 'codex_cli' ? 'btn-primary' : ''}`}
                    onClick={() => setAgentTarget('codex_cli')}
                  >
                    OpenAI Codex
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${agentTarget === 'chatgpt_web' ? 'btn-primary' : ''}`}
                    onClick={() => setAgentTarget('chatgpt_web')}
                  >
                    ChatGPT Upload
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${agentTarget === 'claude_code' ? 'btn-primary' : ''}`}
                    onClick={() => setAgentTarget('claude_code')}
                  >
                    Claude Code
                  </button>
                </div>
              </div>

              <textarea
                className="textarea mono"
                rows={5}
                readOnly
                value={generatedPrompt}
                style={{ fontSize: '0.74rem', background: 'var(--bg-surface)' }}
              />

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCopyPrompt}
              >
                <Copy size={15} />{' '}
                {copiedPrompt
                  ? '✓ Copied Master Prompt! Paste it into Codex / ChatGPT / Claude'
                  : 'Copy Master Agent Prompt (1-Click)'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Step 4 Import Agent Output OR Raw Lecture Notes */}
        <form
          onSubmit={handleBuildOrImportCourse}
          className="card"
          data-tour-id="tour-import-box"
          style={{
            gridColumn: 'span 6',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={18} style={{ color: 'var(--success)' }} />
              <span className="mono" style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>
                Part 2 · Import Agent Output or Raw Notes
              </span>
            </div>

            <label
              className="btn btn-sm"
              style={{ cursor: 'pointer' }}
            >
              <Upload size={13} /> Upload .json / .md / .txt File
              <input
                type="file"
                accept=".json,.md,.txt"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <h3 className="serif-heading" style={{ fontSize: '1.3rem' }}>
            Step 4 · Paste Your Agent's JSON Output (or Raw Lecture Notes)
          </h3>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
            Paste the JSON block your agent generated from your class files—or paste raw lecture notes (<code># Unit Name</code> + <code>Concept: Explanation</code>)—to build your course with <strong>0% clean progress</strong>.
          </p>

          <textarea
            className="textarea mono"
            rows={10}
            value={importOrNotesInput}
            onChange={(e) => setImportOrNotesInput(e.target.value)}
            placeholder={`Paste your Agent's CoursePack JSON here:\n{\n  "id": "bio-202",\n  "title": "BIO 202: Cellular Physiology",\n  ...\n}\n\nOR paste raw lecture notes:\n# Unit 1: Membrane Potentials\nResting K+ Dominance: High resting K+ permeability drives Vm near -70mV...`}
            style={{ fontSize: '0.78rem' }}
          />

          {compileNotice && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: compileNotice.ok
                  ? 'var(--success-subtle)'
                  : 'var(--danger-subtle)',
                color: compileNotice.ok ? 'var(--success)' : 'var(--danger)',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              {compileNotice.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onLoadOptionalSampleCourse}
            >
              Load Optional Sample Course (0% Clean Progress)
            </button>

            <button type="submit" className="btn btn-primary">
              <Sparkles size={15} /> Build My Clean Course Pack
            </button>
          </div>

          {course && (
            <div
              style={{
                marginTop: '4px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Share <strong>{course.title}</strong> with classmates:
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(course, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${course.id}-pack.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download size={13} /> Export Course Pack (.json)
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ROW 2: OPENAI ACCOUNT AUTHENTICATION & MULTI-AUTH HUB */}
      <div
        className="card"
        data-tour-id="tour-openai-auth"
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
              <span className="mono" style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                Part 3 · OpenAI Account Authentication & Multi-Auth Bridge
              </span>
            </div>
            <h3 className="serif-heading" style={{ fontSize: '1.35rem' }}>
              Connect Your OpenAI Account (ChatGPT OAuth, Codex Login, or API Key)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '820px' }}>
              Authenticate with your OpenAI account below so you and your friends can use live Socratic coaching and Strict Examiner grading on GitHub Pages or on your Mac.
            </p>
          </div>

          <span className="badge badge-success">
            <Zap size={12} /> 80–95% of Study Runs at 0 Tokens
          </span>
        </div>

        <div className="grid-12" style={{ gap: '16px', alignItems: 'start' }}>
          {/* Column 1: OpenAI Account OAuth & Codex Session Bridge */}
          <div
            style={{
              gridColumn: 'span 6',
              padding: '16px',
              borderRadius: '10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.94rem' }}>
                1. Sign In with OpenAI Account (OAuth PKCE & Codex Login)
              </strong>
              <span className="badge badge-accent">ChatGPT Plus / Pro / Edu</span>
            </div>

            <p style={{ fontSize: '0.81rem', color: 'var(--text-secondary)' }}>
              Click below to launch the official OpenAI PKCE OAuth flow (<code>auth.openai.com/api/accounts/authorize</code>), or sign in via <strong>OpenAI Codex CLI</strong> on your Mac (<code>npx @openai/codex login</code>) and paste your session token / <code>~/.codex/auth.json</code> below:
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartOpenAIAccountOAuth}
              >
                <ExternalLink size={14} /> Sign In with OpenAI Account (PKCE OAuth)
              </button>
            </div>

            {oauthStatusText && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'var(--accent-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.79rem',
                }}
              >
                {oauthStatusText}
              </div>
            )}

            <div>
              <label className="mono" style={{ fontSize: '0.71rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                OPENAI ACCOUNT TOKEN / CODEX AUTH JSON / API KEY (WORKS DIRECTLY ON GITHUB PAGES)
              </label>
              <input
                type="password"
                className="input mono"
                value={openaiTokenOrKey}
                onChange={(e) => setOpenaiTokenOrKey(e.target.value)}
                placeholder="Paste OpenAI access_token, ~/.codex/auth.json content, or sk-... key"
              />
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Tip for Mac Codex users: Run <code>npx @openai/codex login</code> (uses your ChatGPT account), then copy the token from <code>~/.codex/auth.json</code> or run <code>./scripts/mac-codex-setup.sh</code>.
              </div>
            </div>
          </div>

          {/* Column 2: Provider Selector, Local Mac Bridge & Live Verification */}
          <div
            style={{
              gridColumn: 'span 6',
              padding: '16px',
              borderRadius: '10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <strong style={{ fontSize: '0.94rem' }}>
              2. Active AI Provider & 1-Click Live Verification
            </strong>

            <div>
              <label className="mono" style={{ fontSize: '0.71rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                ACTIVE TUTOR ROUTE
              </label>
              <select
                className="input"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as AIProviderId)}
              >
                <option value="chatgpt-oauth">
                  OpenAI Account (PKCE OAuth / Codex Account Token)
                </option>
                <option value="openai-api">
                  OpenAI Direct Browser Bridge (`gpt-4o-mini` / `gpt-4o`)
                </option>
                <option value="codex-cli">
                  OpenAI Codex CLI on Mac (`codex exec` via Local Bridge)
                </option>
                <option value="claude-cli">
                  Anthropic Claude Code CLI on Mac (`claude -p` via Local Bridge)
                </option>
                <option value="anthropic-api">
                  Anthropic Claude Direct Browser Bridge (`claude-3-5-haiku`)
                </option>
                <option value="zero-token-local">
                  0-Token Pre-Compiled Engine (Instant, Free, Offline-Ready)
                </option>
              </select>
            </div>

            <div className="grid-12" style={{ gap: '8px' }}>
              <div style={{ gridColumn: 'span 6' }}>
                <label className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                  OPTIONAL ANTHROPIC KEY
                </label>
                <input
                  type="password"
                  className="input mono"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                />
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <label className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                  LOCAL MAC BRIDGE URL
                </label>
                <input
                  className="input mono"
                  value={localBridgeUrl}
                  onChange={(e) => setLocalBridgeUrl(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAndVerifyOpenAI}
                disabled={testingConnection}
              >
                <KeyRound size={15} />{' '}
                {testingConnection
                  ? 'Verifying OpenAI Account...'
                  : 'Save & Verify OpenAI Account Connection'}
              </button>
            </div>

            {testConnectionResult && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: testConnectionResult.ok
                    ? 'var(--success-subtle)'
                    : 'var(--danger-subtle)',
                  border: `1px solid ${
                    testConnectionResult.ok ? 'var(--success)' : 'var(--danger)'
                  }`,
                  fontSize: '0.82rem',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '4px' }}>
                  <span>✓ {testConnectionResult.provider}</span>
                  <span className="mono">{testConnectionResult.latencyMs}ms</span>
                </div>
                {testConnectionResult.reply}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
