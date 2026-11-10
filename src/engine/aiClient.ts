import type { FailureCategory, PropositionNode, CoursePack } from '../types/harness';
import { hydrateCoursePack, type DistilledCourseInput } from './courseCompiler';

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
        model: 'grok-2-latest',
      };
    }

    // 2. Direct OpenAI key
    const directOpenAI = (localStorage.getItem('lh_openai_key') || '').trim();
    if (directOpenAI.length > 8) {
      return {
        id: 'openai',
        name: 'ChatGPT (OpenAI)',
        token: directOpenAI,
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini',
      };
    }

    // 3. Direct Anthropic key
    const directAnthropic = (localStorage.getItem('lh_anthropic_key') || '').trim();
    if (directAnthropic.length > 8) {
      return {
        id: 'anthropic',
        name: 'Claude (Anthropic)',
        token: directAnthropic,
        model: 'claude-3-5-haiku-20241022',
      };
    }

    // 4. Parsed lh_auth_keys_v1 catalog
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
            model: 'grok-2-latest',
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
        if (keys.ANTHROPIC_API_KEY && keys.ANTHROPIC_API_KEY.trim().length > 8) {
          return {
            id: 'anthropic',
            name: 'Claude (Anthropic)',
            token: keys.ANTHROPIC_API_KEY.trim(),
            model: 'claude-3-5-haiku-20241022',
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
        if (keys.GEMINI_API_KEY && keys.GEMINI_API_KEY.trim().length > 8) {
          return {
            id: 'google',
            name: 'Google Gemini',
            token: keys.GEMINI_API_KEY.trim(),
            model: 'gemini-1.5-flash',
          };
        }
      } catch {
        // ignore
      }
    }

    // 5. OpenAI account token (OAuth or sk-...)
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

    // 6. Native subscriptions check
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
              model: 'grok-2-latest',
            };
          }
          const claudeSub = subs.find(
            (s: { providerId: string; state: string }) =>
              s.providerId === 'anthropic' && s.state === 'connected'
          );
          if (claudeSub) {
            return {
              id: 'anthropic',
              name: 'Claude Pro/Max (Subscription)',
              model: 'claude-3-5-haiku-20241022',
            };
          }
        }
      } catch {
        // ignore
      }
    }

    // 7. Local Mac CLI Bridge
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
export async function probeLocalBridge(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai/bridge/status', { signal: AbortSignal.timeout(1200) });
    if (res.ok) {
      const data = await res.json();
      bridgeReady = Boolean(data.available || data.connected);
      bridgeProviderName =
        data.providerName || (data.codexCli ? 'Codex CLI' : data.claudeCli ? 'Claude CLI' : 'AI Bridge');
    } else {
      bridgeReady = false;
    }
  } catch {
    bridgeReady = false;
  }
  notifyAIStatusChanged();
  return bridgeReady;
}

export const detectBridge = probeLocalBridge;

export function isAIConnected(): boolean {
  return getActiveAIProvider() !== null;
}

/** Fires when any stored key changes so every AI surface re-renders its lock state in real-time. */
export function notifyAIStatusChanged() {
  window.dispatchEvent(new Event('lh-ai-status'));
}

export interface AITestResult {
  ok: boolean;
  provider: string;
  model?: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Tests live connection to the active AI provider with a lightweight ping.
 * Returns latency in milliseconds, model name, or diagnostic error details.
 */
export async function testAIConnection(): Promise<AITestResult> {
  const active = getActiveAIProvider();
  if (!active) {
    return {
      ok: false,
      provider: 'None',
      error: 'No AI provider connected. Please enter an API key in Setup.',
    };
  }

  const startTime = performance.now();
  try {
    const reply = await aiChat(
      [
        { role: 'system', content: 'You are an API connection verifier. Respond strictly with "CONNECTED".' },
        { role: 'user', content: 'Ping' },
      ],
      { maxTokens: 15, temperature: 0.1 }
    );

    const latencyMs = Math.round(performance.now() - startTime);
    if (reply && reply.length > 0) {
      return {
        ok: true,
        provider: active.name,
        model: active.model || 'active',
        latencyMs,
      };
    }
    return {
      ok: false,
      provider: active.name,
      error: 'No response received from model endpoint.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      provider: active.name,
      error: errorMsg,
    };
  }
}

/**
 * Universal multi-provider AI chat dispatcher.
 * Routes directly to:
 * 1. xAI Grok (direct API call)
 * 2. OpenAI ChatGPT ('gpt-4o-mini')
 * 3. Anthropic Claude (direct Messages API with browser access)
 * 4. OpenRouter
 * 5. Google Gemini
 * 6. Local Mac Bridge (/api/ai/chat for Codex CLI / Claude CLI)
 */
export async function aiChat(
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<string | null> {
  const active = getActiveAIProvider();
  if (!active) return null;

  // 1. xAI / Grok Direct Call
  if (active.id === 'xai' && active.token) {
    const model = active.model || 'grok-2-latest';
    // Append JSON instruction directly to prompt rather than forcing strict schema
    const formattedMessages = opts.json
      ? [
          ...messages.slice(0, -1),
          {
            ...messages[messages.length - 1],
            content: `${messages[messages.length - 1].content}\n\nIMPORTANT: Return valid JSON only without markdown or code fences.`,
          },
        ]
      : messages;

    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${active.token}`,
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          max_tokens: opts.maxTokens ?? 1500,
          temperature: opts.temperature ?? 0.35,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`xAI Grok (${res.status}): ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      if (!bridgeReady) throw err;
      // Fall through to bridge if dev server is active
    }
  }

  // 2. OpenAI Direct Call
  if (active.id === 'openai' && active.token) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${active.token}`,
        },
        body: JSON.stringify({
          model: active.model || 'gpt-4o-mini',
          messages,
          max_tokens: opts.maxTokens ?? 1500,
          temperature: opts.temperature ?? 0.4,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenAI (${res.status}): ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      if (!bridgeReady) throw err;
    }
  }

  // 3. Anthropic Messages API (Direct Browser Fetch)
  if (active.id === 'anthropic' && active.token) {
    try {
      const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
      const userMsgs = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: m.content,
        }));

      if (userMsgs.length === 0) {
        userMsgs.push({ role: 'user', content: 'Proceed' });
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': active.token,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: active.model || 'claude-3-5-haiku-20241022',
          system: opts.json ? `${systemMsg}\nReturn valid JSON only.` : systemMsg,
          messages: userMsgs,
          max_tokens: opts.maxTokens ?? 1500,
          temperature: opts.temperature ?? 0.3,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Anthropic (${res.status}): ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text?.trim();
      if (text) return text;
    } catch (err) {
      if (!bridgeReady) throw err;
    }
  }

  // 4. OpenRouter Direct Call
  if (active.id === 'openrouter' && active.token) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${active.token}`,
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://nirvik607-star.github.io/learn',
          'X-Title': 'ApexLearn Harness',
        },
        body: JSON.stringify({
          model: active.model || 'openai/gpt-4o-mini',
          messages,
          max_tokens: opts.maxTokens ?? 1500,
          temperature: opts.temperature ?? 0.4,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenRouter (${res.status}): ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      if (!bridgeReady) throw err;
    }
  }

  // 5. Google Gemini Direct Call
  if (active.id === 'google' && active.token) {
    try {
      const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${active.token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: opts.temperature ?? 0.3,
              maxOutputTokens: opts.maxTokens ?? 1500,
              responseMimeType: opts.json ? 'application/json' : 'text/plain',
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini (${res.status}): ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (err) {
      if (!bridgeReady) throw err;
    }
  }

  // 6. Local Bridge (/api/ai/chat)
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        max_tokens: opts.maxTokens ?? 1500,
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

/**
 * Resilient JSON parser with bracket/brace auto-repair for truncated model outputs.
 */
export function parseJSON<T>(text: string | null): T | null {
  if (!text) return null;

  // 1. Check for markdown code fence
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const target = codeBlock ? codeBlock[1].trim() : text.trim();

  // 2. Direct JSON.parse
  try {
    return JSON.parse(target) as T;
  } catch {
    // continue
  }

  // 3. Slice between outermost { and }
  const firstBrace = target.indexOf('{');
  const lastBrace = target.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = target.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice) as T;
    } catch {
      // continue to repair
    }
  }

  // 4. Bracket/Brace repair for truncated JSON
  try {
    let repaired = target.slice(firstBrace !== -1 ? firstBrace : 0);
    repaired = repaired.replace(/,\s*$/, ''); // remove trailing comma

    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;

    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

    return JSON.parse(repaired) as T;
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
    { maxTokens: 300 }
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
        content: `You are a frozen-rubric exam grader. Grade semantically (synonyms count), but be strict about causal correctness.
Return JSON only: {"correct":bool,"score":0-100,"movesHit":[labels],"movesMissed":[labels],"trapsTriggered":[strings],"failureCategory":"cue_miss"|"discrimination_error"|"execution_slip"|"careless"|"structural_misconception"|null,"feedback":"<=60 words, name what was right and the single most important gap","nextHint":"one minimal hint (lowest useful rung) that does NOT reveal the answer"}`,
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
        content: `Write ONE new exam question that tests the same proposition in a fresh scenario and specifically targets this failure type: ${failureCategory}. Return JSON only: {"question":"...","answer":"concise model answer"}`,
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

/**
 * Distills raw course notes into a clean, high-yield 80/20 knowledge graph using AI,
 * then hydrates it into a full CoursePack with rich 4-stage Quizlet items.
 */
export async function compileCourseWithAI(
  rawNotes: string,
  code: string,
  examTitle: string
): Promise<CoursePack> {
  const systemPrompt = `You are an expert cognitive curriculum architect following the LearnHarness doctrine (80/20 Pareto generator yield).
Your task is to analyze the user's course material and synthesize a clean, high-yield knowledge graph.

CRITICAL RULES:
1. Synthesize EXACTLY 3 to 5 Units (never create dozens of fragmented units!).
2. Extract EXACTLY 3 to 6 Core Propositions per unit (total 12 to 22 concepts).
3. Every proposition MUST be a genuine concept or invariant mechanism, NOT a sentence fragment or metadata.
4. Set isUnconditionalTruth: true on the first 1-2 bedrock concepts in each unit (examWeight: 5).
5. For each proposition, provide:
   - title (clean 2-5 word concept name)
   - statement (precise 1-sentence truth or mechanism)
   - motivatedHook (what problem forces us to discover or care about this rule?)
   - keyFormulaOrRule (governing invariant, formula, or constraint)
   - commonMisconceptions (array of 2 common exam traps)
   - confusableWith (adjacent similar concept students mix up on exams)
6. Output valid JSON matching this schema:
{
  "code": "${code}",
  "title": "${examTitle}",
  "examTitle": "${examTitle} — Comprehensive Mastery",
  "institutionTag": "AI Distilled Set",
  "units": [
    { "id": "u1", "number": 1, "title": "Unit Name", "subtitle": "Core focus", "primingSummary": "Hook", "unconditionalTruthSummary": "Invariants" }
  ],
  "nodes": [
    {
      "id": "u1-n1",
      "unitId": "u1",
      "title": "Concept Name",
      "statement": "Precise 1-sentence mechanism or rule",
      "isUnconditionalTruth": true,
      "examWeight": 5,
      "motivatedHook": "Why this matters",
      "keyFormulaOrRule": "Key rule",
      "commonMisconceptions": ["Misconception A", "Misconception B"],
      "confusableWith": "Adjacent concept"
    }
  ]
}
Return valid JSON only.`;

  const userContent = `Course Code: ${code}\nExam Name: ${examTitle}\n\nStudy Material / Syllabus / Notes:\n${rawNotes.slice(0, 20000)}`;

  const text = await aiChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { json: true, maxTokens: 3500, temperature: 0.3 }
  );

  if (!text) {
    throw new Error('AI provider returned empty response. Check connection and API keys in Setup.');
  }

  const parsed = parseJSON<DistilledCourseInput>(text);
  if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new Error('AI response could not be parsed into a structured knowledge graph.');
  }

  // Hydrate with full 4-stage Quizlet items, diagnostic distractors, and 6-rung hint ladders
  return hydrateCoursePack({
    ...parsed,
    code: parsed.code || code,
    title: parsed.title || examTitle,
    examTitle: parsed.examTitle || examTitle,
  });
}

/**
 * Refines and cleans up any existing noisy or fragmented course pack using AI.
 * Distills it into a pristine 3-4 unit, 12-18 node 80/20 knowledge graph.
 */
export async function refineCourseWithAI(course: CoursePack): Promise<CoursePack> {
  const nodeSummary = course.nodes
    .map((n, i) => `${i + 1}. [${n.title}]: ${n.statement}`)
    .join('\n');

  const text = await aiChat(
    [
      {
        role: 'system',
        content: `You are an expert cognitive curriculum architect.
We have an unrefined or fragmented list of concepts from a study set.
Clean up, consolidate, deduplicate, and distill these into EXACTLY 3 to 4 cohesive Units, each containing 3 to 5 high-yield Propositions (total 12 to 18 concepts).
Filter out all noise, metadata keys, and non-pedagogical fragments.
Return JSON only matching the schema:
{
  "code": "${course.code}",
  "title": "${course.title}",
  "examTitle": "${course.examTitle}",
  "institutionTag": "${course.institutionTag}",
  "units": [{ "id": "u1", "number": 1, "title": "...", "subtitle": "...", "primingSummary": "...", "unconditionalTruthSummary": "..." }],
  "nodes": [{ "id": "u1-n1", "unitId": "u1", "title": "Clean Concept Name", "statement": "Clear 1-sentence truth", "isUnconditionalTruth": true, "examWeight": 5, "motivatedHook": "...", "keyFormulaOrRule": "...", "commonMisconceptions": ["..."], "confusableWith": "..." }]
}`,
      },
      {
        role: 'user',
        content: `Existing Raw Concepts (${course.nodes.length} items):\n${nodeSummary.slice(0, 16000)}`,
      },
    ],
    { json: true, maxTokens: 3500, temperature: 0.25 }
  );

  if (!text) {
    throw new Error('AI returned empty response during refinement.');
  }

  const parsed = parseJSON<DistilledCourseInput>(text);
  if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new Error('Could not parse refined course structure.');
  }

  return hydrateCoursePack({
    ...parsed,
    id: course.id,
    code: parsed.code || course.code,
    title: parsed.title || course.title,
    examTitle: parsed.examTitle || course.examTitle,
  });
}
