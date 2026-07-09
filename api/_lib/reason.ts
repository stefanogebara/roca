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
import { PEST_HANDOFF_REMINDER } from './prompts/system';
import { steviSystemPrompt } from './stylepack';
import { fetchHourlyWeather } from './tools/weather';
import { sprayWindow, type SprayWindow } from './tools/deltaT';
import { getFarmLocation, getFarm, getCachedNdvi, setCachedNdvi } from './db';
import {
  fetchFieldNdvi,
  classifyVigor,
  classifyUniformity,
  UNIFORMITY_MIN_SAMPLES,
} from './tools/ndvi';
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

/** Satellite field-vigor read (NDVI) for the farmer's pin. Cached per farm. */
async function handleFieldHealth(userId: string | null): Promise<string> {
  if (!userId) {
    return 'Pra ver a imagem de satélite da sua lavoura, primeiro me manda sua localização (clipe 📎 → Localização). Aí eu puxo o índice de vigor (NDVI) do seu ponto.';
  }
  const farm = await getFarm(userId);
  if (!farm) {
    return 'Ainda não tenho a localização da sua lavoura. Manda o pin aqui (clipe 📎 → Localização) que eu puxo a imagem de satélite mais recente e te digo como tá o vigor.';
  }

  let reading = await getCachedNdvi(farm.id);
  if (!reading) {
    const fresh = await fetchFieldNdvi(farm.lat, farm.lon);
    if (fresh) {
      reading = { ndvi: fresh.ndvi, date: fresh.date, std: fresh.std, samples: fresh.samples };
      await setCachedNdvi(farm.id, reading);
    }
  }
  if (!reading) {
    return 'Não consegui puxar a imagem de satélite agora — pode ser cobertura de nuvem nos últimos dias ou instabilidade do serviço. Tenta de novo mais tarde. 🛰️';
  }

  const v = classifyVigor(reading.ndvi);
  const [y, m, d] = reading.date.split('-');
  const samples = reading.samples ?? 1;
  const scope =
    samples > 1
      ? `média de ${samples} pontos num raio de ~40 m ao redor do pin`
      : 'um ponto (10 m) no pin';

  // Image age: satellites only pass every few days and clouds skip scenes, so
  // the freshest usable image can still be weeks old. Be honest about it — a
  // stale NDVI could mislead ("minha lavoura tá rala" when it's just old data).
  const ageDays = Math.max(0, Math.round((Date.now() - Date.parse(reading.date)) / 86_400_000));
  const dateLabel = ageDays <= 10 ? `${d}/${m}/${y}` : `${d}/${m}/${y}, há ${ageDays} dias`;

  const lines = [
    `🛰️ Última imagem de satélite (Sentinel-2, ${dateLabel}) da sua lavoura:`,
    '',
    `${v.emoji} NDVI ~${reading.ndvi.toFixed(2)} — ${v.label}.`,
    `${v.note}`,
    `_(${scope})_`,
  ];

  if (ageDays > 21) {
    lines.push(
      '',
      `⏳ Essa é a imagem sem nuvens mais recente que consegui — de ${ageDays} dias atrás. Pode não refletir como a lavoura está hoje.`
    );
  }

  if (reading.std != null && samples >= UNIFORMITY_MIN_SAMPLES) {
    const u = classifyUniformity(reading.std);
    lines.push('', `📊 Uniformidade: ${u.label}. ${u.note}`);
  }

  lines.push(
    '',
    '_Leitura aproximada por satélite — combine com o que você vê no campo e com seu agrônomo. Quer que eu veja se dá pra pulverizar hoje também?_'
  );
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

interface VisionId {
  pest: string | null;
  crop: string | null;
  confidence: 'alta' | 'media' | 'baixa';
  evidence: string | null;
}

/** Step 1 of photo triage: identify the pest/disease as structured data. */
async function identifyFromPhoto(msg: InboundMessage, media: ChatImage): Promise<VisionId | null> {
  try {
    const raw = await chat({
      model: MODELS.reasoning(),
      maxTokens: 220,
      image: media,
      system:
        'Você é um agrônomo experiente olhando a foto de uma lavoura brasileira. Identifique a praga ou doença mais provável. Responda SÓ um JSON, sem texto extra: {"pest":"nome comum em pt-BR ou vazio se não der","crop":"soja|milho|pastagem|cafe|citros|outro","confidence":"alta|media|baixa","evidence":"uma linha curta do que você observa na imagem"}.',
      user: msg.text ? `O produtor disse: "${msg.text}".` : 'Analise a foto.',
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const p = JSON.parse(match[0]) as Partial<VisionId>;
    const confidence = p.confidence === 'alta' || p.confidence === 'baixa' ? p.confidence : 'media';
    return {
      pest: p.pest?.trim() || null,
      crop: p.crop && p.crop !== 'outro' ? p.crop : null,
      confidence,
      evidence: p.evidence?.trim() || null,
    };
  } catch (e) {
    log.error('photo identification failed:', (e as Error).message);
    return null;
  }
}

// When a photo can't be read at all (unsupported/corrupt/off-domain image that
// the vision provider rejects), ask for a better one instead of a generic error.
const PHOTO_RETRY_MSG =
  'Não consegui abrir bem essa foto 🙈. Manda de novo focando na folha ou na praga, de pertinho e com boa luz, que aí eu consigo te ajudar. Se preferir, me descreve por texto o que você tá vendo.';

/**
 * Photo triage, grounded. Vision identifies → we look the pest up in Agrofit →
 * a compose pass writes the WhatsApp answer using the registry as its base. If
 * identification fails we fall back to a single direct vision answer, so a photo
 * always gets a useful, safe reply. Any hard failure (image the provider can't
 * process) returns a friendly "send a clearer photo" ask rather than throwing.
 */
async function handleVision(
  msg: InboundMessage,
  media: ChatImage,
  packOverride?: string | null
): Promise<string> {
  try {
    return await triagePhoto(msg, media, packOverride);
  } catch (e) {
    log.error('handleVision failed:', (e as Error).message);
    return PHOTO_RETRY_MSG;
  }
}

async function triagePhoto(
  msg: InboundMessage,
  media: ChatImage,
  packOverride?: string | null
): Promise<string> {
  const id = await identifyFromPhoto(msg, media);

  if (!id || (!id.pest && id.confidence === 'baixa')) {
    // Fallback: direct vision answer (still carries the handoff via the prompt).
    return chat({
      model: MODELS.reasoning(),
      system: (await steviSystemPrompt(packOverride)) + '\n\n' + PEST_HANDOFF_REMINDER,
      maxTokens: 700,
      image: media,
      user:
        (msg.text ? `O produtor disse: "${msg.text}". ` : '') +
        'Olhe a foto. Diga o que provavelmente é com confiança honesta, explique o porquê em uma linha, oriente o manejo (MIP) e encaminhe produto/dose ao agrônomo com receituário. Se não der pra identificar com segurança, diga isso e peça uma foto melhor. Resposta curta, tamanho WhatsApp.',
    });
  }

  let grounding: string | null = null;
  if (id.pest && id.confidence !== 'baixa') {
    const hit = lookupPest(normalizeCrop(id.crop), id.pest);
    if (hit) grounding = groundingBlock(hit);
  }

  const parts: string[] = [];
  parts.push(
    `Identificação visual: ${id.pest ?? 'incerta'} (confiança ${id.confidence}${id.crop ? `, cultura ${id.crop}` : ''}).`
  );
  if (id.evidence) parts.push(`O que se vê: ${id.evidence}.`);
  if (grounding) parts.push(`\n[Registro Agrofit — use como base, não invente]\n${grounding}`);

  return chat({
    model: MODELS.reasoning(),
    system: (await steviSystemPrompt(packOverride)) + '\n\n' + PEST_HANDOFF_REMINDER,
    maxTokens: 900,
    user:
      `${parts.join('\n')}\n\n` +
      `Com base nisso, escreva a resposta pro produtor no WhatsApp: confirme o provável diagnóstico com honestidade sobre a confiança, explique o porquê em uma linha, oriente o manejo em princípio (MIP: monitorar, controle biológico, rotação), e ` +
      (grounding
        ? 'cite o que o Agrofit registra (sem dose) e '
        : '') +
      `encaminhe a decisão de produto e dose pro agrônomo com receituário. Se a confiança for baixa, seja explícito e peça foto melhor ou indique procurar um agrônomo. Curto, tamanho WhatsApp.`,
  });
}

async function handleText(
  msg: InboundMessage,
  intent: Intent,
  context: string | null,
  packOverride?: string | null
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
    system: (await steviSystemPrompt(packOverride)) + extra,
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
  /** Gym only: run the LLM voice paths against a specific style-pack body
   * (challenger) instead of the active one. Omit in production. */
  packOverride?: string | null;
}

/** Produce a reply for a routed message. */
export async function reason(
  msg: InboundMessage,
  intent: Intent,
  deps: ReasonDeps
): Promise<string> {
  if (intent === 'smalltalk') {
    return 'Opa! Eu sou a Stevi, sua ajudante de lavoura aqui no WhatsApp. 🌱 Você pode me mandar foto de uma folha ou praga pra eu dar uma olhada, perguntar "posso pulverizar hoje?" (me manda sua localização), ou tirar dúvidas sobre soja, milho, pasto, café e citros. Importante: eu ajudo a entender e a saber o que perguntar — quem prescreve produto é o agrônomo. Como posso ajudar?';
  }

  if (intent === 'spray_window') {
    return handleSpray(msg, deps.userId);
  }

  if (intent === 'field_health') {
    return handleFieldHealth(deps.userId);
  }

  if (msg.kind === 'image' && deps.media) {
    return handleVision(msg, deps.media, deps.packOverride);
  }

  if (!msg.text) {
    return 'Recebi sua mensagem, mas não consegui ler o conteúdo. Me manda em texto ou áudio que eu te ajudo!';
  }

  return handleText(msg, intent, deps.context ?? null, deps.packOverride);
}
