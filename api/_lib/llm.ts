/**
 * OpenRouter chat client (OpenAI-compatible API). One key serves every model
 * tier; Anthropic models are reached via anthropic/* slugs. Kept as plain fetch
 * — no SDK dependency, no streaming, WhatsApp-sized replies.
 */

import { requireEnv, MODELS } from './env';
import { withRetry, isTransient } from './retry';
import { fireAndForget } from './fireAndForget';
import { restanteMs, prazoDaTentativa, cabeOutraTentativa, prazoAtual } from './orcamento';
import { createLogger } from './logger';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const log = createLogger('llm');

export interface ChatImage {
  base64: string;
  mime: string;
}

export interface ChatAudio {
  base64: string;
  /** e.g. 'ogg', 'mp3', 'wav' — WhatsApp voice notes are ogg/opus. */
  format: string;
}

/**
 * OpenRouter provider routing (docs: guides/routing/provider-selection).
 * `only` restringe aos slugs listados; `order` prioriza sem excluir. Existe por
 * causa do Gemini 2.5: o Google marcou aposentadoria no VERTEX (16/10/2026) mas
 * não na API pública — e sem pin o OpenRouter roteia transcrição pros dois.
 */
export interface ProviderPrefs {
  only?: string[];
  order?: string[];
  allow_fallbacks?: boolean;
}

export interface ChatOptions {
  model: string;
  system?: string;
  user: string;
  image?: ChatImage | null;
  audio?: ChatAudio | null;
  maxTokens?: number;
  /** Sampling temperature. Omit for provider default; the Gym runs personas hot. */
  temperature?: number;
  /**
   * Mark the system prompt as an Anthropic prompt-cache breakpoint (ephemeral).
   * Worth it when the same large system prompt repeats across requests — the
   * farmer reasoning path reuses the base persona + style pack on every call and
   * puts all per-request content in the user message, so the system block is a
   * stable prefix Anthropic can cache (~90% input-token cut on a hit). No-op on
   * models/providers that don't cache, or below the minimum cacheable length.
   */
  cacheSystem?: boolean;
  /**
   * Teto por tentativa, em ms. Default 25s — esta era a única chamada externa
   * sem prazo, e um socket pendurado do OpenRouter comia os 60s inteiros do
   * maxDuration (o produtor recebia silêncio, nem o fallback).
   *
   * Este número sozinho NÃO fecha o orçamento, e o comentário antigo aqui
   * dizia que fechava ("leaves room for one retry"): 25s × 2 tentativas já são
   * 50s. Quem fecha é o `deadlineAt` abaixo. Este campo continua sendo o teto
   * de UMA tentativa — útil para dizer "esta extração é barata, 10s bastam".
   */
  timeoutMs?: number;
  /** Pin de provider no OpenRouter (ver ProviderPrefs). Omitido = roteamento livre. */
  provider?: ProviderPrefs;
  /**
   * Prazo final da requisição (epoch ms), compartilhado por todas as chamadas
   * do mesmo webhook. Com ele, cada tentativa gasta no máximo o que sobrou e a
   * tentativa extra só acontece se couber — é o que impede duas chamadas
   * sequenciais de somarem mais que o maxDuration.
   *
   * Ausente = comportamento de sempre. Gym, canary, crons e scripts chamam o
   * mesmo `chat()` sem orçamento de webhook nenhum e não devem ser apertados.
   */
  deadlineAt?: number;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } };

/** A system message either as a plain string or a cache-marked content block. */
type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
type ChatMessage = { role: string; content: string | ContentPart[] | SystemBlock[] };

/** Short PT-BR description of an image (for feeding vision into text-only flows). */
export async function describeImage(image: ChatImage): Promise<string> {
  return chat({
    model: MODELS.reasoning(),
    maxTokens: 120,
    user: 'Descreva esta imagem em 1-2 frases objetivas, em português.',
    image,
  });
}

/**
 * Send one chat turn and return the assistant text. Throws on API failure.
 * One retry on transient failures (429/5xx/network) and on empty completions —
 * OpenRouter occasionally returns those transiently (seen in gym runs). Kept to
 * a single retry: these calls are the slow part of a webhook with a hard
 * maxDuration budget.
 */
export async function chat(opts: ChatOptions): Promise<string> {
  try {
    return await withRetry(
      // O prazo é recalculado A CADA tentativa, dentro do thunk: entre a
      // primeira e a segunda o relógio andou, e a segunda só pode gastar o que
      // sobrou. Fosse calculado uma vez fora, as duas pediriam 25s e a soma
      // estouraria o maxDuration — que é exatamente o bug que isto conserta.
      () => chatOnce({ ...opts, timeoutMs: prazoDaTentativa(opts.timeoutMs ?? 25_000, restanteMs(opts.deadlineAt ?? prazoAtual(), Date.now())) }),
      {
        attempts: 2,
        shouldRetry: (e) =>
          // Sem tempo, não se repete: gastar o resto para falhar de novo deixa
          // o produtor sem nem o fallback. Uma resposta pior no prazo vale mais
          // que a resposta certa depois que a função já morreu.
          cabeOutraTentativa(restanteMs(opts.deadlineAt ?? prazoAtual(), Date.now())) &&
          (isTransient(e) ||
            (e instanceof Error &&
              (e.message.includes('empty completion') || e.message.includes('timeout after')))),
      }
    );
  } catch (e) {
    // Saldo zero é incidente de negócio, não erro técnico: sem alerta a Vitória
    // fica muda e ninguém sabe. O alerta NUNCA altera o resultado da chamada —
    // o erro segue subindo para quem chamou decidir. Dispara MESMO quando o
    // fallback direto abaixo salvar a resposta: saldo zero não se paga sozinho.
    const msg = (e as Error).message ?? '';
    if (isCreditError(msg)) fireAndForget(() => alertarCredito(msg), 'alerta de crédito');

    // Camada 1 do resgate: a CHAVE RESERVA do OpenRouter (outra conta, mesmo
    // gateway). Cobre exatamente o incidente de 29/jul — saldo zero é da
    // CONTA, não da plataforma — e vem antes do direto porque fala o mesmo
    // dialeto (áudio e prompt-cache inclusos), então nenhuma chamada fica de
    // fora. Se a plataforma inteira caiu, ela falha rápido e a camada 2 assume.
    const salvoReserva = await tentarChaveReserva(opts);
    if (salvoReserva != null) return salvoReserva;

    // Camada 2: se existe chave da API direta do provedor deste modelo, vale
    // uma tentativa antes do fallback burro. Sem condição sobre a CLASSE do
    // erro, de propósito — o cenário que motivou isto (aquisição da OpenRouter
    // pela Stripe, 19/08/2026) falharia por conta/termos (401/402/403), não
    // por 5xx, e a chave direta é outra conta. O orçamento de tempo é quem
    // limita o custo de tentar.
    const salvo = await tentarFallbackDireto(opts);
    if (salvo != null) return salvo;
    throw e;
  }
}

/**
 * Uma tentativa com a chave reserva do OpenRouter (OPENROUTER_FALLBACK_API_KEY,
 * uma conta separada). Devolve null quando não configurada, sem tempo, ou
 * quando também falhou — o erro ORIGINAL da chave principal é o que sobe.
 */
async function tentarChaveReserva(opts: ChatOptions): Promise<string | null> {
  const reserva = process.env.OPENROUTER_FALLBACK_API_KEY;
  if (!reserva) return null;
  try {
    const restante = restanteMs(opts.deadlineAt ?? prazoAtual(), Date.now());
    if (!cabeOutraTentativa(restante)) return null;
    const timeoutMs = prazoDaTentativa(opts.timeoutMs ?? 25_000, restante);
    const texto = await chatOnce({ ...opts, timeoutMs }, reserva);
    // error, não info: a conta principal falhando é incidente mesmo com a
    // reserva segurando — a reserva tem o saldo de OUTRO projeto.
    log.error(`chave principal do OpenRouter falhou; a reserva respondeu por ${opts.model}`);
    return texto;
  } catch (e) {
    log.error('chave reserva do OpenRouter também falhou:', (e as Error).message);
    return null;
  }
}

/**
 * Uma tentativa pela API direta do provedor (Anthropic/Google), quando
 * configurada. Devolve null quando não dá (sem rota, sem chave, sem tempo) ou
 * quando também falhou — quem chamou rethrowa o erro ORIGINAL do gateway, que
 * é o incidente real. Import dinâmico para não criar ciclo (llmDirect importa
 * buildMessages daqui).
 */
async function tentarFallbackDireto(opts: ChatOptions): Promise<string | null> {
  try {
    const { directRouteFor, chatDirect } = await import('./llmDirect');
    const route = directRouteFor(opts.model);
    if (!route || !process.env[route.envKey]) return null;
    const restante = restanteMs(opts.deadlineAt ?? prazoAtual(), Date.now());
    if (!cabeOutraTentativa(restante)) return null;
    const timeoutMs = prazoDaTentativa(opts.timeoutMs ?? 25_000, restante);
    const r = await chatDirect(opts, route, timeoutMs);
    lastFinishReason = r.finishReason;
    // error, não info, de propósito: cada linha destas é o gateway falhando em
    // produção — em série, é hora de olhar o OpenRouter (status, saldo, termos).
    log.error(`OpenRouter falhou; API direta (${route.provider}) respondeu por ${opts.model}`);
    return r.text;
  } catch (e) {
    log.error('fallback direto também falhou:', (e as Error).message);
    return null;
  }
}

/**
 * Build the OpenRouter `messages` array from chat options. Pure — extracted so
 * message shaping (image/audio parts, system prompt-cache breakpoint) is unit
 * testable without a live API call.
 */
export function buildMessages(opts: ChatOptions): ChatMessage[] {
  let content: string | ContentPart[] = opts.user;
  if (opts.image || opts.audio) {
    const parts: ContentPart[] = [];
    if (opts.image) {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${opts.image.mime};base64,${opts.image.base64}` },
      });
    }
    if (opts.audio) {
      parts.push({
        type: 'input_audio',
        input_audio: { data: opts.audio.base64, format: opts.audio.format },
      });
    }
    parts.push({ type: 'text', text: opts.user });
    content = parts;
  }

  const messages: ChatMessage[] = [];
  if (opts.system) {
    // With cacheSystem, send the system prompt as a content block carrying an
    // ephemeral cache_control breakpoint (Anthropic prompt caching, passed
    // through by OpenRouter). Otherwise a plain string, as before.
    messages.push(
      opts.cacheSystem
        ? { role: 'system', content: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }] }
        : { role: 'system', content: opts.system }
    );
  }
  messages.push({ role: 'user', content });
  return messages;
}

/**
 * The OpenRouter request body. Pure — extracted so the provider pin (and the
 * rest of the wire shape) is unit testable without a live call.
 */
export function buildRequestBody(opts: ChatOptions): Record<string, unknown> {
  return {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 600,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.provider ? { provider: opts.provider } : {}),
    messages: buildMessages(opts),
  };
}

async function chatOnce(opts: ChatOptions, apiKeyOverride?: string): Promise<string> {
  const apiKey = apiKeyOverride ?? requireEnv('OPENROUTER_API_KEY');

  const timeoutMs = opts.timeoutMs ?? 25_000;
  // Sem orçamento não se abre conexão: um AbortSignal.timeout(0) faria a
  // requisição sair e morrer no mesmo tique, gastando o pouco que sobrou. Erro
  // explícito para quem chamou degradar (fallback) enquanto ainda dá tempo.
  if (timeoutMs <= 0) throw new Error('sem orçamento de tempo para a chamada de LLM');
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://roca-black.vercel.app',
        'X-Title': 'Stevi',
      },
      body: JSON.stringify(buildRequestBody(opts)),
    });
  } catch (e) {
    const name = (e as Error).name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new Error(`OpenRouter timeout after ${timeoutMs}ms`);
    }
    throw e;
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    error?: { message?: string };
  };
  if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter returned empty completion');
  // Stashed for chatDetailed; callers of chat() keep the plain-string contract.
  lastFinishReason = data.choices?.[0]?.finish_reason ?? null;
  return text;
}

// Why a module-level stash instead of a wider return type: `chat()` is called
// from a dozen places that want a string, and threading an object through all
// of them to serve one caller would be churn for churn's sake. chatDetailed()
// reads it immediately after its own awaited call, so there is no interleaving
// window — each serverless invocation handles one message at a time.
let lastFinishReason: string | null = null;

/**
 * Like chat(), plus the provider's finish_reason. 'length' means the completion
 * was cut off — the caller must decide whether half a message is worth sending.
 * (For the prospect agent it never is: see interpretAgentOutput.)
 */
export async function chatDetailed(opts: ChatOptions): Promise<{ text: string; finishReason: string | null }> {
  const text = await chat(opts);
  return { text, finishReason: lastFinishReason };
}

// ── Falha por crédito ≠ falha transitória ───────────────────────────────────

/**
 * Se o erro é "sem saldo" e não "deu ruim". 29/jul: o OpenRouter devolveu 402
 * "Insufficient credits", e a Vitória — que degrada para silêncio quando o
 * modelo falha — ficaria muda num dia de disparo sem ninguém saber.
 *
 * Timeout e 429 o retry resolve. Saldo zero não: alguém tem que pagar. São
 * classes diferentes e merecem tratamento diferente.
 */
export function isCreditError(msg: string | null | undefined): boolean {
  const m = (msg ?? '').toLowerCase();
  if (!m) return false;
  return (
    m.includes('402') ||
    m.includes('insufficient credit') ||
    m.includes('quota exceeded') ||
    m.includes('payment required') ||
    m.includes('credit balance')
  );
}

/** Intervalo mínimo entre dois alertas de crédito. */
export const CREDIT_ALERT_COOLDOWN_MS = 10 * 60_000;

/**
 * Se vale alertar agora. Uma rajada de falhas é UM problema, não vinte — mas
 * passado o cooldown alerta de novo, porque saldo zero não se resolve sozinho e
 * cada minuto parado custa lead.
 */
export function deveAlertarCredito(ultimoAlertaMs: number | null, agoraMs: number): boolean {
  if (ultimoAlertaMs == null) return true;
  return agoraMs - ultimoAlertaMs >= CREDIT_ALERT_COOLDOWN_MS;
}

// Por instância de função (serverless). Instância nova pode alertar de novo, e
// isso é aceitável: saldo zero É incidente, repetir é melhor que engolir.
let ultimoAlertaCredito: number | null = null;

/**
 * Avisa os fundadores que o modelo está sem saldo. O import é dinâmico para não
 * criar ciclo (alert → logger, e nada mais). Quem chama passa por fireAndForget,
 * que segura qualquer erro: um alerta que derruba a chamada de LLM seria pior
 * que o problema que ele reporta.
 */
async function alertarCredito(msg: string): Promise<void> {
  const agora = Date.now();
  if (!deveAlertarCredito(ultimoAlertaCredito, agora)) return;
  ultimoAlertaCredito = agora;
  const { alertFounders } = await import('./alert');
  await alertFounders(
    `💳 MODELO SEM SALDO no OpenRouter. A Stevi e a Vitória ficam MUDAS enquanto isso — ` +
      `prospect que responder não recebe nada, e produtor também não. ` +
      `Adicione crédito em openrouter.ai/settings/credits. (${msg.slice(0, 90)})`
  );
}
