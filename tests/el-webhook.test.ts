/**
 * Webhook pós-chamada do ElevenLabs — assinatura e parsing.
 *
 * A assinatura segue o padrão Stripe-like: header `ElevenLabs-Signature` com
 * `t=<unix>,v0=<hmac_sha256_hex>`, onde o HMAC assina `${t}.${rawBody}` com o
 * webhook secret. Validação de timestamp evita replay.
 *
 * Por que a verificação é inegociável: este endpoint grava no banco e liga
 * chamadas a prospects. Sem assinatura, qualquer um que descubra a URL injeta
 * "conversas" falsas na nossa base — e já aprendemos em 03/ago que canal sem
 * verificação de ponta a ponta é suposição, não canal.
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyElSignature, parseElEvent, TOLERANCIA_SEGS } from '../api/_lib/voice/elWebhook';

const SECRET = 'whsec_teste';
const agora = 1_800_000_000; // epoch fixo pros testes

function assinar(body: string, t: number, secret = SECRET): string {
  const mac = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v0=${mac}`;
}

describe('verifyElSignature', () => {
  const body = '{"type":"post_call_transcription"}';

  it('aceita assinatura válida dentro da janela', () => {
    expect(verifyElSignature(body, assinar(body, agora - 60), SECRET, agora)).toBe(true);
  });

  it('recusa HMAC errado — secret diferente', () => {
    expect(verifyElSignature(body, assinar(body, agora, 'outro_secret'), SECRET, agora)).toBe(false);
  });

  it('recusa corpo adulterado', () => {
    expect(verifyElSignature('{"hack":1}', assinar(body, agora), SECRET, agora)).toBe(false);
  });

  it('recusa timestamp velho — replay', () => {
    const velho = agora - TOLERANCIA_SEGS - 10;
    expect(verifyElSignature(body, assinar(body, velho), SECRET, agora)).toBe(false);
  });

  it('recusa header ausente ou malformado, sem lançar', () => {
    expect(verifyElSignature(body, undefined, SECRET, agora)).toBe(false);
    expect(verifyElSignature(body, 'lixo', SECRET, agora)).toBe(false);
    expect(verifyElSignature(body, 't=abc,v0=', SECRET, agora)).toBe(false);
  });
});

describe('parseElEvent — o que gravamos de cada tipo', () => {
  it('transcription: extrai ids, telefone, duração, custo, resumo', () => {
    const ev = parseElEvent(
      JSON.stringify({
        type: 'post_call_transcription',
        event_timestamp: agora,
        data: {
          agent_id: 'ag_1',
          conversation_id: 'conv_1',
          status: 'done',
          transcript: [{ role: 'agent', message: 'oi' }],
          metadata: {
            call_duration_secs: 187,
            cost: 42,
            phone_call: { external_number: '+5535999887766' },
          },
          analysis: { transcript_summary: 'Prospect pediu retorno amanhã.' },
        },
      })
    );
    expect(ev).toMatchObject({
      tipo: 'transcription',
      elAgentId: 'ag_1',
      elConversationId: 'conv_1',
      phone: '+5535999887766',
      durationSecs: 187,
      costCredits: 42,
      summary: 'Prospect pediu retorno amanhã.',
    });
  });

  it('failure: guarda o motivo', () => {
    const ev = parseElEvent(
      JSON.stringify({
        type: 'post_call_failure',
        data: { agent_id: 'ag_1', conversation_id: 'conv_2', failure_reason: 'no_answer' },
      })
    );
    expect(ev).toMatchObject({ tipo: 'failure', elConversationId: 'conv_2', failureReason: 'no_answer' });
  });

  it('tipo desconhecido ou JSON inválido devolvem null — nunca lançam', () => {
    expect(parseElEvent('{"type":"algo_novo","data":{}}')).toBeNull();
    expect(parseElEvent('não é json')).toBeNull();
  });

  it('transcription sem telefone não explode — chamada de widget/web não tem número', () => {
    const ev = parseElEvent(
      JSON.stringify({ type: 'post_call_transcription', data: { agent_id: 'a', conversation_id: 'c', metadata: {} } })
    );
    expect(ev?.phone).toBeNull();
  });
});
