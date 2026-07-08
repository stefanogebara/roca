/**
 * Simulate a signed Twilio WhatsApp inbound POST against the deployed webhook.
 * Usage: node scripts/simulate-inbound.mjs [--bad-signature] ["message text"]
 * Reads TWILIO_AUTH_TOKEN from .env. Verifies the prod loop without a phone.
 */

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const WEBHOOK_URL = 'https://roca-black.vercel.app/api/webhook';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=', 2).length === 2 ? [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()] : null)
    .filter(Boolean)
);

const badSig = process.argv.includes('--bad-signature');
const locArg = process.argv.find((a) => a.startsWith('--location='));
const fromArg = process.argv.find((a) => a.startsWith('--from='));
const from = fromArg ? fromArg.split('=')[1] : '+5511999990000';
const text = process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) ?? 'posso pulverizar hoje?';

const params = {
  From: `whatsapp:${from}`,
  To: 'whatsapp:+14155238886',
  Body: locArg ? '' : text,
  MessageSid: (process.argv.find((a) => a.startsWith('--sid=')) || `--sid=SMsim${Date.now()}`).split('=')[1],
  NumMedia: '0',
  ProfileName: 'Simulador Roca',
};

if (locArg) {
  const [lat, lon] = locArg.split('=')[1].split(',');
  params.Latitude = lat;
  params.Longitude = lon;
}

const mediaUrlArg = process.argv.find((a) => a.startsWith('--media-url='));
const mediaTypeArg = process.argv.find((a) => a.startsWith('--media-type='));
if (mediaUrlArg) {
  params.NumMedia = '1';
  params.MediaUrl0 = mediaUrlArg.split('=').slice(1).join('=');
  params.MediaContentType0 = mediaTypeArg ? mediaTypeArg.split('=')[1] : 'image/jpeg';
  params.Body = '';
}

// Twilio signature: URL + params sorted by key, each key+value appended, HMAC-SHA1, base64.
const sorted = Object.keys(params).sort();
const payload = WEBHOOK_URL + sorted.map((k) => k + params[k]).join('');
const signature = badSig
  ? 'obviously-wrong'
  : createHmac('sha1', env.TWILIO_AUTH_TOKEN).update(payload).digest('base64');

const body = new URLSearchParams(params).toString();
const started = Date.now();
const res = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Twilio-Signature': signature,
  },
  body,
});
const elapsed = Date.now() - started;
const respText = await res.text();
console.log(`status=${res.status} elapsed=${elapsed}ms`);
console.log(`body: ${respText.slice(0, 300)}`);
