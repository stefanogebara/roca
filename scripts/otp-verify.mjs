// Finish the BR number registration: POST verify_code with the 6-digit code
// captured by otp-capture.mjs (which only *gets* the code — this is the step
// that actually flips the number out of PENDING).
//
//   node scripts/otp-verify.mjs 123456
//
// Secrets come from the gitignored .env — never hardcode a token in scripts/,
// which is tracked.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function loadEnv() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = loadEnv();
const TOKEN = env.WHATSAPP_CLOUD_TOKEN;
const PNID = process.env.BR_PHONE_NUMBER_ID || '1183924088140958';
const code = (process.argv[2] || '').replace(/\D/g, '');

if (!TOKEN) {
  console.error('Missing WHATSAPP_CLOUD_TOKEN in .env');
  process.exit(1);
}
if (code.length !== 6) {
  console.error('Usage: node scripts/otp-verify.mjs <6-digit code>');
  process.exit(1);
}

const G = 'https://graph.facebook.com/v21.0';

const verify = await fetch(`${G}/${PNID}/verify_code`, {
  method: 'POST',
  body: new URLSearchParams({ code, access_token: TOKEN }),
}).then((r) => r.json());

console.log('verify_code →', JSON.stringify(verify));

// Read the number back: the authoritative answer is its status, not the POST body.
const after = await fetch(
  `${G}/${PNID}?fields=display_phone_number,verified_name,status,code_verification_status,quality_rating&access_token=${encodeURIComponent(TOKEN)}`
).then((r) => r.json());

console.log('estado do número →', JSON.stringify(after, null, 1));

if (after.code_verification_status === 'VERIFIED') {
  console.log('\n✅ VERIFICADO. Próximo passo: registrar o número para a Cloud API');
  console.log(`   (POST ${PNID}/register com uma PIN de 6 dígitos), depois apontar`);
  console.log('   WHATSAPP_CLOUD_PHONE_NUMBER_ID para este id na Vercel.');
} else {
  console.log('\n⚠️ Ainda não verificado — o código pode ter expirado. Rode a captura de novo.');
}
