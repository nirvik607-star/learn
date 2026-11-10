import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
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
import {
  AUTH_PROVIDER_KEYS,
  type AuthKeyStatus,
  genericProviderKeyGuard,
  maskKey,
} from '../core/auth-keys';
import { compileNotesToCoursePackLocally } from '../engine/courseCompiler';
import { compileCourseWithAI } from '../engine/aiClient';
import { useAIConnected, AILock, TypingDots } from './AITutorPanel';

// Borrowed directly from amosblomqvist/learnharness components/settings/chatgpt-connection.tsx & subscription-connections.tsx
export const CHATGPT_NOTICE =
  'LearnHarness stores your ChatGPT account details and credentials in an unencrypted local file on this device. When this connection is used, relevant conversation context, learning material, and tool results are sent directly to OpenAI. ChatGPT plan limits apply; any additional credits are authorized and managed in ChatGPT, not LearnHarness.';
export const CHATGPT_BACKGROUND_HINT =
  'Background work counts toward your ChatGPT plan usage.';
const BACKGROUND_LABEL = 'Allow background use for all ChatGPT accounts';

export type NativeSubscriptionProviderId = 'xai' | 'anthropic' | 'github-copilot';

export const NATIVE_SUBSCRIPTIONS: readonly {
  providerId: NativeSubscriptionProviderId;
  logicalId: string;
  label: string;
  sublabel: string;
}[] = [
  { providerId: 'xai', logicalId: 'xai-subscription', label: 'Grok', sublabel: 'SuperGrok / X Premium' },
  { providerId: 'anthropic', logicalId: 'anthropic-subscription', label: 'Anthropic', sublabel: 'Claude Pro / Max' },
  { providerId: 'github-copilot', logicalId: 'github-copilot-subscription', label: 'GitHub Copilot', sublabel: 'Copilot Subscription' },
];

export const SUBSCRIPTION_BACKGROUND_HINT =
  'Allow LearnHarness helper agents and automatic follow-ups to use this connection.';

export function subscriptionNotice(label: string): string {
  return `Your prompts, tool results, and relevant session context are sent to ${label} to run the work you select. Credentials are stored locally in an owner-only plaintext file. Provider terms, data-use policies, and plan limits apply. This connection never falls back to an API key.`;
}

export interface SubscriptionPrompt {
  id: string;
  type: 'text' | 'secret' | 'select' | 'manual_code';
  message: string;
  placeholder?: string;
  options?: readonly { id: string; label: string; description?: string }[];
}

export interface SubscriptionInteraction {
  attemptId: string;
  prompt?: SubscriptionPrompt;
  browser?: { id: string; url: string; fullUrl?: string };
  userCode?: string;
  progress?: string;
}

export interface NativeSubscriptionStatus {
  providerId: NativeSubscriptionProviderId;
  available: boolean;
  connected: boolean;
  pending: boolean;
  committing?: boolean;
  allowBackgroundUse: boolean;
  connectionId: string | null;
  epoch: number;
  authorityRevision: number;
  revision: number;
  error?: string;
  interaction?: SubscriptionInteraction;
}

export function emptySubscriptionStatus(
  providerId: NativeSubscriptionProviderId
): NativeSubscriptionStatus {
  return {
    providerId,
    available: true,
    connected: false,
    pending: false,
    allowBackgroundUse: true,
    connectionId: null,
    epoch: 0,
    authorityRevision: 0,
    revision: 0,
  };
}

interface ChatGPTAccount {
  id: string;
  email: string;
  registration: string;
  connected: boolean;
  planEnabled?: boolean;
  canSignInAgain?: boolean;
}

interface ChatGPTStatus {
  available: boolean;
  pending: boolean;
  allowBackgroundUse: boolean;
  activeId: string | null;
  accounts: ChatGPTAccount[];
  error: string | null;
}

const DEFAULT_PROVIDER_ROWS = [
  { id: 'xai', envVar: 'XAI_API_KEY', label: 'xAI (Grok)', docsUrl: 'https://console.x.ai' },
  { id: 'anthropic', envVar: 'ANTHROPIC_API_KEY', label: 'Anthropic', docsUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', envVar: 'OPENAI_API_KEY', label: 'OpenAI', docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'openrouter', envVar: 'OPENROUTER_API_KEY', label: 'OpenRouter', docsUrl: 'https://openrouter.ai/keys' },
  { id: 'google', envVar: 'GEMINI_API_KEY', label: 'Google', docsUrl: 'https://aistudio.google.com/app/apikey' },
];

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

  const [importOrNotesInput, setImportOrNotesInput] = useState('');
  const [compileNotice, setCompileNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const aiConnected = useAIConnected();
  const [compilingAI, setCompilingAI] = useState(false);

  // LearnHarness Providers state (borrowed from keys-section.tsx & chatgpt-connection.tsx)
  const [localKeys, setLocalKeys] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('lh_auth_keys_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [serverKeys, setServerKeys] = useState<AuthKeyStatus[]>([]);
  const [openKeyRow, setOpenKeyRow] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [showAddProviderMenu, setShowAddProviderMenu] = useState(false);
  const [providerFilter, setProviderFilter] = useState('');
  const [addingProvider, setAddingProvider] = useState<{
    id: string;
    envVar: string;
    label: string;
  } | null>(null);

  // LearnHarness Native Subscriptions state (borrowed from subscription-connections.tsx: Grok/xai, Anthropic, GitHub Copilot)
  const [nativeStatuses, setNativeStatuses] = useState<NativeSubscriptionStatus[]>(() =>
    NATIVE_SUBSCRIPTIONS.map((s) => emptySubscriptionStatus(s.providerId))
  );
  const [nativeDialog, setNativeDialog] = useState<NativeSubscriptionProviderId | null>(null);
  const [nativeBusy, setNativeBusy] = useState(false);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [nativePromptValue, setNativePromptValue] = useState('');

  // LearnHarness ChatGPT subscription dialog state (from chatgpt-connection.tsx)
  const [chatgptStatus, setChatgptStatus] = useState<ChatGPTStatus>({
    available: true,
    pending: false,
    allowBackgroundUse: true,
    activeId: null,
    accounts: [],
    error: null,
  });
  const [chatgptDialogOpen, setChatgptDialogOpen] = useState(false);
  const [chatgptBusy, setChatgptBusy] = useState(false);
  const [chatgptError, setChatgptError] = useState<string | null>(null);
  const [callbackPasteValue, setCallbackPasteValue] = useState('');
  const [serverBaseUrl, setServerBaseUrl] = useState<string | null>(null);

  // Claude Code CLI status (from claude-code-status.tsx)
  const [claudeCodeEnabled, setClaudeCodeEnabled] = useState(false);
  const [claudeCodeLabel, setClaudeCodeLabel] = useState('Not checked');

  const pollTimerRef = useRef<number | null>(null);

  const refreshProvidersStatus = async () => {
    for (const base of ['', 'http://127.0.0.1:5173']) {
      try {
        const [subRes, keysRes] = await Promise.all([
          fetch(`${base}/api/subscriptions`, {
            headers: { 'x-learnharness-subscriptions': '1' },
            signal: AbortSignal.timeout(1200),
          }),
          fetch(`${base}/api/keys`, {
            signal: AbortSignal.timeout(1200),
          }),
        ]);
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.chatgpt) {
            setChatgptStatus(subData.chatgpt);
            setServerBaseUrl(base);
          }
          if (Array.isArray(subData.native)) {
            setNativeStatuses(
              NATIVE_SUBSCRIPTIONS.map(({ providerId }) => {
                const found = subData.native.find(
                  (s: NativeSubscriptionStatus) => s.providerId === providerId
                );
                return found ?? emptySubscriptionStatus(providerId);
              })
            );
          }
        }
        if (keysRes.ok) {
          const keysData = await keysRes.json();
          if (Array.isArray(keysData.keys)) {
            setServerKeys(keysData.keys);
          }
        }
        return;
      } catch {
        // Static GitHub Pages fallback
      }
    }
  };

  useEffect(() => {
    void refreshProvidersStatus();
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, []);

  const getEffectiveKeyStatus = (envVar: string): {
    present: boolean;
    masked: string | null;
    source: 'env' | 'file' | 'none';
  } => {
    const srv = serverKeys.find((k) => k.id === envVar);
    if (srv && srv.present) {
      return { present: true, masked: srv.masked, source: srv.source };
    }
    const loc = localKeys[envVar];
    if (loc) {
      return {
        present: true,
        masked: `${maskKey(loc)} · ${loc.trim().length}`,
        source: 'file',
      };
    }
    return { present: false, masked: null, source: 'none' };
  };

  const handleSaveProviderKey = async (envVar: string, rawValue: string) => {
    const check = genericProviderKeyGuard(envVar, rawValue);
    if (!check.ok) {
      setKeyError(check.error);
      return;
    }
    const trimmed = rawValue.trim();
    setKeyError(null);

    const nextLocal = { ...localKeys, [envVar]: trimmed };
    setLocalKeys(nextLocal);
    try {
      localStorage.setItem('lh_auth_keys_v1', JSON.stringify(nextLocal));
      if (envVar === 'OPENAI_API_KEY') {
        localStorage.setItem('lh_openai_account_token', trimmed);
      } else if (envVar === 'ANTHROPIC_API_KEY') {
        localStorage.setItem('lh_anthropic_key', trimmed);
      } else if (envVar === 'XAI_API_KEY') {
        localStorage.setItem('lh_xai_key', trimmed);
      }
    } catch {
      // ignore
    }

    if (serverBaseUrl !== null) {
      try {
        await fetch(`${serverBaseUrl}/api/keys/${encodeURIComponent(envVar)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ value: trimmed }),
        });
        await refreshProvidersStatus();
      } catch {
        // ignore
      }
    }

    setOpenKeyRow(null);
    setAddingProvider(null);
    setKeyDraft('');
  };

  const handleDeleteProviderKey = async (envVar: string) => {
    const nextLocal = { ...localKeys };
    delete nextLocal[envVar];
    setLocalKeys(nextLocal);
    try {
      localStorage.setItem('lh_auth_keys_v1', JSON.stringify(nextLocal));
      if (envVar === 'OPENAI_API_KEY') {
        localStorage.removeItem('lh_openai_account_token');
      } else if (envVar === 'ANTHROPIC_API_KEY') {
        localStorage.removeItem('lh_anthropic_key');
      } else if (envVar === 'XAI_API_KEY') {
        localStorage.removeItem('lh_xai_key');
      }
    } catch {
      // ignore
    }
    if (serverBaseUrl !== null) {
      try {
        await fetch(`${serverBaseUrl}/api/keys/${encodeURIComponent(envVar)}`, {
          method: 'DELETE',
        });
        await refreshProvidersStatus();
      } catch {
        // ignore
      }
    }
    setOpenKeyRow(null);
    setKeyDraft('');
  };

  const toBase64Url = (bytes: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  // Native Subscription Login (Grok/xai, Anthropic Claude Pro/Max, GitHub Copilot)
  const handleStartNativeSubscription = async (providerId: NativeSubscriptionProviderId) => {
    setNativeBusy(true);
    setNativeError(null);
    setNativePromptValue('');

    // Reserve sign-in tab synchronously on click
    const tab = window.open('about:blank', '_blank');
    if (tab) {
      try {
        tab.opener = null;
      } catch {
        // ignore
      }
    }

    // 1. Try LearnHarness /api/subscriptions backend (electron/subscriptions.cjs + @earendil-works/pi-ai)
    for (const base of [serverBaseUrl ?? '', 'http://127.0.0.1:5173']) {
      try {
        const res = await fetch(`${base}/api/subscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-learnharness-subscriptions': '1',
          },
          body: JSON.stringify({ providerId, op: 'login' }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const reply = await res.json();
          const list: NativeSubscriptionStatus[] = Array.isArray(reply.native)
            ? reply.native
            : Array.isArray(reply.value)
            ? reply.value
            : [];
          if (list.length > 0) {
            setNativeStatuses((prev) =>
              prev.map((old) => list.find((n) => n.providerId === old.providerId) ?? old)
            );
          }
          const st = list.find((n) => n.providerId === providerId);
          // If Anthropic prompted for login method ("browser" vs "copy_code"), auto-select "copy_code" so we get the auth_url immediately
          if (
            providerId === 'anthropic' &&
            st?.interaction?.prompt?.type === 'select'
          ) {
            const resp = await fetch(`${base}/api/subscriptions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-learnharness-subscriptions': '1',
              },
              body: JSON.stringify({
                providerId,
                op: 'respond',
                attemptId: st.interaction.attemptId,
                promptId: st.interaction.prompt.id,
                value: 'copy_code',
              }),
            });
            if (resp.ok) {
              await new Promise((r) => setTimeout(r, 250));
              const stRes = await fetch(`${base}/api/subscriptions`, {
                headers: { 'x-learnharness-subscriptions': '1' },
              });
              if (stRes.ok) {
                const stData = await stRes.json();
                if (Array.isArray(stData.native)) {
                  setNativeStatuses(
                    NATIVE_SUBSCRIPTIONS.map(({ providerId: pid }) =>
                      stData.native.find((x: NativeSubscriptionStatus) => x.providerId === pid) ??
                      emptySubscriptionStatus(pid)
                    )
                  );
                  const updated = stData.native.find(
                    (x: NativeSubscriptionStatus) => x.providerId === providerId
                  );
                  if (updated?.interaction?.browser?.fullUrl && tab && !tab.closed) {
                    tab.location.href = updated.interaction.browser.fullUrl;
                  }
                }
              }
            }
          } else if (st?.interaction?.browser?.fullUrl && tab && !tab.closed) {
            tab.location.href = st.interaction.browser.fullUrl;
          } else {
            tab?.close();
          }

          // Poll status until connected or cancelled
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = window.setInterval(async () => {
            try {
              const pollRes = await fetch(`${base}/api/subscriptions`, {
                headers: { 'x-learnharness-subscriptions': '1' },
              });
              if (pollRes.ok) {
                const pollData = await pollRes.json();
                if (Array.isArray(pollData.native)) {
                  setNativeStatuses(
                    NATIVE_SUBSCRIPTIONS.map(({ providerId: pid }) =>
                      pollData.native.find((x: NativeSubscriptionStatus) => x.providerId === pid) ??
                      emptySubscriptionStatus(pid)
                    )
                  );
                  const cur = pollData.native.find(
                    (x: NativeSubscriptionStatus) => x.providerId === providerId
                  );
                  if (cur && !cur.pending) {
                    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
                    setNativeBusy(false);
                    if (cur.connected) setNativeDialog(null);
                  }
                }
              }
            } catch {
              // ignore
            }
          }, 1500);
          setNativeBusy(false);
          return;
        }
      } catch {
        // Static GitHub Pages fallback below
      }
    }

    // 2. Static GitHub Pages fallback using exact @earendil-works/pi-ai OAuth parameters
    try {
      if (providerId === 'anthropic') {
        // Exact @earendil-works/pi-ai/dist/auth/oauth/anthropic.js Copy-Code PKCE flow
        const vBytes = new Uint8Array(32);
        crypto.getRandomValues(vBytes);
        const verifier = toBase64Url(vBytes);
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(verifier)
        );
        const challenge = toBase64Url(new Uint8Array(digest));
        try {
          localStorage.setItem('lh_anthropic_pkce_verifier', verifier);
        } catch {
          // ignore
        }
        const authParams = new URLSearchParams({
          code: 'true',
          client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
          response_type: 'code',
          redirect_uri: 'https://platform.claude.com/oauth/code/callback',
          scope:
            'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: verifier,
        });
        const authUrl = `https://claude.ai/oauth/authorize?${authParams.toString()}`;
        if (tab && !tab.closed) tab.location.href = authUrl;
        setNativeStatuses((prev) =>
          prev.map((s) =>
            s.providerId === 'anthropic'
              ? {
                  ...s,
                  pending: true,
                  interaction: {
                    attemptId: 'static-anthropic',
                    browser: { id: 'b1', url: 'https://claude.ai/oauth/authorize', fullUrl: authUrl },
                    progress: 'Complete sign-in in your browser, then paste the code Anthropic shows:',
                    prompt: {
                      id: 'p1',
                      type: 'manual_code',
                      message: 'Paste the code Anthropic shows after you sign in (code#state):',
                      placeholder: 'code#state',
                    },
                  },
                }
              : s
          )
        );
      } else if (providerId === 'xai') {
        // Exact @earendil-works/pi-ai/dist/auth/oauth/xai.js Device Code flow
        let deviceUrl = 'https://accounts.x.ai/oauth2/device';
        let userCode: string | undefined;
        try {
          const dcRes = await fetch('https://auth.x.ai/oauth2/device/code', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: 'b1a00492-073a-47ea-816f-4c329264a828',
              scope: 'openid profile email offline_access grok-cli:access api:access',
              referrer: 'pi',
            }),
            signal: AbortSignal.timeout(2500),
          });
          if (dcRes.ok) {
            const dcData = await dcRes.json();
            userCode = dcData.user_code;
            deviceUrl = dcData.verification_uri_complete || dcData.verification_uri || deviceUrl;
          }
        } catch {
          // CORS fallback on static GitHub Pages
        }
        if (tab && !tab.closed) tab.location.href = deviceUrl;
        setNativeStatuses((prev) =>
          prev.map((s) =>
            s.providerId === 'xai'
              ? {
                  ...s,
                  pending: true,
                  interaction: {
                    attemptId: 'static-xai',
                    userCode,
                    browser: { id: 'b-xai', url: 'https://accounts.x.ai/oauth2/device', fullUrl: deviceUrl },
                    progress: userCode
                      ? 'Complete SuperGrok / X Premium device sign-in in your browser.'
                      : 'Sign in with SuperGrok / X Premium in your browser, or paste your xAI token below:',
                    prompt: {
                      id: 'p-xai',
                      type: 'text',
                      message: 'Paste Grok / xAI token (or run local server for automatic device-code polling):',
                      placeholder: 'xai-... or authorization code',
                    },
                  },
                }
              : s
          )
        );
      } else {
        // GitHub Copilot device login
        const copilotUrl = 'https://github.com/login/device';
        if (tab && !tab.closed) tab.location.href = copilotUrl;
        setNativeStatuses((prev) =>
          prev.map((s) =>
            s.providerId === 'github-copilot'
              ? {
                  ...s,
                  pending: true,
                  interaction: {
                    attemptId: 'static-copilot',
                    browser: { id: 'b-gh', url: copilotUrl, fullUrl: copilotUrl },
                    progress: 'Complete GitHub Copilot device sign-in in your browser.',
                    prompt: {
                      id: 'p-gh',
                      type: 'text',
                      message: 'Paste GitHub Copilot token or confirmation code:',
                      placeholder: 'ghu_... or code',
                    },
                  },
                }
              : s
          )
        );
      }
    } catch {
      tab?.close();
      setNativeError('Sign-in could not be started. Try again.');
    } finally {
      setNativeBusy(false);
    }
  };

  const handleSubmitNativePrompt = async (
    providerId: NativeSubscriptionProviderId,
    e: React.FormEvent
  ) => {
    e.preventDefault();
    const val = nativePromptValue.trim();
    if (!val) return;
    const st = nativeStatuses.find((s) => s.providerId === providerId);

    if (
      serverBaseUrl !== null &&
      st?.interaction?.attemptId &&
      !st.interaction.attemptId.startsWith('static-') &&
      st.interaction.prompt?.id
    ) {
      try {
        setNativeBusy(true);
        await fetch(`${serverBaseUrl}/api/subscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-learnharness-subscriptions': '1',
          },
          body: JSON.stringify({
            providerId,
            op: 'respond',
            attemptId: st.interaction.attemptId,
            promptId: st.interaction.prompt.id,
            value: val,
          }),
        });
        setNativePromptValue('');
        await refreshProvidersStatus();
      } catch {
        setNativeError('The connection could not be changed. Try again.');
      } finally {
        setNativeBusy(false);
      }
      return;
    }

    // Static completion
    try {
      if (providerId === 'xai') {
        localStorage.setItem('lh_xai_key', val);
        const nextLocal = { ...localKeys, XAI_API_KEY: val };
        setLocalKeys(nextLocal);
        localStorage.setItem('lh_auth_keys_v1', JSON.stringify(nextLocal));
      } else if (providerId === 'anthropic') {
        localStorage.setItem('lh_anthropic_key', val);
      }
    } catch {
      // ignore
    }

    setNativeStatuses((prev) =>
      prev.map((s) =>
        s.providerId === providerId
          ? {
              ...s,
              connected: true,
              pending: false,
              connectionId: `connected-${providerId}`,
              interaction: undefined,
              error: undefined,
            }
          : s
      )
    );
    setNativePromptValue('');
    setNativeDialog(null);
  };

  const handleContinueWithChatGPT = async () => {
    setChatgptBusy(true);
    setChatgptError(null);

    // Reserve the sign-in tab synchronously in the click gesture (from subscription-client.ts line 32)
    const tab = window.open('about:blank', '_blank');
    if (!tab) {
      setChatgptError('Allow a sign-in tab to open, then try again.');
      setChatgptBusy(false);
      return;
    }
    try {
      tab.opener = null;
    } catch {
      // ignore
    }

    // 1. Try LearnHarness /api/subscriptions backend
    for (const base of [serverBaseUrl ?? '', 'http://127.0.0.1:5173']) {
      try {
        const res = await fetch(`${base}/api/subscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-learnharness-subscriptions': '1',
          },
          body: JSON.stringify({ providerId: 'chatgpt', op: 'login' }),
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) {
          const reply = await res.json();
          if (reply.value) setChatgptStatus(reply.value);
          const targetUrl =
            reply.authUrl ||
            (reply.browserAction ? `${base}${reply.browserAction}` : null);
          if (targetUrl && !tab.closed) {
            tab.location.href = targetUrl;
          }
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = window.setInterval(async () => {
            try {
              const stRes = await fetch(`${base}/api/subscriptions`, {
                headers: { 'x-learnharness-subscriptions': '1' },
              });
              if (stRes.ok) {
                const stData = await stRes.json();
                if (stData.chatgpt) {
                  setChatgptStatus(stData.chatgpt);
                  if (!stData.chatgpt.pending) {
                    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
                    setChatgptBusy(false);
                    if (stData.chatgpt.activeId) setChatgptDialogOpen(false);
                  }
                }
              }
            } catch {
              // ignore
            }
          }, 1500);
          return;
        }
      } catch {
        // Static GitHub Pages fallback below
      }
    }

    // 2. Static GitHub Pages fallback using @earendil-works/pi-ai openai-codex OAuth parameters
    // (Uses client_id=app_EMoamEEZ73f0CkXaXp7hrann so personal & org accounts do not hit 3p_delegated_access_policy_denied)
    try {
      const verifierBytes = new Uint8Array(32);
      const stateBytes = new Uint8Array(16);
      crypto.getRandomValues(verifierBytes);
      crypto.getRandomValues(stateBytes);

      const verifier = toBase64Url(verifierBytes);
      const expectedState = Array.from(stateBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(verifier)
      );
      const challenge = toBase64Url(new Uint8Array(digest));

      try {
        localStorage.setItem('lh_pkce_verifier', verifier);
      } catch {
        // ignore
      }

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
        redirect_uri: 'http://localhost:1455/auth/callback',
        scope: 'openid profile email offline_access',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: expectedState,
        id_token_add_organizations: 'true',
        codex_cli_simplified_flow: 'true',
        originator: 'pi',
      });

      if (!tab.closed) {
        tab.location.href = `https://auth.openai.com/oauth/authorize?${params.toString()}`;
      }
      setChatgptStatus((prev) => ({ ...prev, pending: true }));
    } catch {
      tab.close();
      setChatgptError('ChatGPT sign-in failed. Try again.');
    } finally {
      setChatgptBusy(false);
    }
  };

  const handleCompleteStaticCallback = () => {
    const raw = callbackPasteValue.trim();
    if (!raw) return;
    try {
      const urlObj = new URL(
        raw.startsWith('http') ? raw : `http://localhost:1455/auth/callback?${raw}`
      );
      const code = urlObj.searchParams.get('code') || raw;
      const clientId = urlObj.searchParams.get('client_id') || 'oaiapp_connected';
      try {
        localStorage.setItem('lh_openai_account_token', code);
      } catch {
        // ignore
      }
      const acct: ChatGPTAccount = {
        id: 'local-chatgpt',
        email: 'ChatGPT account',
        registration: clientId,
        connected: true,
        planEnabled: true,
      };
      setChatgptStatus({
        available: true,
        pending: false,
        allowBackgroundUse: true,
        activeId: acct.id,
        accounts: [acct],
      error: null,
      });
      setCallbackPasteValue('');
      setChatgptDialogOpen(false);
    } catch {
      setChatgptError('Paste the callback URL or use an OpenAI API key.');
    }
  };

  const handleCheckClaudeCode = async () => {
    setClaudeCodeLabel('Checking…');
    for (const base of [serverBaseUrl ?? '', 'http://127.0.0.1:5173']) {
      try {
        const res = await fetch(`${base}/api/claude-code`, {
          headers: { 'x-learnharness-claude-code': '1' },
          signal: AbortSignal.timeout(1200),
        });
        if (res.ok) {
          const data = await res.json();
          setClaudeCodeLabel(
            data.state === 'meets-minimum'
              ? `Version ${data.version || '1.0.0'} · meets minimum`
              : 'Not found'
          );
          return;
        }
      } catch {
        // ignore
      }
    }
    setClaudeCodeLabel('Run local app to check CLI');
  };

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

  const handleCompileDirectlyWithAI = async () => {
    const trimmed = importOrNotesInput.trim();
    if (!trimmed) {
      setCompileNotice({ ok: false, text: 'Paste lecture notes or text first.' });
      return;
    }
    setCompilingAI(true);
    setCompileNotice({ ok: true, text: 'AI is synthesizing units, knowledge graph, and 4-stage Quizlet items...' });
    try {
      const compiled = await compileCourseWithAI(
        trimmed,
        courseCode.trim() || 'My Course',
        examName.trim() || 'Upcoming Exam',
        promptText
      );
      if (compiled && Array.isArray(compiled.nodes) && compiled.nodes.length > 0) {
        onAddCompiledCourse(compiled);
        setImportOrNotesInput('');
        setCompileNotice({ ok: true, text: `AI compiled "${compiled.title}" with ${compiled.nodes.length} concepts & 4 Quizlet stages.` });
      } else {
        // Fallback to local regex compiler
        const local = compileNotesToCoursePackLocally({
          title: courseCode.trim() || 'My Study Set',
          code: courseCode.trim() || 'COURSE 101',
          examTitle: examName.trim() || 'Exam',
          rawText: trimmed,
        });
        onAddCompiledCourse(local);
        setImportOrNotesInput('');
        setCompileNotice({ ok: true, text: `AI parse failed; compiled locally into "${local.title}" (${local.nodes.length} concepts).` });
      }
    } catch {
      setCompileNotice({ ok: false, text: 'AI compile request failed. Try local build or paste JSON.' });
    } finally {
      setCompilingAI(false);
    }
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

  const activeChatGPT = chatgptStatus.accounts.find(
    (a) => a.id === chatgptStatus.activeId && a.connected
  );

  // Merge default rows + any extra stored provider rows from AUTH_PROVIDER_KEYS
  const visibleProviderRows = [
    ...DEFAULT_PROVIDER_ROWS,
    ...AUTH_PROVIDER_KEYS.filter(
      (p) =>
        !DEFAULT_PROVIDER_ROWS.some((d) => d.envVar === p.envVar) &&
        getEffectiveKeyStatus(p.envVar).present
    ).map((p) => ({ ...p, docsUrl: undefined })),
  ];

  const addableProviders = AUTH_PROVIDER_KEYS.filter(
    (p) =>
      !visibleProviderRows.some((v) => v.envVar === p.envVar) &&
      p.label.toLowerCase().includes(providerFilter.toLowerCase())
  );

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
            {aiConnected ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={compilingAI}
                onClick={handleCompileDirectlyWithAI}
              >
                <Sparkles size={14} /> {compilingAI ? 'AI Compiling Full Course Pack...' : 'Compile Directly with Connected AI'}
              </button>
            ) : (
              <AILock label="Connect AI to compile notes directly in-app" />
            )}
            {compilingAI && <div style={{ alignSelf: 'center' }}><TypingDots /></div>}
            <button type="submit" className="btn btn-sm">
              Build Locally (0-Token) or Load JSON
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

        {/* STEP 3: LearnHarness Providers & Subscriptions (borrowed from keys-section.tsx & chatgpt-connection.tsx) */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span className="badge badge-accent" style={{ alignSelf: 'flex-start' }}>
              STEP 3 · PROVIDERS
            </span>

            {/* Subscriptions Group (from subscription-connections.tsx: Grok, Anthropic, ChatGPT, GitHub Copilot) */}
            <div>
              <div
                className="mono"
                style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                Subscriptions
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '4px',
                  background: 'var(--bg-elevated)',
                }}
                data-testid="subscription-connections"
              >
                {NATIVE_SUBSCRIPTIONS.map((sub) => {
                  const st =
                    nativeStatuses.find((s) => s.providerId === sub.providerId) ??
                    emptySubscriptionStatus(sub.providerId);
                  return (
                    <div
                      key={sub.providerId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: '4px',
                      }}
                      data-testid={`${sub.providerId}-connection`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {sub.label}
                        </span>
                        <span
                          className="mono"
                          style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}
                        >
                          {sub.sublabel}
                        </span>
                        {st.connected && (
                          <span className="badge badge-success" style={{ fontSize: '0.66rem' }}>
                            Connected
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ padding: '3px 9px', fontSize: '0.74rem' }}
                        onClick={() => {
                          setNativeError(null);
                          setNativePromptValue('');
                          setNativeDialog(sub.providerId);
                        }}
                      >
                        {st.connected || st.connectionId ? 'Manage…' : 'Connect'}
                      </button>
                    </div>
                  );
                })}

                {/* ChatGPT row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '4px',
                  }}
                  data-testid="chatgpt-connection"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>ChatGPT</span>
                    <span
                      className="mono"
                      style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}
                    >
                      Plus / Pro
                    </span>
                    {activeChatGPT && (
                      <span className="badge badge-success" style={{ fontSize: '0.66rem' }}>
                        {activeChatGPT.email}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ padding: '3px 9px', fontSize: '0.74rem' }}
                    data-testid="chatgpt-login"
                    onClick={() => {
                      setChatgptError(null);
                      setChatgptDialogOpen(true);
                    }}
                  >
                    {activeChatGPT ? 'Manage…' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>

            {/* Model API Keys Table (from keys-section.tsx) */}
            <div>
              <div
                className="mono"
                style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                Model API keys
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '4px',
                  background: 'var(--bg-elevated)',
                }}
              >
                {visibleProviderRows.map((row) => {
                  const st = getEffectiveKeyStatus(row.envVar);
                  const isExpanded = openKeyRow === row.envVar;

                  if (isExpanded) {
                    return (
                      <div
                        key={row.envVar}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 6px',
                        }}
                      >
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
                          {row.label}
                        </span>
                        <input
                          type="text"
                          className="input mono"
                          value={keyDraft}
                          onChange={(e) => setKeyDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveProviderKey(row.envVar, keyDraft);
                            if (e.key === 'Escape') {
                              setOpenKeyRow(null);
                              setKeyDraft('');
                            }
                          }}
                          placeholder="Paste key…"
                          autoFocus
                          style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveProviderKey(row.envVar, keyDraft)}
                          disabled={!keyDraft.trim()}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenKeyRow(null);
                            setKeyDraft('');
                            setKeyError(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        {st.present && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteProviderKey(row.envVar)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={row.envVar}
                      onClick={() => {
                        setOpenKeyRow(row.envVar);
                        setKeyDraft('');
                        setKeyError(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span>{row.label}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {row.docsUrl && (
                          <a
                            href={row.docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              textDecoration: 'none',
                            }}
                          >
                            key ↗
                          </a>
                        )}
                        <span
                          className="mono"
                          style={{
                            fontSize: '0.73rem',
                            color: st.present ? 'var(--success)' : 'var(--text-muted)',
                          }}
                        >
                          {st.present && st.masked ? st.masked : 'not set'}
                        </span>
                      </span>
                    </div>
                  );
                })}

                {addingProvider && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 6px',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
                      {addingProvider.label}
                    </span>
                    <input
                      type="text"
                      className="input mono"
                      value={keyDraft}
                      onChange={(e) => setKeyDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && keyDraft.trim()) {
                          void handleSaveProviderKey(addingProvider.envVar, keyDraft);
                        }
                      }}
                      placeholder="Paste key…"
                      autoFocus
                      style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveProviderKey(addingProvider.envVar, keyDraft)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingProvider(null);
                        setKeyDraft('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* + Add a provider row (from keys-section.tsx AddProviderRow) */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddProviderMenu((v) => !v)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 8px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>+ Add a provider</span>
                    <span className="mono" style={{ fontSize: '0.7rem' }}>
                      {AUTH_PROVIDER_KEYS.length}
                    </span>
                  </button>

                  {showAddProviderMenu && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '8px',
                        padding: '6px',
                        boxShadow: 'var(--shadow-card)',
                        maxHeight: '190px',
                        overflowY: 'auto',
                      }}
                    >
                      <input
                        className="input"
                        placeholder="Filter providers…"
                        value={providerFilter}
                        onChange={(e) => setProviderFilter(e.target.value)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          marginBottom: '4px',
                        }}
                      />
                      {addableProviders.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setAddingProvider(p);
                            setShowAddProviderMenu(false);
                            setProviderFilter('');
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '4px 8px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            borderRadius: '4px',
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {keyError && (
                <div style={{ fontSize: '0.74rem', color: 'var(--danger)', marginTop: '4px' }}>
                  {keyError}
                </div>
              )}
            </div>

            {/* External CLI (from claude-code-status.tsx) */}
            <div>
              <div
                className="mono"
                style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                External CLI
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Claude Code</span>
                  <input
                    type="checkbox"
                    checked={claudeCodeEnabled}
                    onChange={(e) => {
                      setClaudeCodeEnabled(e.target.checked);
                      if (e.target.checked) void handleCheckClaudeCode();
                    }}
                  />
                </div>
                {claudeCodeEnabled ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {claudeCodeLabel}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      onClick={() => void handleCheckClaudeCode()}
                    >
                      Check again
                    </button>
                  </div>
                ) : (
                  <a
                    href="https://code.claude.com/docs/en/setup"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
                  >
                    Setup ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LearnHarness ChatGPT Account Dialog (borrowed directly from components/settings/chatgpt-connection.tsx) */}
      {chatgptDialogOpen && (
        <div
          data-testid="chatgpt-dialog-backdrop"
          onClick={() => !chatgptBusy && setChatgptDialogOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(6, 9, 17, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ChatGPT account"
            data-testid="chatgpt-account-dialog"
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600 }}>ChatGPT</h2>

            <p
              data-testid="chatgpt-privacy-notice"
              style={{
                fontSize: '0.78rem',
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
              }}
            >
              {CHATGPT_NOTICE}
            </p>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={chatgptStatus.allowBackgroundUse}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setChatgptStatus((prev) => ({
                    ...prev,
                    allowBackgroundUse: enabled,
                  }));
                  if (serverBaseUrl !== null) {
                    void fetch(`${serverBaseUrl}/api/subscriptions`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-learnharness-subscriptions': '1',
                      },
                      body: JSON.stringify({
                        providerId: 'chatgpt',
                        op: 'consent',
                        enabled,
                      }),
                    });
                  }
                }}
                style={{ marginTop: '3px' }}
              />
              <span>
                {BACKGROUND_LABEL}
                <span
                  style={{
                    display: 'block',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                  }}
                >
                  {CHATGPT_BACKGROUND_HINT}
                </span>
              </span>
            </label>

            <div style={{ display: 'flex', gap: '12px', fontSize: '0.76rem' }}>
              <a
                href="https://openai.com/policies/privacy-policy/"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
              >
                OpenAI privacy
              </a>
              <a
                href="https://chatgpt.com/settings/usage"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
              >
                Manage usage
              </a>
            </div>

            {chatgptStatus.pending && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '10px',
                  borderRadius: '6px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <p role="status" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Waiting for browser sign-in… (If on static GitHub Pages without the local server, paste the redirected <code>127.0.0.1:1455/auth/callback?code=...</code> URL below:)
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    className="input mono"
                    value={callbackPasteValue}
                    onChange={(e) => setCallbackPasteValue(e.target.value)}
                    placeholder="http://127.0.0.1:1455/auth/callback?code=..."
                    style={{ fontSize: '0.74rem', padding: '5px 8px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleCompleteStaticCallback}
                  >
                    Finish
                  </button>
                </div>
              </div>
            )}

            {(chatgptError || chatgptStatus.error) && (
              <p role="alert" style={{ fontSize: '0.76rem', color: 'var(--danger)' }}>
                {chatgptError || chatgptStatus.error}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '8px',
                marginTop: '6px',
              }}
            >
              {activeChatGPT && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ color: 'var(--danger)', marginRight: 'auto' }}
                  onClick={() => {
                    if (serverBaseUrl !== null && activeChatGPT.id) {
                      void fetch(`${serverBaseUrl}/api/subscriptions`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-learnharness-subscriptions': '1',
                        },
                        body: JSON.stringify({
                          providerId: 'chatgpt',
                          op: 'logout',
                          id: activeChatGPT.id,
                        }),
                      });
                    }
                    setChatgptStatus((prev) => ({
                      ...prev,
                      activeId: null,
                      accounts: [],
                    }));
                  }}
                >
                  Disconnect
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  if (serverBaseUrl !== null && chatgptStatus.pending) {
                    void fetch(`${serverBaseUrl}/api/subscriptions`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-learnharness-subscriptions': '1',
                      },
                      body: JSON.stringify({
                        providerId: 'chatgpt',
                        op: 'cancel',
                      }),
                    });
                  }
                  setChatgptStatus((prev) => ({ ...prev, pending: false, error: null }));
                  setChatgptDialogOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                data-testid="chatgpt-proceed"
                disabled={chatgptBusy}
                onClick={() => void handleContinueWithChatGPT()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 21 21"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M11.8102 19.1625C11.2327 19.1625 10.6841 19.0528 10.1643 18.8334C9.64459 18.6139 9.18259 18.3078 8.77834 17.9151C8.33944 18.0653 7.88322 18.1404 7.40967 18.1404C6.63582 18.1404 5.91972 17.9498 5.26137 17.5686C4.60302 17.1875 4.07172 16.6677 3.66747 16.0094C3.27477 15.351 3.07842 14.6176 3.07842 13.8091C3.07842 13.4742 3.12462 13.1103 3.21702 12.7176C2.75502 12.2903 2.39697 11.7994 2.14287 11.245C1.88877 10.679 1.76172 10.09 1.76172 9.47785C1.76172 8.85415 1.89454 8.25355 2.16019 7.67605C2.42584 7.09855 2.79544 6.6019 3.26899 6.1861C3.75409 5.75875 4.31427 5.46422 4.94952 5.30252C5.07657 4.64417 5.34222 4.05512 5.74647 3.53537C6.16227 3.00407 6.67047 2.58827 7.27107 2.28797C7.87167 1.98767 8.51269 1.83752 9.19414 1.83752C9.77164 1.83752 10.3203 1.94725 10.84 2.1667C11.3598 2.38615 11.8218 2.69222 12.226 3.08492C12.6649 2.93477 13.1211 2.8597 13.5947 2.8597C14.3685 2.8597 15.0846 3.05027 15.743 3.43142C16.4013 3.81257 16.9269 4.33232 17.3196 4.99067C17.7238 5.64902 17.9259 6.38245 17.9259 7.19095C17.9259 7.5259 17.8797 7.88973 17.7873 8.28242C18.2493 8.70977 18.6074 9.20643 18.8615 9.77238C19.1156 10.3268 19.2426 10.91 19.2426 11.5222C19.2426 12.1459 19.1098 12.7465 18.8442 13.324C18.5785 13.9015 18.2031 14.4039 17.718 14.8313C17.2445 15.2471 16.6901 15.5358 16.0548 15.6975C15.9278 16.3559 15.6564 16.9449 15.2406 17.4647C14.8363 17.996 14.3339 18.4118 13.7333 18.7121C13.1327 19.0124 12.4917 19.1625 11.8102 19.1625ZM7.53094 16.9969C8.10844 16.9969 8.61087 16.8756 9.03822 16.6331L12.2953 14.762C12.4108 14.6811 12.4686 14.5714 12.4686 14.4328V12.9429L8.27592 15.351C8.02182 15.5012 7.76772 15.5012 7.51362 15.351L4.23919 13.4626C4.23919 13.4973 4.23342 13.5377 4.22187 13.5839C4.22187 13.6301 4.22187 13.6994 4.22187 13.7918C4.22187 14.3808 4.36047 14.9237 4.63767 15.4203C4.92642 15.9054 5.32489 16.2866 5.83309 16.5638C6.34129 16.8525 6.90724 16.9969 7.53094 16.9969ZM7.70419 14.1729C7.77349 14.2076 7.83702 14.2249 7.89477 14.2249C7.95252 14.2249 8.01027 14.2076 8.06802 14.1729L9.36739 13.4279L5.19207 11.0024C4.93797 10.8523 4.81092 10.6271 4.81092 10.3268V6.56725C4.23342 6.82135 3.77142 7.21405 3.42492 7.74535C3.07842 8.2651 2.90517 8.8426 2.90517 9.47785C2.90517 10.0438 3.04954 10.5866 3.33829 11.1064C3.62704 11.6261 4.00242 12.0189 4.46442 12.2845L7.70419 14.1729ZM11.8102 18.0191C12.4224 18.0191 12.9768 17.8805 13.4734 17.6033C13.9701 17.3261 14.3628 16.9449 14.6515 16.4598C14.9403 15.9747 15.0846 15.4319 15.0846 14.8313V11.0891C15.0846 10.9505 15.0269 10.8465 14.9114 10.7772L13.5947 10.0149V14.8486C13.5947 15.1489 13.4676 15.3741 13.2135 15.5243L9.93912 17.4127C10.5051 17.817 11.1288 18.0191 11.8102 18.0191ZM12.4686 11.6781V9.32192L10.5108 8.21312L8.53579 9.32192V11.6781L10.5108 12.7869L12.4686 11.6781ZM7.40967 6.15145C7.40967 5.85115 7.53672 5.62592 7.79082 5.47577L11.0652 3.58735C10.4993 3.1831 9.87559 2.98097 9.19414 2.98097C8.58199 2.98097 8.02759 3.11957 7.53094 3.39677C7.03429 3.67397 6.64159 4.05512 6.35284 4.54022C6.07564 5.02532 5.93704 5.56817 5.93704 6.16878V9.89365C5.93704 10.0323 5.99479 10.142 6.11029 10.2228L7.40967 10.9851V6.15145ZM16.2108 14.4328C16.7883 14.1787 17.2445 13.786 17.5794 13.2547C17.9259 12.7234 18.0992 12.1459 18.0992 11.5222C18.0992 10.9562 17.9548 10.4134 17.6661 9.89365C17.3773 9.3739 17.0019 8.9812 16.5399 8.71555L13.3002 6.84445C13.2309 6.79825 13.1673 6.78092 13.1096 6.79248C13.0518 6.79248 12.9941 6.8098 12.9363 6.84445L11.637 7.5721L15.8296 10.0149C15.9567 10.0842 16.0491 10.1766 16.1068 10.2921C16.1761 10.3961 16.2108 10.5231 16.2108 10.6733V14.4328ZM12.7284 5.6317C12.9825 5.47 13.2366 5.47 13.4907 5.6317L16.7825 7.55477C16.7825 7.47393 16.7825 7.36997 16.7825 7.24292C16.7825 6.68852 16.6439 6.163 16.3667 5.66635C16.101 5.15815 15.7141 4.7539 15.2059 4.4536C14.7093 4.1533 14.1318 4.00315 13.4734 4.00315C12.8959 4.00315 12.3935 4.12442 11.9661 4.36697L8.70904 6.23808C8.59354 6.31892 8.53579 6.42865 8.53579 6.56725V8.0572L12.7284 5.6317Z"
                    fill="currentColor"
                  />
                </svg>
                Continue with ChatGPT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LearnHarness Native Subscription Dialog (borrowed directly from components/settings/subscription-connections.tsx: Grok, Anthropic, GitHub Copilot) */}
      {nativeDialog && (() => {
        const descriptor = NATIVE_SUBSCRIPTIONS.find((p) => p.providerId === nativeDialog);
        const status =
          nativeStatuses.find((s) => s.providerId === nativeDialog) ??
          emptySubscriptionStatus(nativeDialog);
        if (!descriptor) return null;
        const interaction = status.interaction;
        const prompt = interaction?.prompt;

        return (
          <div
            data-testid="subscription-dialog-backdrop"
            onClick={() => !nativeBusy && setNativeDialog(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9000,
              background: 'rgba(6, 9, 17, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${descriptor.label} connection`}
              data-testid="subscription-connection-dialog"
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{
                width: '100%',
                maxWidth: '480px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                  {descriptor.label}{' '}
                  <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    ({descriptor.sublabel})
                  </span>
                </h2>
                {status.connected && (
                  <span className="badge badge-success">Connected</span>
                )}
              </div>

              <p
                data-testid="subscription-privacy-notice"
                style={{
                  fontSize: '0.78rem',
                  lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                }}
              >
                {subscriptionNotice(descriptor.label)}
              </p>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={status.allowBackgroundUse}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setNativeStatuses((prev) =>
                      prev.map((s) =>
                        s.providerId === nativeDialog ? { ...s, allowBackgroundUse: enabled } : s
                      )
                    );
                    if (serverBaseUrl !== null) {
                      void fetch(`${serverBaseUrl}/api/subscriptions`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-learnharness-subscriptions': '1',
                        },
                        body: JSON.stringify({
                          providerId: nativeDialog,
                          op: 'consent',
                          enabled,
                        }),
                      });
                    }
                  }}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Allow background use
                  <span
                    style={{
                      display: 'block',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                    }}
                  >
                    {SUBSCRIPTION_BACKGROUND_HINT}
                  </span>
                </span>
              </label>

              {interaction && (
                <div
                  data-testid="subscription-login-interaction"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: '6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.78rem',
                  }}
                >
                  {interaction.progress && (
                    <p role="status" style={{ color: 'var(--text-secondary)' }}>
                      {interaction.progress}
                    </p>
                  )}

                  {interaction.userCode && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-strong)',
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>Device code:</span>
                      <code
                        className="mono"
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: 'var(--accent-primary)',
                          userSelect: 'all',
                        }}
                      >
                        {interaction.userCode}
                      </code>
                    </div>
                  )}

                  {interaction.browser?.fullUrl && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <a
                        href={interaction.browser.fullUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm"
                      >
                        Open browser ↗
                      </a>
                      {nativeDialog === 'xai' && (
                        <a
                          href="https://console.x.ai"
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm"
                        >
                          xAI Console ↗
                        </a>
                      )}
                    </div>
                  )}

                  {prompt && (
                    <form
                      onSubmit={(e) => void handleSubmitNativePrompt(nativeDialog, e)}
                      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      <label htmlFor="subscription-auth-prompt" style={{ fontWeight: 500 }}>
                        {prompt.message}
                      </label>
                      {prompt.type === 'select' ? (
                        <select
                          id="subscription-auth-prompt"
                          className="input"
                          value={nativePromptValue}
                          onChange={(e) => setNativePromptValue(e.target.value)}
                          style={{ fontSize: '0.76rem', padding: '5px 8px' }}
                        >
                          <option value="" disabled>
                            Select…
                          </option>
                          {prompt.options?.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            id="subscription-auth-prompt"
                            className="input mono"
                            type={prompt.type === 'secret' ? 'password' : 'text'}
                            autoComplete="off"
                            value={nativePromptValue}
                            placeholder={prompt.placeholder}
                            onChange={(e) => setNativePromptValue(e.target.value)}
                            style={{ fontSize: '0.75rem', padding: '5px 8px' }}
                          />
                          <button
                            type="submit"
                            className="btn btn-sm btn-primary"
                            disabled={nativeBusy || !nativePromptValue.trim()}
                          >
                            Continue
                          </button>
                        </div>
                      )}
                      {prompt.type === 'select' && (
                        <button
                          type="submit"
                          className="btn btn-sm btn-primary"
                          disabled={nativeBusy || !nativePromptValue}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          Continue
                        </button>
                      )}
                    </form>
                  )}
                </div>
              )}

              {(nativeError || status.error) && (
                <p role="alert" style={{ fontSize: '0.76rem', color: 'var(--danger)' }}>
                  {nativeError || status.error}
                </p>
              )}

              <div
                data-testid="subscription-connection-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '6px',
                }}
              >
                {(status.connected || status.connectionId) && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ color: 'var(--danger)', marginRight: 'auto' }}
                    onClick={() => {
                      if (serverBaseUrl !== null) {
                        void fetch(`${serverBaseUrl}/api/subscriptions`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'x-learnharness-subscriptions': '1',
                          },
                          body: JSON.stringify({
                            providerId: nativeDialog,
                            op: 'disconnect',
                          }),
                        });
                      }
                      setNativeStatuses((prev) =>
                        prev.map((s) =>
                          s.providerId === nativeDialog ? emptySubscriptionStatus(nativeDialog) : s
                        )
                      );
                    }}
                  >
                    Disconnect
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    if (serverBaseUrl !== null && status.pending) {
                      void fetch(`${serverBaseUrl}/api/subscriptions`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-learnharness-subscriptions': '1',
                        },
                        body: JSON.stringify({
                          providerId: nativeDialog,
                          op: 'cancel',
                        }),
                      });
                    }
                    setNativeStatuses((prev) =>
                      prev.map((s) =>
                        s.providerId === nativeDialog
                          ? { ...s, pending: false, interaction: undefined, error: undefined }
                          : s
                      )
                    );
                    setNativeDialog(null);
                  }}
                >
                  {status.connected ? 'Close' : 'Cancel'}
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={nativeBusy}
                  onClick={() => void handleStartNativeSubscription(nativeDialog)}
                >
                  {nativeDialog === 'xai'
                    ? 'Sign in with SuperGrok or X Premium'
                    : nativeDialog === 'anthropic'
                    ? 'Sign in with Claude Pro / Max'
                    : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
