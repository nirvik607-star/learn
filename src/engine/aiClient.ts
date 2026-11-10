import type { FailureCategory, PropositionNode, CoursePack } from '../types/harness';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ActiveAIProvider {
  id: 'xai' | 'openai' | 'anthropic' | 'openrouter' | 'google' | 'bridge';
  name: string;
  token?: string;
  endpoint?: string;
  model?: string;
}

let bridgeReady = false;
let bridgeProviderName = '';

export function getActiveAIProvider(): ActiveAIProvider | null {
  try {
    // 1. Direct xAI key (Grok / SuperGrok)
    const directXai = (localStorage.getItem('lh_xai_key') || '').trim();
    if (directXai.length > 8) {
      return {
        id: 'xai',
        name: 'Grok (xAI)',
        token: directXai,
        endpoint: 'https://api.x.ai/v1/chat/completions',
        model: 'grok-beta',
      };
    }

    // 2. Parsed lh_auth_keys_v1 catalog
    const authKeysRaw = localStorage.getItem('lh_auth_keys_v1');
    if (authKeysRaw) {
      try {
        const keys = JSON.parse(authKeysRaw) as Record<string, string>;
        if (keys.XAI_API_KEY && keys.XAI_API_KEY.trim().length > 8) {
          return {
            id: 'xai',
            name: 'Grok (xAI)',
            token: keys.XAI_API_KEY.trim(),
            endpoint: 'https://api.x.ai/v1/chat/completions',
            model: 'grok-beta',
          };
        }
        if (keys.OPENAI_API_KEY && keys.OPENAI_API_KEY.trim().length > 8) {
          return {
            id: 'openai',
            name: 'ChatGPT (OpenAI)',
            token: keys.OPENAI_API_KEY.trim(),
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-4o-mini',
          };
        }
        if (keys.OPENROUTER_API_KEY && keys.OPENROUTER_API_KEY.trim().length > 8) {
          return {
            id: 'openrouter',
            name: 'OpenRouter',
            token: keys.OPENROUTER_API_KEY.trim(),
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'openai/gpt-4o-mini',
          };
        }
        if (keys.ANTHROPIC_API_KEY && keys.ANTHROPIC_API_KEY.trim().length > 8) {
          return {
            id: 'anthropic',
            name: 'Claude (Anthropic)',
            token: keys.ANTHROPIC_API_KEY.trim(),
          };
        }
      } catch {
        // ignore
      }
    }

    // 3. OpenAI account token (OAuth or sk-...)
    const rawOai = (localStorage.getItem('lh_openai_account_token') || '').trim();
    let oaiToken = rawOai;
    if (rawOai.startsWith('{')) {
      try {
        const p = JSON.parse(rawOai);
        oaiToken = p.access_token || p.token || p.OPENAI_API_KEY || '';
      } catch {
        oaiToken = '';
      }
    }
    if (oaiToken.length > 8) {
      return {
        id: 'openai',
        name: 'ChatGPT (OpenAI)',
        token: oaiToken,
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini',
      };
    }

    // 4. Anthropic direct key
    const directAnthropic = (localStorage.getItem('lh_anthropic_key') || '').trim();
    if (directAnthropic.length > 8) {
      return {
        id: 'anthropic',
        name: 'Claude (Anthropic)',
        token: directAnthropic,
      };
    }

    // 5. Native subscriptions check
    const subsRaw = localStorage.getItem('lh_native_subscriptions_v1');
    if (subsRaw) {
      try {
        const subs = JSON.parse(subsRaw);
        if (Array.isArray(subs)) {
          const grokSub = subs.find(
            (s: { providerId: string; state: string }) =>
              s.providerId === 'xai' && s.state === 'connected'
          );
          if (grokSub) {
            return {
              id: 'xai',
              name: 'SuperGrok (Subscription)',
              model: 'grok-beta',
            };
          }
        }
      } catch {
        // ignore
      }
    }

    // 6. Local Mac CLI Bridge
    if (bridgeReady) {
      return {
        id: 'bridge',
        name: bridgeProviderName || 'Local CLI Bridge (Codex / Claude)',
      };
    }
  } catch {
    // ignore
  }

  return null;
}

export function getAIToken(): string {
  const active = getActiveAIProvider();
  return active?.token || '';
}

/** Probes the local bridge once; called on app start. */
export async function detectBridge(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai/status', { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const s = await res.json();
      bridgeReady =
        Boolean(
          s.codexCliAvailable ||
            s.claudeCliAvailable ||
            s.chatgptOAuthConnected ||
            s.openaiKeyConfigured ||
            s.anthropicKeyConfigured ||
            s.activeProvider === 'xai'
        ) && !('standalone' in s);
      if (s.codexCliAvailable) bridgeProviderName = 'Codex CLI';
      else if (s.claudeCliAvailable) bridgeProviderName = 'Claude Code CLI';
      else if (s.chatgptOAuthConnected) bridgeProviderName = 'ChatGPT OAuth';
      else if (s.activeProvider === 'xai') bridgeProviderName = 'Grok (xAI)';
    }
  } catch {
    bridgeReady = false;
  }
  notifyAIStatusChanged();
  return bridgeReady;
}

export function isAIConnected(): boolean {
  return getActiveAIProvider() !== null;
}

/** Fires when any stored key changes so every AI surface re-renders its lock state in real-time. */
export function notifyAIStatusChanged() {
  window.dispatchEvent(new Event('lh-ai-status'));
}

/**
 * Universal multi-provider AI chat dispatcher.
 * Routes to:
 * 1. xAI Grok (direct API call with 'grok-beta' / 'grok-2-latest')
 * 2. OpenAI ChatGPT ('gpt-4o-mini')
 * 3. OpenRouter
 * 4. Local Mac Bridge (/api/ai/chat for Codex CLI / Claude CLI / Anthropic)
 * Returns null if all fail so caller uses 0-token local doctrine engine.
 */
export async function aiChat(
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<string | null> {
  const active = getActiveAIProvider();

  // 1. xAI / Grok Direct Call
  if (active?.id === 'xai' && active.token) {
    try {
      const body = {
        model: active.model || 'grok-beta',
        messages,
        max_tokens: opts.maxTokens ?? 420,
        temperature: opts.temperature ?? 0.35,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      };
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${active.token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch {
      // Fall through to bridge if browser CORS or proxy issues occur
    }
  }

  // 2. OpenAI Direct Call
  if (active?.id === 'openai' && active.token) {
    try {
      const body = {
        model: active.model || 'gpt-4o-mini',
        messages,
        max_tokens: opts.maxTokens ?? 400,
        temperature: opts.temperature ?? 0.4,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      };
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${active.token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch {
      // Fall through to bridge
    }
  }

  // 3. OpenRouter Direct Call
  if (active?.id === 'openrouter' && active.token) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${active.token}`,
        },
        body: JSON.stringify({
          model: active.model || 'openai/gpt-4o-mini',
          messages,
          max_tokens: opts.maxTokens ?? 400,
          temperature: opts.temperature ?? 0.4,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch {
      // Fall through to bridge
    }
  }

  // 4. Local Bridge (/api/ai/chat) — handles Codex CLI, Claude CLI, Anthropic, or server-side xAI
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        max_tokens: opts.maxTokens ?? 400,
        temperature: opts.temperature ?? 0.4,
        json: opts.json,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (res.ok) {
      const data = await res.json();
      const text = (data.reply || data.message || data.choices?.[0]?.message?.content || '').trim();
      if (text) return text;
    }
  } catch {
    // No bridge
  }

  return null;
}

function parseJSON<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : text) as T;
  } catch {
    return null;
  }
}

function nodeContext(node: PropositionNode): string {
  return [
    `Concept: ${node.title}`,
    `Ground truth: ${node.statement}`,
    node.teachingStep.keyFormulaOrRule ? `Key rule: ${node.teachingStep.keyFormulaOrRule}` : '',
    `Motivating problem: ${node.motivatedHook}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const PEDAGOGY = `You follow the LearnHarness doctrine:
- Move ONE reasoning step at a time: predict -> teach -> check. Never lecture across multiple steps.
- Never spoil what the learner can generate. Use the minimal hint rung (R0 attention redirect, R1 pattern, R2 candidate cluster, R3 named proposition, R4 move outline, R5 worked step).
- Motivate every rule with "how could I have discovered this?".
- Be concise: at most 90 words per turn. End with exactly one question for the learner.`;

/** Multi-turn Socratic tutor anchored to a node. */
export async function socraticTurn(
  node: PropositionNode,
  history: ChatMessage[],
  persona: 'socratic' | 'strict_examiner' = 'socratic',
  extraContext = ''
): Promise<string | null> {
  const role =
    persona === 'strict_examiner'
      ? 'You are a strict exam examiner. Expose vague hand-waving and demand the exact causal chain.'
      : 'You are a warm but rigorous Socratic tutor.';
  return aiChat(
    [
      {
        role: 'system',
        content: `${role}\n${PEDAGOGY}\n\n${nodeContext(node)}${
          extraContext ? `\n\nCurrent context:\n${extraContext}` : ''
        }`,
      },
      ...history,
    ],
    { maxTokens: 260 }
  );
}

export interface AIGradeResult {
  correct: boolean;
  score: number; // 0-100
  movesHit: string[];
  movesMissed: string[];
  trapsTriggered: string[];
  failureCategory?: FailureCategory;
  feedback: string;
  nextHint?: string;
}

/** Grades a free-response / Feynman answer against the frozen rubric. */
export async function gradeWithRubric(
  node: PropositionNode,
  question: string,
  answer: string,
  mode: 'cued_recall' | 'application' | 'probe'
): Promise<AIGradeResult | null> {
  const app = node.quizletStages.application;
  const rubric =
    mode === 'cued_recall'
      ? `Canonical answer: ${node.quizletStages.cuedRecall.canonicalAnswer}\nAccepted keywords: ${node.quizletStages.cuedRecall.acceptedKeywords.join(', ')}`
      : `Required moves:\n${app.requiredMoves.map((m) => `- ${m.label}`).join('\n')}\nCommon traps:\n${app.commonTraps.map((t) => `- ${t}`).join('\n')}\nModel solution: ${app.modelSolution}`;
  const text = await aiChat(
    [
      {
        role: 'system',
        content: `You are a frozen-rubric exam grader. Grade semantically (synonyms and paraphrases count), but be strict about causal correctness.
Return JSON only: {"correct":bool,"score":0-100,"movesHit":[labels],"movesMissed":[labels],"trapsTriggered":[strings],"failureCategory":"cue_miss"|"discrimination_error"|"execution_slip"|"careless"|"structural_misconception"|null,"feedback":"<=60 words, name what was right and the single most important gap","nextHint":"one minimal hint (lowest useful rung) that does NOT reveal the answer"}
failureCategory: cue_miss = could not retrieve; discrimination_error = confused with a near-twin concept; execution_slip = right principle, wrong step; careless = misread; structural_misconception = inverted or wrong causal model.`,
      },
      {
        role: 'user',
        content: `${nodeContext(node)}\n\nRubric:\n${rubric}\n\nQuestion: ${question}\nLearner answer: ${answer}`,
      },
    ],
    { json: true, maxTokens: 380, temperature: 0.1 }
  );
  const parsed = parseJSON<AIGradeResult>(text);
  if (!parsed) return null;
  return {
    correct: Boolean(parsed.correct),
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    movesHit: parsed.movesHit || [],
    movesMissed: parsed.movesMissed || [],
    trapsTriggered: parsed.trapsTriggered || [],
    failureCategory: parsed.failureCategory || undefined,
    feedback: parsed.feedback || '',
    nextHint: parsed.nextHint,
  };
}

/** Writes the next hint rung adaptively from the learner's actual wrong attempt. */
export async function adaptiveHint(
  node: PropositionNode,
  question: string,
  attempt: string,
  rung: number
): Promise<string | null> {
  const rungDefs = [
    'R0 attention redirect: point at the part of the question to re-read',
    'R1 pattern re-description: name the pattern class',
    'R2 candidate cluster: narrow to 2-3 candidate ideas',
    'R3 named proposition: name the rule to apply',
    'R4 move outline: outline the steps without executing them',
    'R5 worked step: work the first critical step',
  ];
  return aiChat(
    [
      {
        role: 'system',
        content: `Write exactly one hint at rung ${
          rungDefs[Math.min(5, Math.max(0, rung))]
        }. Target the specific gap in the learner's attempt. Do not go beyond this rung. At most 40 words. No preamble.`,
      },
      {
        role: 'user',
        content: `${nodeContext(node)}\nQuestion: ${question}\nLearner's attempt so far: ${
          attempt || '(blank)'
        }`,
      },
    ],
    { maxTokens: 120, temperature: 0.3 }
  );
}

export interface VariantQuestion {
  question: string;
  answer: string;
}

/** Generates a fresh-surface retest variant for a logged mistake. */
export async function generateVariant(
  node: PropositionNode,
  originalQuestion: string,
  wrongAnswer: string,
  failureCategory: FailureCategory
): Promise<VariantQuestion | null> {
  const text = await aiChat(
    [
      {
        role: 'system',
        content: `Write ONE new exam question that tests the same proposition in a fresh surface (new scenario and wording) and specifically targets this failure type: ${failureCategory}. Return JSON only: {"question":"...","answer":"concise model answer"}`,
      },
      {
        role: 'user',
        content: `${nodeContext(node)}\nOriginal question: ${originalQuestion}\nLearner's wrong answer: ${wrongAnswer}`,
      },
    ],
    { json: true, maxTokens: 300, temperature: 0.7 }
  );
  return parseJSON<VariantQuestion>(text);
}

/** Compiles raw notes into a full CoursePack JSON directly in-app. */
export async function compileCourseWithAI(
  rawNotes: string,
  code: string,
  examTitle: string,
  schemaPrompt: string
): Promise<CoursePack | null> {
  const text = await aiChat(
    [
      {
        role: 'system',
        content: `You compile study material into a LearnHarness course pack. ${schemaPrompt}\nReturn JSON only.`,
      },
      {
        role: 'user',
        content: `Course: ${code}\nExam: ${examTitle}\n\nMaterial:\n${rawNotes.slice(0, 24000)}`,
      },
    ],
    { json: true, maxTokens: 6000, temperature: 0.3 }
  );
  const parsed = parseJSON<CoursePack>(text);
  if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) return null;
  return parsed;
}
