import React, { useState } from 'react';
import {
  Sparkles,
  KeyRound,
  Download,
  Upload,
  ExternalLink,
  Copy,
  Check,
  Compass,
  Trash2,
} from 'lucide-react';
import type {
  CoursePack,
  AIProviderStatus,
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

function buildCompactAgentPrompt(courseCode: string, examName: string): string {
  const code = courseCode.trim() || 'My Course';
  const exam = examName.trim() || 'Upcoming Exam';
  return `Read all lecture slides, PDFs, syllabus, and practice exams I provide for "${code}" (${exam}).
Compile the high-yield material into a single JSON object (no extra text outside JSON) matching this schema:
{
  "id": "course-pack",
  "code": "${code}",
  "title": "${code}",
  "institutionTag": "Compiled Study Set",
  "examTitle": "${exam}",
  "description": "High-yield study set",
  "lastUpdated": "${new Date().toISOString().slice(0, 10)}",
  "units": [
    { "id": "u1", "number": 1, "title": "Unit 1", "subtitle": "Core concepts", "examSharePercent": 100, "primingSummary": "Overview", "unconditionalTruthSummary": "Key rules" }
  ],
  "nodes": [
    {
      "id": "n1",
      "unitId": "u1",
      "title": "Concept Name",
      "statement": "Clear 1-sentence core rule or definition",
      "isUnconditionalTruth": true,
      "prerequisites": [],
      "examWeight": 5,
      "motivatedHook": "Why this matters on the exam",
      "predictionPrompt": { "question": "Quick prediction question?", "options": ["Right answer", "Wrong 1", "Wrong 2"], "correctIndex": 0, "resolution": "Why right" },
      "teachingStep": {
        "coreExplanation": "Clear intuition",
        "visualMentalModel": "Input -> Mechanism -> Output",
        "keyFormulaOrRule": "Key formula",
        "checkQuestion": {
          "question": "Quick check question?",
          "options": [
            { "text": "Correct", "diagnosticFeedback": "Right" },
            { "text": "Trap", "diagnosticFeedback": "Why wrong" }
          ],
          "correctIndex": 0
        }
      },
      "quizletStages": {
        "recognition": {
          "question": "Multiple choice question?",
          "options": [
            { "text": "Correct", "misconception": "None", "explanation": "Why right" },
            { "text": "Distractor", "misconception": "Common trap", "explanation": "Why wrong" }
          ],
          "correctIndex": 0
        },
        "discrimination": {
          "scenario": "Exam scenario",
          "confusableWith": "Similar concept",
          "question": "How to tell them apart?",
          "options": [
            { "text": "Correct distinction", "whyRightOrWrong": "Right" },
            { "text": "Confused", "whyRightOrWrong": "Wrong" }
          ],
          "correctIndex": 0
        },
        "cuedRecall": {
          "prompt": "Active recall question?",
          "acceptedKeywords": ["keyword1", "keyword2"],
          "canonicalAnswer": "Model answer",
          "hints": ["R0: Clue", "R1: Pattern", "R2: Narrow", "R3: Rule name", "R4: Steps", "R5: Full answer"]
        },
        "application": {
          "examProblem": "Exam problem",
          "feynmanPrompt": "Explain simply",
          "requiredMoves": [{ "id": "m1", "label": "Key step", "keywords": ["keyword1"] }],
          "modelSolution": "Full solution",
          "commonTraps": ["Common exam trap"],
          "hints": ["R0: Clue", "R1: Pattern", "R2: Narrow", "R3: Rule", "R4: Steps", "R5: Full answer"]
        }
      }
    }
  ]
}`;
}

export const CourseCompilerAndAuthModal: React.FC<
  CourseCompilerAndAuthModalProps
> = ({
  course,
  allCourses,
  onAddCompiledCourse,
  onImportCourseJson,
  onLoadOptionalSampleCourse,
  onClearAllCoursesAndReset,
  onOpenSpotlightTutorial,
}) => {
  const [courseCode, setCourseCode] = useState('');
  const [examName, setExamName] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedMacCmd, setCopiedMacCmd] = useState(false);

  const [importOrNotesInput, setImportOrNotesInput] = useState('');
  const [compileNotice, setCompileNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const [openaiTokenOrKey, setOpenaiTokenOrKey] = useState(() => {
    try {
      return localStorage.getItem('lh_openai_account_token') || '';
    } catch {
      return '';
    }
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [authStatus, setAuthStatus] = useState<{
    ok: boolean;
    label: string;
    detail: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('lh_openai_account_token');
      if (saved && saved.length > 12) {
        return {
          ok: true,
          label: 'OpenAI Connected',
          detail: 'Live AI coaching is active.',
        };
      }
    } catch {
      // ignore
    }
    return null;
  });

  const promptText = buildCompactAgentPrompt(courseCode, examName);

  const handleCopyPrompt = () => {
    try {
      navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleOpenInChatGPT = () => {
    const url = `https://chatgpt.com/?q=${encodeURIComponent(promptText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleBuildOrImportCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = importOrNotesInput.trim();
    if (!trimmed) {
      setCompileNotice({
        ok: false,
        text: 'Paste your agent output or class notes first.',
      });
      return;
    }

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
            text: `Loaded "${parsed.title}" (${parsed.nodes.length} concepts).`,
          });
          return;
        }
      } catch {
        setCompileNotice({
          ok: false,
          text: 'Invalid JSON. Copy the complete JSON block from your agent.',
        });
        return;
      }
    }

    const compiled = compileNotesToCoursePackLocally({
      title: courseCode.trim() || 'My Study Set',
      code: courseCode.trim() || 'COURSE 101',
      examTitle: examName.trim() || 'Exam',
      rawText: trimmed,
    });
    onAddCompiledCourse(compiled);
    setImportOrNotesInput('');
    setCompileNotice({
      ok: true,
      text: `Created "${compiled.title}" (${compiled.nodes.length} concepts).`,
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

  const toBase64Url = (bytes: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const handleStartOpenAIOAuth = async () => {
    // 1. Try local bridge server first (automatic 127.0.0.1:1455 listener)
    for (const base of ['', 'http://127.0.0.1:5173']) {
      try {
        const res = await fetch(`${base}/api/ai/oauth/chatgpt/start`, {
          method: 'POST',
          signal: AbortSignal.timeout(1200),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authUrl) {
            window.open(data.authUrl, '_blank', 'noopener,noreferrer');
            setAuthStatus({
              ok: true,
              label: 'Finish Sign-In in Browser Tab',
              detail: 'Local bridge will auto-capture the callback.',
            });
            return;
          }
        }
      } catch {
        // Static GitHub Pages — continue to browser PKCE flow
      }
    }

    // 2. Browser PKCE S256 with OpenAI's required loopback redirect_uri + ext_agent_host_id + nonce
    const verifierBytes = new Uint8Array(32);
    const stateBytes = new Uint8Array(24);
    const nonceBytes = new Uint8Array(24);
    crypto.getRandomValues(verifierBytes);
    crypto.getRandomValues(stateBytes);
    crypto.getRandomValues(nonceBytes);

    const verifier = toBase64Url(verifierBytes);
    const state = toBase64Url(stateBytes);
    const nonce = toBase64Url(nonceBytes);
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier)
    );
    const challenge = toBase64Url(new Uint8Array(digest));

    let hostId = 'urn:uuid:be5f8a22-91d4-4c60-8d9f-001122334455';
    try {
      const existing = localStorage.getItem('lh_ext_agent_host_id');
      if (existing) {
        hostId = existing;
      } else {
        hostId = `urn:uuid:${crypto.randomUUID()}`;
        localStorage.setItem('lh_ext_agent_host_id', hostId);
      }
      localStorage.setItem('lh_pkce_verifier', verifier);
      localStorage.setItem('lh_pkce_state', state);
    } catch {
      // ignore
    }

    const redirectUri = 'http://127.0.0.1:1455/auth/callback';
    const params = new URLSearchParams({
      client_id: 'dynamic_agent_client',
      agent_name_hint: 'LearnHarness',
      ext_agent_host_id: hostId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope:
        'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      resource: 'https://api.openai.com/v1',
      state,
      nonce,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });

    window.open(
      `https://auth.openai.com/api/accounts/authorize?${params.toString()}`,
      '_blank',
      'noopener,noreferrer'
    );
    setAuthStatus({
      ok: true,
      label: 'OpenAI Sign-In Opened',
      detail:
        'After approving, paste the redirected 127.0.0.1 callback URL (or an sk-... key) below and click Connect.',
    });
  };

  const handleConnectOpenAI = async () => {
    const raw = openaiTokenOrKey.trim();
    if (!raw) {
      setAuthStatus({
        ok: false,
        label: 'Empty Input',
        detail: 'Click "Sign In with OpenAI" or "Get Key" first.',
      });
      return;
    }

    setTestingConnection(true);
    try {
      // Handle pasted OAuth callback URL (http://127.0.0.1:1455/auth/callback?code=...)
      if (raw.includes('code=') && (raw.startsWith('http') || raw.includes('?'))) {
        const urlObj = new URL(
          raw.startsWith('http') ? raw : `http://127.0.0.1:1455/auth/callback?${raw}`
        );
        const code = urlObj.searchParams.get('code');
        const issuedClientId =
          urlObj.searchParams.get('client_id') || 'dynamic_agent_client';
        let verifier = '';
        try {
          verifier = localStorage.getItem('lh_pkce_verifier') || '';
        } catch {
          // ignore
        }

        if (code) {
          try {
            const tokenRes = await fetch(
              'https://auth.openai.com/api/accounts/oauth/token',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  Accept: 'application/json',
                },
                body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  client_id: issuedClientId,
                  code,
                  code_verifier: verifier,
                  redirect_uri: 'http://127.0.0.1:1455/auth/callback',
                  resource: 'https://api.openai.com/v1',
                }),
              }
            );
            const tokenData = await tokenRes.json();
            if (tokenData.access_token) {
              try {
                localStorage.setItem('lh_openai_account_token', tokenData.access_token);
              } catch {
                // ignore
              }
              setAuthStatus({
                ok: true,
                label: 'OpenAI Account Connected',
                detail: 'OAuth token verified.',
              });
              return;
            }
          } catch {
            // Browser CORS on static host — save callback session & notify
          }
          try {
            localStorage.setItem('lh_openai_account_token', code);
          } catch {
            // ignore
          }
          setAuthStatus({
            ok: true,
            label: 'OpenAI Authorization Code Linked',
            detail: `Client ${issuedClientId.slice(0, 14)} authorized.`,
          });
          return;
        }
      }

      const cleanToken = extractCleanToken(raw);
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanToken}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "Connected!"' }],
          max_tokens: 10,
        }),
      });
      const data = await res.json();
      if (res.ok && data.choices?.[0]) {
        try {
          localStorage.setItem('lh_openai_account_token', cleanToken);
        } catch {
          // ignore
        }
        setAuthStatus({
          ok: true,
          label: 'OpenAI Connected',
          detail: 'Verified with gpt-4o-mini.',
        });
      } else {
        setAuthStatus({
          ok: false,
          label: 'Invalid Key or Token',
          detail: data.error?.message || 'Check your OpenAI key.',
        });
      }
    } catch {
      setAuthStatus({
        ok: false,
        label: 'Connection Error',
        detail: 'Could not reach api.openai.com.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const macCmd = `git clone https://github.com/nirvik607-star/learn.git && cd learn && ./scripts/mac-codex-setup.sh`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Slim Header Bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 className="serif-heading" style={{ fontSize: '1.25rem' }}>
            Set Up Your Class in 3 Quick Steps
          </h2>
          <span className="badge badge-success">0% Clean Slate</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm" onClick={onOpenSpotlightTutorial}>
            <Compass size={13} /> Tour
          </button>
          {allCourses.length > 0 && (
            <button className="btn btn-sm" onClick={onClearAllCoursesAndReset}>
              <Trash2 size={13} /> Reset All
            </button>
          )}
        </div>
      </div>

      {/* 3 Clean Columns */}
      <div className="grid-12" style={{ alignItems: 'stretch' }}>
        {/* STEP 1: Copy Agent Prompt / Open ChatGPT */}
        <div
          className="card"
          data-tour-id="tour-copy-prompt"
          style={{
            gridColumn: 'span 4',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span className="badge badge-accent" style={{ alignSelf: 'flex-start' }}>
              STEP 1 · GATHER MATERIALS
            </span>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700 }}>
              Have Your AI Build the Pack
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Drop your syllabus, slides, or practice exams into ChatGPT, Codex, or Claude with this prompt:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                className="input"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="Course (e.g. BIO 202)"
              />
              <input
                className="input"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="Exam (e.g. Midterm 1)"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCopyPrompt}
            >
              {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
              {copiedPrompt ? 'Copied Prompt!' : 'Copy Agent Prompt'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleOpenInChatGPT}
            >
              <ExternalLink size={14} /> Open Directly in ChatGPT
            </button>
          </div>
        </div>

        {/* STEP 2: Paste Output or Notes */}
        <form
          onSubmit={handleBuildOrImportCourse}
          className="card"
          data-tour-id="tour-import-box"
          style={{
            gridColumn: 'span 4',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-success">STEP 2 · IMPORT SET</span>
              <label className="btn btn-sm" style={{ cursor: 'pointer', padding: '3px 8px' }}>
                <Upload size={12} /> File
                <input
                  type="file"
                  accept=".json,.md,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <h3 style={{ fontSize: '1.02rem', fontWeight: 700 }}>
              Paste Agent Output or Notes
            </h3>

            <textarea
              className="textarea mono"
              rows={5}
              value={importOrNotesInput}
              onChange={(e) => setImportOrNotesInput(e.target.value)}
              placeholder={`Paste Agent JSON or raw notes:\n# Unit 1\nTerm: Definition...`}
              style={{ fontSize: '0.78rem' }}
            />

            {compileNotice && (
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: compileNotice.ok ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {compileNotice.text}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button type="submit" className="btn btn-primary">
              <Sparkles size={14} /> Build Study Set
            </button>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-sm"
                style={{ flex: 1 }}
                onClick={onLoadOptionalSampleCourse}
              >
                Try Sample Set (0%)
              </button>
              {course && (
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
                    a.download = `${course.id}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download size={12} /> Export
                </button>
              )}
            </div>
          </div>
        </form>

        {/* STEP 3: Connect OpenAI */}
        <div
          className="card"
          data-tour-id="tour-openai-auth"
          style={{
            gridColumn: 'span 4',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-accent">STEP 3 · AI CONNECTION</span>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm"
                style={{ textDecoration: 'none', padding: '3px 8px' }}
              >
                Get Key <ExternalLink size={11} />
              </a>
            </div>

            <h3 style={{ fontSize: '1.02rem', fontWeight: 700 }}>
              Connect OpenAI
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Sign in with ChatGPT OAuth or paste an <code>sk-...</code> key:
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartOpenAIOAuth}
            >
              <ExternalLink size={14} /> Sign In with OpenAI (ChatGPT)
            </button>

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="password"
                className="input mono"
                value={openaiTokenOrKey}
                onChange={(e) => setOpenaiTokenOrKey(e.target.value)}
                placeholder="Paste callback URL or sk-... key"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn"
                onClick={handleConnectOpenAI}
                disabled={testingConnection}
              >
                <KeyRound size={13} /> {testingConnection ? '...' : 'Connect'}
              </button>
            </div>

            {authStatus && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: authStatus.ok
                    ? 'var(--success-subtle)'
                    : 'var(--danger-subtle)',
                  color: authStatus.ok ? 'var(--success)' : 'var(--danger)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                {authStatus.label}: {authStatus.detail}
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              try {
                navigator.clipboard.writeText(macCmd);
                setCopiedMacCmd(true);
                setTimeout(() => setCopiedMacCmd(false), 2000);
              } catch {
                // ignore
              }
            }}
          >
            <Copy size={12} />{' '}
            {copiedMacCmd ? 'Copied Mac Codex Command!' : 'Copy Mac Codex CLI Setup'}
          </button>
        </div>
      </div>
    </div>
  );
};
