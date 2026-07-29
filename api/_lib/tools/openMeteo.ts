/**
 * Roteamento das chamadas ao Open-Meteo entre o tier grátis e o pago.
 *
 * Por que existe: os termos do tier grátis proíbem uso comercial de forma
 * explícita — "You may only use the free API services for non-commercial
 * purposes" — e a Stevi é produto comercial. O Open-Meteo sustenta o clima, o
 * Delta T da janela de pulverização e o alerta de geada, então o risco não é
 * de disponibilidade: é jurídico, e some no dia em que a assinatura existir.
 *
 * O plano pago troca o host por `customer-<host>` e passa `apikey` na query.
 * Com OPEN_METEO_API_KEY setada, tudo aqui migra de uma vez; sem ela, nada
 * muda. Uma env var de distância, de propósito — a assinatura é decisão de
 * quem paga, não do código.
 */

export type OpenMeteoHost = 'api' | 'geocoding-api';

const limpa = (k: string | undefined | null): string | null => {
  const t = (k ?? '').trim();
  return t ? t : null;
};

/** Se ainda estamos no tier que proíbe uso comercial. */
export function usandoTierGratis(apiKey: string | undefined | null): boolean {
  return limpa(apiKey) === null;
}

/**
 * Monta a URL do Open-Meteo. Puro: recebe a chave em vez de ler o env, para o
 * roteamento ser testável sem mexer em process.env.
 *
 * `params` aceita array para os campos que a API repete (hourly, daily) —
 * usar um objeto simples ali sobrescreveria e a resposta viria sem metade dos
 * campos, silenciosamente.
 */
export function openMeteoUrl(
  host: OpenMeteoHost,
  path: string,
  params: Record<string, string | number | string[]>,
  apiKey: string | undefined | null
): string {
  const key = limpa(apiKey);
  const h = key ? `customer-${host}` : host;
  const url = new URL(`https://${h}.open-meteo.com${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, String(item));
    else url.searchParams.set(k, String(v));
  }
  if (key) url.searchParams.set('apikey', key);
  return url.toString();
}

/** A chave de produção, ou null enquanto a assinatura não existir. */
export function openMeteoKey(): string | null {
  return limpa(process.env.OPEN_METEO_API_KEY);
}

/**
 * URL pronta a partir de um URLSearchParams já montado — o formato que os
 * call sites (weather/frost/geo) já usam. NÃO muta o params recebido: o
 * chamador reusa o objeto em retries, e enfiar a apikey nele acumularia.
 */
export function openMeteoRequestUrl(host: OpenMeteoHost, path: string, params: URLSearchParams): string {
  const key = openMeteoKey();
  const h = key ? `customer-${host}` : host;
  const q = new URLSearchParams(params);
  if (key) q.set('apikey', key);
  return `https://${h}.open-meteo.com${path}?${q.toString()}`;
}
