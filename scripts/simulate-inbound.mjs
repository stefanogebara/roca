/**
 * Simula um inbound ASSINADO contra o webhook, sem precisar de celular.
 *
 * Twilio (default, legado):
 *   node scripts/simulate-inbound.mjs "posso pulverizar hoje?"
 * Meta Cloud API (o transporte ATIVO em produção):
 *   node scripts/simulate-inbound.mjs --cloud "posso pulverizar hoje?"
 *
 * Opções:
 *   --cloud                 assina como Meta (X-Hub-Signature-256) em vez de Twilio
 *   --url=<url>             alvo (default: produção). Use um preview pra ensaiar
 *                           sem mexer em dado de produtor
 *   --bad-signature         confirma o 403
 *   --from=+5511999990000   remetente
 *   --location=-12.5,-55.7  manda um pin
 *   --media-url=<url>       foto pelo Twilio (URL)
 *   --media-id=<id>         foto pelo Cloud (id de mídia — o Cloud não usa URL)
 *   --media-type=<mime>     default image/jpeg
 *   --voice                 nota de voz (com --media-id no Cloud)
 *   --sid=<id>              id da mensagem (default gerado)
 *
 * Lê .env: TWILIO_AUTH_TOKEN no caminho Twilio; WHATSAPP_APP_SECRET e
 * WHATSAPP_CLOUD_PHONE_NUMBER_ID no caminho Cloud.
 *
 * AVISO: por default isto bate em PRODUÇÃO. Cria linha em `users`, gasta LLM e
 * tenta responder ao número que você informar. Use --url= com um preview, ou um
 * --from= que seja seu.
 */

import { readFileSync } from 'node:fs';
import { buildTwilioPost, buildCloudPost } from './simulate-payload.mjs';

const DEFAULT_URL = 'https://roca-black.vercel.app/api/webhook';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => (l.split('=', 2).length === 2 ? [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()] : null))
    .filter(Boolean)
);

const arg = (name, fallback = null) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const cloud = flag('cloud');
const badSignature = flag('bad-signature');
const url = arg('url', DEFAULT_URL);
const from = arg('from', '+5511999990000');
const messageId = arg('sid', cloud ? `wamid.SIM${Date.now()}` : `SMsim${Date.now()}`);
const locArg = arg('location');
const mediaId = arg('media-id');
const mediaUrl = arg('media-url');
const mediaMime = arg('media-type', 'image/jpeg');
const text = process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) ?? 'posso pulverizar hoje?';

const kind = locArg ? 'location' : flag('voice') ? 'voice' : mediaId || mediaUrl ? 'image' : 'text';
const location = locArg
  ? { lat: Number(locArg.split(',')[0]), lon: Number(locArg.split(',')[1]) }
  : null;

let post;
if (cloud) {
  const appSecret = env.WHATSAPP_APP_SECRET;
  const phoneNumberId = env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  if (!appSecret || !phoneNumberId) {
    console.error('faltando WHATSAPP_APP_SECRET e/ou WHATSAPP_CLOUD_PHONE_NUMBER_ID no .env');
    process.exit(1);
  }
  if (mediaUrl && !mediaId) {
    console.error('no Cloud a mídia é ID, não URL — use --media-id=<id> (a Meta não aceita URL aqui)');
    process.exit(1);
  }
  post = buildCloudPost({
    appSecret,
    phoneNumberId,
    from,
    messageId,
    kind,
    text: kind === 'text' || kind === 'image' ? text : null,
    mediaId,
    mediaMime: kind === 'voice' ? arg('media-type') : mediaMime,
    location,
    timestamp: Math.floor(Date.now() / 1000),
    badSignature,
  });
} else {
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('faltando TWILIO_AUTH_TOKEN no .env');
    process.exit(1);
  }
  const params = {
    From: `whatsapp:${from}`,
    To: env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886',
    Body: kind === 'text' ? text : '',
    MessageSid: messageId,
    NumMedia: mediaUrl ? '1' : '0',
    ProfileName: 'Simulador Roca',
  };
  if (location) {
    params.Latitude = String(location.lat);
    params.Longitude = String(location.lon);
  }
  if (mediaUrl) {
    params.MediaUrl0 = mediaUrl;
    params.MediaContentType0 = mediaMime;
  }
  post = buildTwilioPost({ url, params, authToken, badSignature });
}

if (flag('dry-run')) {
  // Mostra o que sairia, sem sair. Serve pra conferir o formato e pra não ter
  // que usar produção como ensaio só pra ver se o comando está certo.
  console.log(`transporte=${cloud ? 'cloud' : 'twilio'} alvo=${url} (dry-run, nada enviado)`);
  console.log(`headers: ${JSON.stringify(post.headers, null, 2)}`);
  console.log(`body: ${post.body}`);
  process.exit(0);
}

const started = Date.now();
const res = await fetch(url, { method: 'POST', headers: post.headers, body: post.body });
const elapsed = Date.now() - started;
const respText = await res.text();
console.log(`transporte=${cloud ? 'cloud' : 'twilio'} status=${res.status} elapsed=${elapsed}ms`);
console.log(`body: ${respText.slice(0, 300)}`);
