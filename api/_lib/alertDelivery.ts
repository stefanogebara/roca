/**
 * Auto-verificação do alerta — o alarme que sabe se tocou.
 *
 * Contexto (03/ago): o canal de alerta da empresa estava morto havia semanas
 * e ninguém percebeu, porque a API de mensagem devolve "accepted" e falha
 * depois, assincronamente. Incidente de webhook, canário, LLM caindo e lead
 * quente apontavam todos pro mesmo cano mudo.
 *
 * O mecanismo: todo alerta enviado por WhatsApp grava o wamid; o callback de
 * status da Meta (que já chega no nosso webhook) marca a entrega; e uma
 * varredura no cron escala por OUTRO canal o que ficou pendente tempo demais.
 * Aceite não é entrega — aqui isso é código, não boa intenção.
 */

import { getDb } from './db';
import { createLogger } from './logger';

const log = createLogger('alert-delivery');

/**
 * Quanto esperar o callback antes de considerar o alerta perdido.
 *
 * A Meta costuma confirmar em segundos, mas celular desligado ou sem sinal
 * atrasa legitimamente. 15 min é folgado o bastante pra não gerar escalada
 * falsa e curto o bastante pra um alerta de incidente ainda ter valor quando
 * chegar pelo segundo canal.
 */
export const JANELA_ENTREGA_MIN = 15;

export type VeredictoCallback = 'entregue' | 'pendente' | 'falhou';

/**
 * O que o status da Meta diz sobre a entrega.
 *
 * 'sent' é deliberadamente PENDENTE, não entregue: é o equivalente Meta do
 * "queued" do Twilio que nos enganou por semanas — significa "saiu daqui",
 * não "chegou nele".
 */
export function classificarCallback(status: string): VeredictoCallback {
  if (status === 'delivered' || status === 'read') return 'entregue';
  if (status === 'failed') return 'falhou';
  return 'pendente';
}

export interface AlertaPendente {
  id: string;
  created_at: string;
  delivered_at: string | null;
  escalated_at: string | null;
}

/** Se este alerta ficou no limbo tempo demais e merece outro canal. Pura. */
export function precisaEscalar(a: AlertaPendente, agora: Date = new Date()): boolean {
  if (a.delivered_at || a.escalated_at) return false;
  return agora.getTime() - Date.parse(a.created_at) > JANELA_ENTREGA_MIN * 60_000;
}

/**
 * Registra um alerta enviado. `wamid` null = canal sem rastreio (webhook,
 * e-mail): nasce já entregue, porque ali o próprio retorno da chamada é a
 * confirmação. Fail-soft: não conseguir registrar nunca derruba o alerta.
 */
export async function registrarAlerta(
  canal: string,
  texto: string,
  wamid: string | null
): Promise<void> {
  try {
    const { error } = await getDb()
      .from('founder_alerts')
      .insert({
        canal,
        texto: texto.slice(0, 2000),
        wamid,
        delivered_at: wamid ? null : new Date().toISOString(),
      });
    if (error) log.error('registrarAlerta falhou:', error.message);
  } catch (e) {
    log.error('registrarAlerta falhou:', (e as Error).message);
  }
}

/**
 * Casa os callbacks de status da Meta com os alertas gravados. Chamado do
 * webhook junto com o processamento de status dos prospects — o mesmo POST
 * carrega os dois.
 */
export async function aplicarStatusEmAlertas(
  statuses: Array<{ wamid: string; status: string; errorDetail: string | null }>
): Promise<void> {
  const db = getDb();
  for (const s of statuses) {
    const v = classificarCallback(s.status);
    if (v === 'pendente') continue;
    try {
      const patch =
        v === 'entregue'
          ? { delivered_at: new Date().toISOString() }
          : { error_detail: s.errorDetail ?? 'failed' };
      // Sem .select(): a maioria dos wamid é de prospect, não de alerta — o
      // update simplesmente não casa e segue barato.
      const { error } = await db.from('founder_alerts').update(patch).eq('wamid', s.wamid);
      if (error) log.error('aplicarStatusEmAlertas falhou:', error.message);
    } catch (e) {
      log.error('aplicarStatusEmAlertas falhou:', (e as Error).message);
    }
  }
}

export interface VarreduraResultado {
  pendentes: number;
  escalados: number;
}

/**
 * Varredura: alerta que não confirmou entrega na janela vai por outro canal.
 *
 * O segundo canal é e-mail — o único com entrega comprovada em 03/ago. A
 * mensagem diz explicitamente que é reenvio, para o founder saber que o canal
 * principal falhou (isso é informação operacional, não ruído).
 */
export async function varrerAlertasNaoEntregues(
  agora: Date = new Date()
): Promise<VarreduraResultado> {
  const db = getDb();
  const { data, error } = await db
    .from('founder_alerts')
    .select('id, created_at, delivered_at, escalated_at, texto')
    .is('delivered_at', null)
    .is('escalated_at', null)
    .limit(50);
  if (error) {
    log.error('varredura falhou:', error.message);
    return { pendentes: 0, escalados: 0 };
  }
  const rows = (data ?? []) as Array<AlertaPendente & { texto: string }>;
  const alvos = rows.filter((r) => precisaEscalar(r, agora));
  let escalados = 0;
  for (const r of alvos) {
    try {
      const { sendFounderAlertEmail } = await import('./notify');
      const ok = await sendFounderAlertEmail(
        `[reenvio] O alerta abaixo não confirmou entrega no WhatsApp em ${JANELA_ENTREGA_MIN} min:\n\n${r.texto}`
      );
      // Marca mesmo se o e-mail falhar: insistir em loop não conserta canal
      // quebrado, e o log já registra. Repetir a cada varredura só faria a
      // tabela crescer e o alerta virar ruído.
      await db.from('founder_alerts').update({ escalated_at: new Date().toISOString() }).eq('id', r.id);
      if (ok) escalados++;
      else log.error('escalada por e-mail também falhou para o alerta', r.id);
    } catch (e) {
      log.error('escalada falhou:', (e as Error).message);
    }
  }
  if (alvos.length) log.info(`varredura de alertas: ${alvos.length} pendentes, ${escalados} escalados`);
  return { pendentes: alvos.length, escalados };
}
