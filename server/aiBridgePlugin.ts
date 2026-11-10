import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';

const execFileAsync = promisify(execFile);

const AUTH_FILE = path.join(os.homedir(), '.apexlearn-auth.json');
const OPENAI_ISSUER = 'https://auth.openai.com';
const OPENAI_AUTHORIZE = `${OPENAI_ISSUER}/api/accounts/authorize`;
const OPENAI_TOKEN = `${OPENAI_ISSUER}/api/accounts/oauth/token`;
const OPENAI_RESOURCE = 'https://api.openai.com/v1';
const OPENAI_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'resource.invoke',
  'chatgpt.tokens.use.direct',
];

interface StoredAuthConfig {
  activeProvider?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  customEndpointUrl?: string;
  customModelName?: string;
  chatgptOAuth?: {
    accessToken: string;
    refreshToken?: string;
    email?: string;
    expiresAt: number;
    clientId: string;
  };
  tokenStats?: {
    localZeroTokenActions: number;
    aiAssistedActions: number;
    estimatedTokensSaved: number;
    estimatedApiCostUsd: number;
  };
}

function loadStoredConfig(): StoredAuthConfig {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    }
  } catch {
    // ignore
  }
  return {};
}

function saveStoredConfig(cfg: StoredAuthConfig): void {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  } catch {
    // ignore
  }
}

async function detectCliVersion(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 3500 });
    return stdout.trim().split('\n')[0] || 'installed';
  } catch {
    return null;
  }
}

async function runCodexCliPrompt(systemPrompt: string, userPrompt: string): Promise<string> {
  const combinedPrompt = `${systemPrompt}\n\n---\nUSER REQUEST:\n${userPrompt}`;
  const { stdout } = await execFileAsync(
    'codex',
    ['exec', '--skip-git-repo-check', combinedPrompt],
    {
      timeout: 45000,
      maxBuffer: 4 * 1024 * 1024,
    }
  );
  return stdout.trim();
}

async function runClaudeCliPrompt(systemPrompt: string, userPrompt: string): Promise<string> {
  const combinedPrompt = `${systemPrompt}\n\n---\n${userPrompt}`;
  const { stdout } = await execFileAsync(
    'claude',
    ['-p', combinedPrompt, '--output-format', 'text'],
    {
      timeout: 45000,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1',
      },
    }
  );
  return stdout.trim();
}

async function callOpenAICompatible(params: {
  endpoint: string;
  apiKeyOrBearer: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  const url = `${params.endpoint.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.apiKeyOrBearer ? { Authorization: `Bearer ${params.apiKeyOrBearer}` } : {}),
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callAnthropicMessages(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 900,
      system: [
        {
          type: 'text',
          text: params.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: params.userPrompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  return (
    data.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim() || ''
  );
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function apexLearnAiBridgePlugin(): Plugin {
  let pendingOAuthServer: http.Server | null = null;
  let pendingOAuthUrl: string | null = null;

  const attachMiddleware = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/ai/')) {
        return next();
      }

      const urlObj = new URL(req.url, 'http://localhost');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      try {
        const stored = loadStoredConfig();
        const stats = stored.tokenStats ?? {
          localZeroTokenActions: 0,
          aiAssistedActions: 0,
          estimatedTokensSaved: 0,
          estimatedApiCostUsd: 0,
        };

        if (urlObj.pathname === '/api/ai/status' && req.method === 'GET') {
          const [codexVer, claudeVer] = await Promise.all([
            detectCliVersion('codex'),
            detectCliVersion('claude'),
          ]);

          const openaiKeyConfigured = Boolean(
            stored.openaiApiKey || process.env.OPENAI_API_KEY
          );
          const anthropicKeyConfigured = Boolean(
            stored.anthropicApiKey || process.env.ANTHROPIC_API_KEY
          );
          const chatgptOAuthConnected = Boolean(
            stored.chatgptOAuth?.accessToken &&
              stored.chatgptOAuth.expiresAt > Date.now()
          );

          let activeProvider = stored.activeProvider || 'auto';
          if (activeProvider === 'auto') {
            if (codexVer) activeProvider = 'codex-cli';
            else if (claudeVer) activeProvider = 'claude-cli';
            else if (chatgptOAuthConnected) activeProvider = 'chatgpt-oauth';
            else if (openaiKeyConfigured) activeProvider = 'openai-api';
            else if (anthropicKeyConfigured) activeProvider = 'anthropic-api';
            else activeProvider = 'zero-token-local';
          }

          res.end(
            JSON.stringify({
              activeProvider,
              codexCliAvailable: Boolean(codexVer),
              codexCliVersion: codexVer ?? undefined,
              claudeCliAvailable: Boolean(claudeVer),
              claudeCliVersion: claudeVer ?? undefined,
              chatgptOAuthConnected,
              chatgptOAuthEmail: stored.chatgptOAuth?.email,
              chatgptOAuthPending: Boolean(pendingOAuthServer),
              chatgptOAuthUrl: pendingOAuthUrl ?? undefined,
              openaiKeyConfigured,
              anthropicKeyConfigured,
              customEndpointUrl: stored.customEndpointUrl,
              tokenStats: stats,
            })
          );
          return;
        }

        if (urlObj.pathname === '/api/ai/config' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const nextCfg: StoredAuthConfig = {
            ...stored,
            ...(typeof body.activeProvider === 'string'
              ? { activeProvider: body.activeProvider }
              : {}),
            ...(typeof body.openaiApiKey === 'string'
              ? { openaiApiKey: body.openaiApiKey.trim() || undefined }
              : {}),
            ...(typeof body.anthropicApiKey === 'string'
              ? { anthropicApiKey: body.anthropicApiKey.trim() || undefined }
              : {}),
            ...(typeof body.customEndpointUrl === 'string'
              ? { customEndpointUrl: body.customEndpointUrl.trim() || undefined }
              : {}),
            ...(typeof body.customModelName === 'string'
              ? { customModelName: body.customModelName.trim() || undefined }
              : {}),
          };
          saveStoredConfig(nextCfg);
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (urlObj.pathname === '/api/ai/oauth/chatgpt/start' && req.method === 'POST') {
          if (pendingOAuthServer) {
            try {
              pendingOAuthServer.close();
            } catch {
              // ignore
            }
            pendingOAuthServer = null;
          }

          const verifier = crypto.randomBytes(32).toString('base64url');
          const challenge = crypto
            .createHash('sha256')
            .update(verifier)
            .digest('base64url');
          const expectedState = crypto.randomBytes(24).toString('base64url');
          const nonce = crypto.randomBytes(24).toString('base64url');
          const hostId = `urn:uuid:${crypto.randomUUID()}`;

          const callbackServer = http.createServer();
          await new Promise<void>((resolve, reject) => {
            callbackServer.once('error', reject);
            callbackServer.listen(0, '127.0.0.1', () => resolve());
          });

          const address = callbackServer.address();
          const port = typeof address === 'object' && address ? address.port : 0;
          const redirectUri = `http://127.0.0.1:${port}/auth/callback`;

          const authUrl = new URL(OPENAI_AUTHORIZE);
          authUrl.search = new URLSearchParams({
            client_id: 'dynamic_agent_client',
            agent_name_hint: 'ApexLearnHarness',
            ext_agent_host_id: hostId,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: OPENAI_SCOPES.join(' '),
            resource: OPENAI_RESOURCE,
            state: expectedState,
            nonce,
            code_challenge_method: 'S256',
            code_challenge: challenge,
          }).toString();

          pendingOAuthServer = callbackServer;
          pendingOAuthUrl = authUrl.toString();

          callbackServer.on('request', async (cbReq, cbRes) => {
            try {
              const cbUrl = new URL(cbReq.url || '/', redirectUri);
              if (cbUrl.pathname !== '/auth/callback') {
                cbRes.writeHead(404).end();
                return;
              }
              const code = cbUrl.searchParams.get('code');
              const state = cbUrl.searchParams.get('state');
              const clientId =
                cbUrl.searchParams.get('client_id') || 'dynamic_agent_client';

              if (!code || state !== expectedState) {
                cbRes.writeHead(400).end('Invalid OAuth callback state.');
                return;
              }

              const tokenResp = await fetch(OPENAI_TOKEN, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  Accept: 'application/json',
                },
                body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  client_id: clientId,
                  code,
                  code_verifier: verifier,
                  redirect_uri: redirectUri,
                  resource: OPENAI_RESOURCE,
                }),
              });

              const tokenBody = (await tokenResp.json()) as {
                access_token?: string;
                refresh_token?: string;
                expires_in?: number;
              };

              if (tokenBody.access_token) {
                const current = loadStoredConfig();
                saveStoredConfig({
                  ...current,
                  activeProvider: 'chatgpt-oauth',
                  chatgptOAuth: {
                    accessToken: tokenBody.access_token,
                    refreshToken: tokenBody.refresh_token,
                    email: 'OpenAI ChatGPT Account',
                    expiresAt: Date.now() + (tokenBody.expires_in ?? 3600) * 1000,
                    clientId,
                  },
                });
                cbRes
                  .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
                  .end(
                    '<html><body style="font-family:sans-serif;padding:40px;background:#0d1117;color:#f0f6fc;"><h2>OpenAI ChatGPT Connected to ApexLearn Harness!</h2><p>You can close this tab and return to your study session.</p></body></html>'
                  );
              } else {
                cbRes.writeHead(400).end('Token exchange did not return an access_token.');
              }
            } catch {
              cbRes.writeHead(500).end('OAuth callback failed.');
            } finally {
              callbackServer.close();
              pendingOAuthServer = null;
              pendingOAuthUrl = null;
            }
          });

          // Try opening browser automatically on macOS / Linux desktop
          const openCmd =
            process.platform === 'darwin'
              ? 'open'
              : process.platform === 'win32'
              ? 'start'
              : 'xdg-open';
          execFile(openCmd, [authUrl.toString()], () => {});

          res.end(
            JSON.stringify({
              ok: true,
              authUrl: authUrl.toString(),
              redirectUri,
            })
          );
          return;
        }

        if (urlObj.pathname === '/api/ai/tutor' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const mode = String(body.mode || 'socratic_nudge');
          const nodeTitle = String(body.nodeTitle || '');
          const nodeStatement = String(body.nodeStatement || '');
          const learnerInput = String(body.learnerInput || '');
          const learnerThinking = String(body.learnerThinking || '');

          const systemPrompt =
            mode === 'strict_examiner'
              ? `You are the Strict / Angry Examiner (Feynman Interrogation Mode) inside ApexLearn Harness.
Target Proposition: "${nodeTitle}" — ${nodeStatement}
Rules:
1. Never accept vague hand-waving or buzzword parroting.
2. Quote the learner's exact words where their causal chain is thin or imprecise.
3. Ask ONE razor-sharp follow-up question that forces them to state the exact mechanism in 2-3 sentences. Keep your response under 110 words.`
              : `You are the Socratic Teaching Agent inside ApexLearn Harness (built on Amos Blomqvist's LearnHarness methodology).
Target Proposition: "${nodeTitle}" — ${nodeStatement}
Rules:
1. Move strictly ONE reasoning step at a time. Never dump a wall of text.
2. Diagnose the learner's thinking trace ("${learnerThinking}") and their answer ("${learnerInput}").
3. Give the smallest possible surgical nudge (R1–R2 on the hint ladder) that helps the learner make the connection themselves so the proposition feels obviously true. Keep your response under 110 words.`;

          const userPrompt = `Learner Answer: ${learnerInput}\nLearner Thinking Trace: ${learnerThinking}\nRespond concisely following the harness doctrine.`;

          const provider = stored.activeProvider || 'auto';
          let reply = '';
          let usedProvider = provider;

          try {
            if (provider === 'codex-cli' || (provider === 'auto' && (await detectCliVersion('codex')))) {
              usedProvider = 'codex-cli';
              reply = await runCodexCliPrompt(systemPrompt, userPrompt);
            } else if (
              provider === 'claude-cli' ||
              (provider === 'auto' && (await detectCliVersion('claude')))
            ) {
              usedProvider = 'claude-cli';
              reply = await runClaudeCliPrompt(systemPrompt, userPrompt);
            } else if (
              (provider === 'chatgpt-oauth' || provider === 'auto') &&
              stored.chatgptOAuth?.accessToken
            ) {
              usedProvider = 'chatgpt-oauth';
              reply = await callOpenAICompatible({
                endpoint: 'https://api.openai.com/v1',
                apiKeyOrBearer: stored.chatgptOAuth.accessToken,
                model: 'gpt-4o-mini',
                systemPrompt,
                userPrompt,
              });
            } else if (
              (provider === 'openai-api' || provider === 'auto') &&
              (stored.openaiApiKey || process.env.OPENAI_API_KEY)
            ) {
              usedProvider = 'openai-api';
              reply = await callOpenAICompatible({
                endpoint: 'https://api.openai.com/v1',
                apiKeyOrBearer: (stored.openaiApiKey || process.env.OPENAI_API_KEY)!,
                model: 'gpt-4o-mini',
                systemPrompt,
                userPrompt,
              });
            } else if (
              (provider === 'anthropic-api' || provider === 'auto') &&
              (stored.anthropicApiKey || process.env.ANTHROPIC_API_KEY)
            ) {
              usedProvider = 'anthropic-api';
              reply = await callAnthropicMessages({
                apiKey: (stored.anthropicApiKey || process.env.ANTHROPIC_API_KEY)!,
                model: 'claude-3-5-haiku-latest',
                systemPrompt,
                userPrompt,
              });
            } else if (provider === 'custom-local' && stored.customEndpointUrl) {
              usedProvider = 'custom-local';
              reply = await callOpenAICompatible({
                endpoint: stored.customEndpointUrl,
                apiKeyOrBearer: stored.openaiApiKey || '',
                model: stored.customModelName || 'llama3.2',
                systemPrompt,
                userPrompt,
              });
            }
          } catch (providerErr) {
            // Fall through to deterministic local Socratic synthesizer
            usedProvider = `zero-token-local (fallback: ${(providerErr as Error).message.slice(0, 60)})`;
          }

          if (!reply) {
            usedProvider = 'zero-token-local';
            if (mode === 'strict_examiner') {
              reply = `[Strict Examiner — 0-Token Engine] You mentioned "${
                learnerInput.slice(0, 60) || 'the general idea'
              }", but an exam grader won't give full credit without the exact causal link! Specifically: ${nodeStatement} Now tighten your answer: what is the exact variable or constraint that forces this outcome, and what breaks if that constraint is removed?`;
            } else {
              reply = `[Socratic Coach — 0-Token Engine] Let's step from what you already hold: "${
                learnerThinking || learnerInput || 'your initial intuition'
              }". Connect that to our core proposition: ${nodeStatement} Before jumping to the end, what single intermediate change must happen first?`;
            }
            stats.localZeroTokenActions += 1;
            stats.estimatedTokensSaved += 420;
          } else {
            stats.aiAssistedActions += 1;
            stats.estimatedApiCostUsd =
              Math.round((stats.estimatedApiCostUsd + 0.0003) * 10000) / 10000;
          }

          saveStoredConfig({ ...stored, tokenStats: stats });

          res.end(
            JSON.stringify({
              ok: true,
              provider: usedProvider,
              reply,
              tokenStats: stats,
            })
          );
          return;
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
      } catch (err) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : 'Internal error',
          })
        );
      }
    });
  };

  return {
    name: 'apexlearn-ai-bridge',
    configureServer(server) {
      attachMiddleware(server);
    },
    configurePreviewServer(server) {
      attachMiddleware(server);
    },
  };
}
