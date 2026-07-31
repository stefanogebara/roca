/**
 * Enriquecimento automático de WhatsApp a partir do site do prospect.
 *
 * A alavanca, medida nos 42 envios reais (30/jul): 8 dos 9 templates LIDOS
 * foram para números enriquecidos — ~38% de leitura entre enriquecidos contra
 * ~5% nos números crus do Places. O funil não morria no texto; morria em fixo
 * de balcão que ninguém olha. Enriquecer era manual; isto automatiza no
 * sourcing.
 *
 * Regra do core (sendablePhone): wa_phone exige evidência POSITIVA e citada.
 * Só contam links de WhatsApp publicados pelo próprio negócio (wa.me,
 * api.whatsapp.com, whatsapp://) — tel: e celular solto em texto ficam de fora
 * de propósito: celular existe sem WhatsApp, e um falso "zap confirmado" vira
 * envio que queima a reputação do nosso número.
 */

import { normalizePhoneBR, isMobileBR } from './core';
import { createLogger } from '../logger';

const log = createLogger('prospect-enrich');

// Links que o próprio negócio publica apontando pro WhatsApp dele.
const WA_LINK_RE =
  /(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?[^"'\s>]*?phone=|whatsapp:\/\/send\/?\?[^"'\s>]*?phone=)\+?(\d{10,15})/gi;

/**
 * Extrai o WhatsApp citado num HTML. Vários links: prefere celular (entrega
 * medida maior), senão o primeiro válido. Null quando não há evidência.
 */
export function extrairWhatsAppDeHtml(html: string): string | null {
  const achados: string[] = [];
  for (const m of (html ?? '').matchAll(WA_LINK_RE)) {
    const norm = normalizePhoneBR(m[1]);
    if (norm && !achados.includes(norm)) achados.push(norm);
  }
  if (!achados.length) return null;
  return achados.find(isMobileBR) ?? achados[0];
}

const FETCH_TIMEOUT_MS = 6_000;
const MAX_HTML_BYTES = 300_000;

/**
 * Busca o site e procura o WhatsApp citado. Fail-soft por construção: site
 * fora do ar, lento ou gigante devolve null e o sourcing segue — enriquecer é
 * bônus, nunca bloqueio.
 */
export async function enriquecerDoSite(url: string): Promise<{ waPhone: string; fonte: string } | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  try {
    const res = await fetch(parsed.href, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SteviBot/1.0; +https://roca-black.vercel.app)' },
    });
    if (!res.ok) return null;
    // Cap de tamanho lendo o stream: text() numa página gigante estoura memória
    // de function por causa de um site ruim.
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    void reader.cancel().catch(() => undefined);
    const html = new TextDecoder('utf-8', { fatal: false }).decode(
      chunks.length === 1 ? chunks[0] : concat(chunks, total)
    );
    const waPhone = extrairWhatsAppDeHtml(html);
    return waPhone ? { waPhone, fonte: parsed.href.slice(0, 300) } : null;
  } catch (e) {
    log.info(`enrich fetch falhou (${parsed.hostname}): ${(e as Error).message}`);
    return null;
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c.subarray(0, Math.min(c.byteLength, total - off)), off);
    off += c.byteLength;
    if (off >= total) break;
  }
  return out;
}
