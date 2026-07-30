// Payload + signature builders for simulate-inbound.mjs.
//
// Separado do executável e sem efeito colateral (nada de rede, nada de ler env)
// por um motivo: assim os testes conseguem alimentar os ADAPTERS DE VERDADE com
// o que o simulador produz (tests/simulate-inbound.test.ts). Um simulador que
// desgarra do verificador é pior que nenhum — ele devolve 200 no ensaio e a
// produção responde 403, e você vai procurar o bug no lugar errado.
//
// Os dois transportes assinam coisas diferentes:
//   Twilio → HMAC-SHA1 sobre URL + params ordenados por chave, em base64.
//            A URL importa: o adapter reconstrói dos headers `host` + `req.url`.
//   Meta   → HMAC-SHA256 sobre os BYTES CRUS do corpo, hex, prefixado `sha256=`.
//            Daí o corpo ser serializado UMA vez e assinado como string: quem
//            reserializa antes de mandar assina uma coisa e envia outra.

import { createHmac } from 'node:crypto';

/** Twilio: URL + params ordenados, chave+valor concatenados, HMAC-SHA1, base64. */
export function twilioSignature(authToken, url, params) {
  const sorted = Object.keys(params).sort();
  const payload = url + sorted.map((k) => k + params[k]).join('');
  return createHmac('sha1', authToken).update(payload).digest('base64');
}

/** Meta: `sha256=` + HMAC-SHA256 sobre o corpo cru, em hex. */
export function cloudSignature(appSecret, rawBody) {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
}

export function buildTwilioPost({ url, params, authToken, badSignature = false }) {
  return {
    body: new URLSearchParams(params).toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Signature': badSignature
        ? 'obviously-wrong'
        : twilioSignature(authToken, url, params),
    },
  };
}

/**
 * A mensagem no formato da Meta. O adapter lê uma fatia estreita disso —
 * `firstMessage()` em api/_lib/transport/cloud.ts — mas vale montar o envelope
 * realista, senão o simulador ensaia um formato que a Meta não manda.
 *
 * Mídia no Cloud é ID, não URL (o Twilio manda URL). É a diferença que obriga a
 * retestar foto e áudio na virada: `fetchMedia` resolve id → URL → bytes.
 */
export function buildCloudMessage({
  from,
  messageId,
  kind = 'text',
  text = null,
  mediaId = null,
  mediaMime = null,
  location = null,
  timestamp,
}) {
  // A Meta manda o número SEM `+` (o Twilio manda `whatsapp:+55…`). Não é
  // detalhe cosmético: `upsertUser(msg.from, …)` grava o valor cru, então o
  // mesmo produtor vira DUAS linhas em `users` se o transporte mudar. O
  // simulador copia a Meta pra ensaiar o que a produção realmente recebe.
  const waId = String(from).replace(/^\+/, '');
  const msg = { from: waId, id: messageId, timestamp: String(timestamp) };

  switch (kind) {
    case 'image':
      return { ...msg, type: 'image', image: { id: mediaId, mime_type: mediaMime, ...(text ? { caption: text } : {}) } };
    case 'voice':
      // O adapter aceita `audio` e `voice`; nota de voz real do WhatsApp chega
      // como `audio` com voice=true, então é esse o caso que vale ensaiar.
      return { ...msg, type: 'audio', audio: { id: mediaId, mime_type: mediaMime ?? 'audio/ogg; codecs=opus', voice: true } };
    case 'location':
      return { ...msg, type: 'location', location: { latitude: location.lat, longitude: location.lon } };
    default:
      return { ...msg, type: 'text', text: { body: text } };
  }
}

export function buildCloudPost({
  appSecret,
  phoneNumberId,
  wabaId = '0',
  displayPhoneNumber = '',
  profileName = 'Simulador Roca',
  badSignature = false,
  ...message
}) {
  const msg = buildCloudMessage(message);
  const envelope = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: wabaId,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              // phone_number_id é o que o adapter guarda pra responder (e pra
              // marcar como lido) PELO MESMO número que recebeu.
              metadata: { display_phone_number: displayPhoneNumber, phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: profileName }, wa_id: msg.from }],
              messages: [msg],
            },
          },
        ],
      },
    ],
  };

  const body = JSON.stringify(envelope);
  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': badSignature ? 'sha256=deadbeef' : cloudSignature(appSecret, body),
    },
  };
}
