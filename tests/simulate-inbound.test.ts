/**
 * O simulador checado contra os adapters DE VERDADE.
 *
 * Sem isto, `simulate-inbound.mjs` é só uma opinião sobre o que a Meta manda: ele
 * responderia 200 no ensaio enquanto a produção devolveria 403, e o bug seria
 * procurado no lugar errado. Aqui o que o simulador monta passa por
 * `verifySignature` e `parseInbound` reais — se o contrato mudar de um lado, isto
 * fica vermelho.
 *
 * Fecha a lacuna registrada em .claude/plans/2026-07-30-virada-cloud-api §6: o
 * caminho que roda em produção (Cloud) não tinha simulador, só o legado (Twilio).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// @ts-expect-error — plain .mjs helper, no types
import { buildCloudPost, buildTwilioPost } from '../scripts/simulate-payload.mjs';
import { CloudApiAdapter } from '../api/_lib/transport/cloud';
import { TwilioAdapter } from '../api/_lib/transport/twilio';
import type { TransportRequest } from '../api/_lib/transport/types';

const URL_ALVO = 'https://roca-black.vercel.app/api/webhook';
const APP_SECRET = 'segredo-de-app-de-teste';
const AUTH_TOKEN = 'token-twilio-de-teste';
const PHONE_ID = '111222333';

/** Monta o TransportRequest como o Node entrega: header em minúscula. */
function paraRequest(post: { body: string; headers: Record<string, string> }): TransportRequest {
  const u = new URL(URL_ALVO);
  const headers: Record<string, string> = { host: u.host };
  for (const [k, v] of Object.entries(post.headers)) headers[k.toLowerCase()] = v;
  return { method: 'POST', headers, url: u.pathname, rawBody: Buffer.from(post.body) };
}

const cloudPost = (over: Record<string, unknown> = {}) =>
  buildCloudPost({
    appSecret: APP_SECRET,
    phoneNumberId: PHONE_ID,
    from: '+5511999990000',
    messageId: 'wamid.SIM1',
    kind: 'text',
    text: 'posso pulverizar hoje?',
    timestamp: 1_785_400_000,
    ...over,
  });

const envAntes = { ...process.env };
beforeEach(() => {
  process.env.WHATSAPP_APP_SECRET = APP_SECRET;
  process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
});
afterEach(() => {
  process.env = { ...envAntes };
});

describe('simulador do Cloud API', () => {
  it('produz assinatura que o adapter aceita', async () => {
    const ok = await new CloudApiAdapter().verifySignature(paraRequest(cloudPost()));
    expect(ok).toBe(true);
  });

  it('--bad-signature é rejeitado (o 403 que o script promete conferir)', async () => {
    const ok = await new CloudApiAdapter().verifySignature(
      paraRequest(cloudPost({ badSignature: true }))
    );
    expect(ok).toBe(false);
  });

  it('assinatura é sobre os BYTES enviados — reserializar o corpo invalida', async () => {
    const post = cloudPost();
    // Erro clássico: assinar um objeto e mandar outra serialização dele.
    const reserializado = { ...post, body: JSON.stringify(JSON.parse(post.body), null, 2) };
    expect(await new CloudApiAdapter().verifySignature(paraRequest(reserializado))).toBe(false);
  });

  it('texto: parseInbound lê from, id e corpo', async () => {
    const msg = await new CloudApiAdapter().parseInbound(paraRequest(cloudPost()));
    expect(msg).toMatchObject({
      from: '5511999990000',
      messageId: 'wamid.SIM1',
      kind: 'text',
      text: 'posso pulverizar hoje?',
    });
  });

  it('manda o número SEM `+`, como a Meta — é o que cria a linha em users', async () => {
    // Fidelidade que importa: o Twilio entrega `+55…` e a Meta `55…`, e o
    // upsertUser grava cru. Um simulador que mandasse `+` ensaiaria um wa_id
    // que a produção nunca vê.
    const msg = await new CloudApiAdapter().parseInbound(paraRequest(cloudPost()));
    expect(msg?.from.startsWith('+')).toBe(false);
  });

  it('carrega o phone_number_id do inbound — é dele que o markRead depende', async () => {
    const msg = await new CloudApiAdapter().parseInbound(paraRequest(cloudPost()));
    expect(msg?.toPhoneId).toBe(PHONE_ID);
  });

  it('foto: mídia é ID, não URL (a diferença que obriga a retestar na virada)', async () => {
    const msg = await new CloudApiAdapter().parseInbound(
      paraRequest(
        cloudPost({ kind: 'image', mediaId: 'media-abc', mediaMime: 'image/jpeg', text: 'que praga é essa?' })
      )
    );
    expect(msg).toMatchObject({
      kind: 'image',
      mediaUrl: 'media-abc',
      mediaMime: 'image/jpeg',
      text: 'que praga é essa?',
    });
  });

  it('nota de voz vira kind voice', async () => {
    const msg = await new CloudApiAdapter().parseInbound(
      paraRequest(cloudPost({ kind: 'voice', mediaId: 'audio-xyz', text: null }))
    );
    expect(msg?.kind).toBe('voice');
    expect(msg?.mediaUrl).toBe('audio-xyz');
  });

  it('pin vira location com lat/lon', async () => {
    const msg = await new CloudApiAdapter().parseInbound(
      paraRequest(cloudPost({ kind: 'location', location: { lat: -12.5, lon: -55.7 }, text: null }))
    );
    expect(msg).toMatchObject({ kind: 'location', location: { lat: -12.5, lon: -55.7 } });
  });
});

describe('simulador do Twilio (legado, mas não pode apodrecer)', () => {
  const twilioPost = (badSignature = false) =>
    buildTwilioPost({
      url: URL_ALVO,
      authToken: AUTH_TOKEN,
      badSignature,
      params: {
        From: 'whatsapp:+5511999990000',
        To: 'whatsapp:+14155238886',
        Body: 'posso pulverizar hoje?',
        MessageSid: 'SMsim1',
        NumMedia: '0',
        ProfileName: 'Simulador Roca',
      },
    });

  it('produz assinatura que o adapter aceita', async () => {
    expect(await new TwilioAdapter().verifySignature(paraRequest(twilioPost()))).toBe(true);
  });

  it('--bad-signature é rejeitado', async () => {
    expect(await new TwilioAdapter().verifySignature(paraRequest(twilioPost(true)))).toBe(false);
  });

  it('entrega o número COM `+` — o outro lado do racha de wa_id', async () => {
    const msg = await new TwilioAdapter().parseInbound(paraRequest(twilioPost()));
    expect(msg?.from).toBe('+5511999990000');
  });
});
