/**
 * "Resumo pro agrônomo" — the concierge bridge to a real agronomist, and the
 * business-model seed. The farmer describes the problem to Stevi over a few
 * messages; on request she assembles a clean briefing they can forward straight
 * to an agrônomo, so the pro walks in already knowing crop, stage, symptom, area
 * and history — and can write the receituário faster.
 *
 * Deliberately NOT a free-form LLM generation (the Gym showed that drifts into
 * crop confusion + specific-product listing). Instead: an LLM extracts structured
 * facts from the farmer's own words, then a deterministic template composes the
 * text. Agrofit grounding is groups + count only — never a product or a dose.
 * Triagem, não prescrição, holds end to end.
 */

import { chat } from './llm';
import { MODELS } from './env';
import { groundedHit, chemicalGroups } from './tools/agrofit';
import { getFarmProfile, getRecentInboundText, type FarmProfile } from './db';
import { createLogger } from './logger';

const log = createLogger('brief');

export interface BriefFields {
  pest: string | null;
  crop: string | null;
  stage: string | null;
  symptom: string | null;
  area: string | null;
  applied: string | null;
  when: string | null;
}

const EMPTY: BriefFields = {
  pest: null,
  crop: null,
  stage: null,
  symptom: null,
  area: null,
  applied: null,
  when: null,
};

/** Pull structured facts from the farmer's own recent words (cheap tier). */
async function extractBriefFields(convo: string): Promise<BriefFields> {
  try {
    const raw = await chat({
      model: MODELS.router(),
      maxTokens: 220,
      system:
        'Você lê o que um produtor rural brasileiro contou e extrai os fatos pra um resumo ao agrônomo. ' +
        'Responda SÓ um JSON, sem texto extra, com estas chaves (use null quando o produtor não disse): ' +
        '{"pest":"praga/doença citada","crop":"soja|milho|pastagem|cafe|citros|outro","stage":"estádio/fase (ex: V8, floração)","symptom":"sintoma observado em poucas palavras","area":"quanto da área/% afetado","applied":"o que já aplicou","when":"quando notou ou plantou"}. ' +
        'Não invente nada que ele não tenha dito.',
      user: convo.slice(0, 4000),
    });
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return EMPTY;
    const p = JSON.parse(m[0]) as Record<string, unknown>;
    const s = (v: unknown): string | null => {
      const t = typeof v === 'string' ? v.trim() : '';
      return t && t.toLowerCase() !== 'null' && t !== 'outro' ? t : null;
    };
    return {
      pest: s(p.pest),
      crop: s(p.crop),
      stage: s(p.stage),
      symptom: s(p.symptom),
      area: s(p.area),
      applied: s(p.applied),
      when: s(p.when),
    };
  } catch (e) {
    log.error('extractBriefFields failed:', (e as Error).message);
    return EMPTY;
  }
}

/**
 * Compose the briefing text from profile + extracted fields. Pure and
 * deterministic (Agrofit reads are from bundled data) — the compliance
 * guarantees live here: groups + count only, never a product or dose.
 */
export function composeBrief(profile: FarmProfile, f: BriefFields): string {
  // Crops can arrive pipe/comma-joined ("soja|milho") from either the profile or
  // the extractor — normalise to a clean "soja e milho".
  const clean = (s: string): string =>
    s.split(/[|,/]/).map((x) => x.trim()).filter(Boolean).join(' e ');
  const rawCrop = f.crop ?? (profile.crop && profile.crop.length ? profile.crop.join(' e ') : null);
  const cropLabel = rawCrop ? clean(rawCrop) : null;
  const local = profile.uf ?? null;

  const hit = f.pest ? groundedHit(f.crop, f.pest, profile.crop) : null;
  const groups = hit ? chemicalGroups(hit) : [];

  const lines: string[] = ['📋 *Resumo pra levar ao agrônomo*', ''];

  lines.push(`• *Cultura/local:* ${[cropLabel, local].filter(Boolean).join(' · ') || 'a confirmar'}`);
  lines.push(`• *O que observei:* ${f.symptom ?? f.pest ?? 'a confirmar (mando foto)'}`);
  if (f.pest) lines.push(`• *Suspeita:* ${f.pest}`);
  if (f.stage) lines.push(`• *Estágio da lavoura:* ${f.stage}`);
  if (f.area) lines.push(`• *Área afetada:* ${f.area}`);
  if (f.applied) lines.push(`• *Já apliquei:* ${f.applied}`);
  if (f.when) lines.push(`• *Quando:* ${f.when}`);

  // What's registered — groups + count only, for the pro to decide from. No dose.
  if (hit) {
    const grp = groups.length ? ` (grupos: ${groups.join(', ')})` : '';
    lines.push(
      '',
      `_Referência Agrofit/MAPA: ${hit.entry.products} produtos registrados pra ${f.pest} em ${hit.crop}${grp}. A escolha do produto e da dose é do agrônomo, no receituário._`
    );
  }

  // Nudge the farmer to fill the gaps that make a briefing actually useful.
  const missing: string[] = [];
  if (!f.stage) missing.push('estágio da lavoura');
  if (!f.area) missing.push('quanto da área tá afetado');
  if (!f.applied) missing.push('o que você já aplicou');
  if (missing.length) {
    lines.push('', `Pra ficar completo, me conta (ou já leva anotado): ${missing.join(', ')}.`);
  }

  lines.push('', 'É só encaminhar essa mensagem pro seu agrônomo — ele já chega sabendo do caso. 👊');
  return lines.join('\n');
}

/**
 * Build the agrônomo briefing for a user from their profile + recent messages.
 * Never throws; on thin data it still returns a useful skeleton that tells the
 * farmer what to add.
 */
export async function buildAgronomoBrief(userId: string | null): Promise<string> {
  if (!userId) {
    return 'Posso montar um resumo pra você levar ao agrônomo — mas primeiro me conta o básico: o que você tá vendo na lavoura, a cultura e há quanto tempo. Pode mandar foto também. 🌱';
  }
  try {
    const [profile, recent] = await Promise.all([
      getFarmProfile(userId),
      getRecentInboundText(userId, 12),
    ]);
    const convo = [...recent].reverse().join('\n'); // chronological
    const fields = convo ? await extractBriefFields(convo) : EMPTY;
    return composeBrief(profile, fields);
  } catch (e) {
    log.error('buildAgronomoBrief failed:', (e as Error).message);
    return composeBrief({ uf: null, crop: null }, EMPTY);
  }
}
