/**
 * Reasoning engine. Takes a routed message + any derived field data and produces
 * the farmer-facing reply. Two special paths bypass free-form generation:
 *   - spray_window: deterministic Delta T verdict, deterministic phrasing.
 *   - location pin: onboarding payback moment (instant personalized read).
 * Everything else is grounded PT-BR reasoning under the system prompt, via
 * OpenRouter (vision included for leaf photos).
 */

import type { InboundMessage } from './transport/types';
import type { Intent } from './router';
import { SYSTEM_PROMPT, PEST_HANDOFF_REMINDER } from './prompts/system';
import { fetchHourlyWeather } from './tools/weather';
import { sprayWindow, type SprayWindow } from './tools/deltaT';
import { getFarmLocation } from './db';
import { chat, type ChatImage } from './llm';
import { MODELS } from './env';
import { lookupPest, normalizeCrop, groundingBlock } from './tools/agrofit';
import { createLogger } from './logger';

const log = createLogger('reason');

/**
 * Extract {crop, pest} from a pest question using the cheap tier, so we can
 * ground the answer in Agrofit. Returns nulls on any failure — grounding is
 * best-effort and never blocks the reply.
 */
async function extractPestTarget(
  text: string
): Promise<{ crop: string | null; pest: string | null }> {
  try {
    const raw = await chat({
      model: MODELS.router(),
      maxTokens: 60,
      system:
        'Extraia cultura e praga/doença da mensagem do produtor. Responda SÓ um JSON: {"crop":"soja|milho|pastagem|outro","pest":"nome da praga ou doença, ou vazio"}. Sem texto extra.',
      user: text,
    });
    const match = raw.match(/\{[^}]*\}/);
    if (!match) return { crop: null, pest: null };
    const parsed = JSON.parse(match[0]) as { crop?: string; pest?: string };
    return {
      crop: parsed.crop && parsed.crop !== 'outro' ? parsed.crop : null,
      pest: parsed.pest || null,
    };
  } catch (e) {
    log.error('pest target extraction failed:', (e as Error).message);
    return { crop: null, pest: null };
  }
}

/** Agrofit grounding for a pest question, or null if nothing matched. */
async function pestGrounding(text: string): Promise<string | null> {
  const target = await extractPestTarget(text);
  if (!target.pest) return null;
  const hit = lookupPest(normalizeCrop(target.crop), target.pest);
  return hit ? groundingBlock(hit) : null;
}

/** Format a spray-window result into a compact WhatsApp reply. */
export function phraseSpray(w: SprayWindow): string {
  const emoji = { go: '✅', caution: '⚠️', 'no-go': '🚫' } as const;
  const label = { go: 'Pode pulverizar', caution: 'Atenção', 'no-go': 'Melhor não' } as const;
  const lines = [`${emoji[w.now.verdict]} ${label[w.now.verdict]} agora.`];
  lines.push(w.now.reasons.map((r) => `• ${r}`).join('\n'));
  if (w.bestUpcoming) {
    const hour = w.bestUpcoming.time.slice(11, 16);
    lines.push(`\n🕐 Janela melhor hoje: por volta das ${hour} (Delta T ${w.bestUpcoming.deltaT} °C).`);
  }
  return lines.join('\n');
}

async function handleSpray(
  msg: InboundMessage,
  userId: string | null
): Promise<string> {
  let coords = msg.location;
  if (!coords && userId) coords = await getFarmLocation(userId);
  if (!coords) {
    return 'Pra te dizer se dá pra pulverizar, preciso saber onde fica sua lavoura. Manda sua localização aqui pelo WhatsApp (clipe 📎 → Localização) que eu calculo o Delta T, vento e chuva pra você.';
  }
  try {
    const hours = await fetchHourlyWeather(coords, 12);
    return phraseSpray(sprayWindow(hours));
  } catch {
    return 'Não consegui puxar o clima da sua região agora. Como referência: a janela boa de Delta T é entre 2 e 8 °C, vento fraco (abaixo de ~10 km/h) e sem chuva próxima. Tenta de novo daqui a pouco.';
  }
}

async function handleVision(msg: InboundMessage, media: ChatImage): Promise<string> {
  return chat({
    model: MODELS.reasoning(),
    system: SYSTEM_PROMPT + '\n\n' + PEST_HANDOFF_REMINDER,
    maxTokens: 700,
    image: media,
    user:
      (msg.text ? `O produtor disse: "${msg.text}". ` : '') +
      'Olhe a foto da lavoura. Diga o que provavelmente é (com grau de confiança honesto), explique o porquê em uma linha, oriente o manejo em princípio (MIP) e encaminhe a decisão de produto/dose pro agrônomo com receituário. Se não der pra identificar com segurança, diga isso e peça uma foto melhor ou indique procurar um agrônomo. Resposta curta, tamanho WhatsApp.',
  });
}

async function handleText(
  msg: InboundMessage,
  intent: Intent,
  context: string | null
): Promise<string> {
  const extra = intent === 'pest_triage' ? '\n\n' + PEST_HANDOFF_REMINDER : '';

  // Ground pest/disease questions in the Agrofit registry.
  let grounding: string | null = null;
  if (intent === 'pest_triage' && msg.text) {
    grounding = await pestGrounding(msg.text);
  }

  const blocks: string[] = [];
  if (grounding) blocks.push(`[Registro Agrofit — use isto como base, não invente]\n${grounding}`);
  if (context) blocks.push(`[Dados derivados da lavoura]\n${context}`);
  const ctx = blocks.length ? '\n\n' + blocks.join('\n\n') : '';

  return chat({
    model: MODELS.reasoning(),
    system: SYSTEM_PROMPT + extra,
    maxTokens: 900,
    user: (msg.text ?? '') + ctx,
  });
}

export interface ReasonDeps {
  userId: string | null;
  /** Pre-fetched media (image) as base64, when the transport supplied it. */
  media?: ChatImage | null;
  /** Extra derived context (farm card facts) to ground the reply. */
  context?: string | null;
}

/** Produce a reply for a routed message. */
export async function reason(
  msg: InboundMessage,
  intent: Intent,
  deps: ReasonDeps
): Promise<string> {
  if (intent === 'smalltalk') {
    return 'Opa! Eu sou o Stevi, seu ajudante de lavoura aqui no WhatsApp. 🌱 Você pode me mandar foto de uma folha ou praga pra eu dar uma olhada, perguntar "posso pulverizar hoje?" (me manda sua localização), ou tirar dúvidas sobre soja, milho e pasto. Importante: eu ajudo a entender e a saber o que perguntar — quem prescreve produto é o agrônomo. Como posso ajudar?';
  }

  if (intent === 'spray_window') {
    return handleSpray(msg, deps.userId);
  }

  if (msg.kind === 'image' && deps.media) {
    return handleVision(msg, deps.media);
  }

  if (!msg.text) {
    return 'Recebi sua mensagem, mas não consegui ler o conteúdo. Me manda em texto ou áudio que eu te ajudo!';
  }

  return handleText(msg, intent, deps.context ?? null);
}
