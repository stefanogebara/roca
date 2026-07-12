// Autonomous voice-OTP capture for the BR number Meta registration.
// Waits out Meta's request_code cooldown, then: request_code (VOICE) → wait for
// Twilio to record Meta's spoken code on the fixed single-doc TwiML → poll the
// recording's transcription → extract the 6-digit code. Retries on throttle.
// Prints CODE=xxxxxx on success (or STILL_THROTTLED / NO_CODE) and exits.

// Secrets come from the gitignored .env (never hardcoded here — this file lives
// under scripts/ which is tracked, so a hardcoded token could leak on commit).
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

const META_TOKEN = env.WHATSAPP_CLOUD_TOKEN;
const TW_SID = env.TWILIO_ACCOUNT_SID;
const TW_TOK = env.TWILIO_AUTH_TOKEN;
const PNID = process.env.BR_PHONE_NUMBER_ID || '1183924088140958';
const TWIML = 'https://roca-black.vercel.app/api/twiml-otp';

if (!META_TOKEN || !TW_SID || !TW_TOK) {
  console.error('Missing WHATSAPP_CLOUD_TOKEN / TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (m) => console.log(`[${ts()}] ${m}`);
const twAuth = 'Basic ' + Buffer.from(`${TW_SID}:${TW_TOK}`).toString('base64');

async function warm() {
  await Promise.all([0, 0, 0, 0].map(() => fetch(TWIML).catch(() => {})));
}

async function requestCode() {
  const body = new URLSearchParams({ code_method: 'VOICE', language: 'en_US', access_token: META_TOKEN });
  const r = await fetch(`https://graph.facebook.com/v21.0/${PNID}/request_code`, { method: 'POST', body });
  return r.json();
}

async function latestRecordingAfter(sinceMs) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Recordings.json?PageSize=3`, {
    headers: { Authorization: twAuth },
  });
  const j = await r.json();
  const recs = j.recordings || [];
  for (const rec of recs) {
    const created = Date.parse(rec.date_created);
    if (created >= sinceMs - 5000) return rec;
  }
  return null;
}

async function transcriptionText(recSid) {
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Recordings/${recSid}/Transcriptions.json`,
    { headers: { Authorization: twAuth } }
  );
  const j = await r.json();
  const t = (j.transcriptions || [])[0];
  return t ? { status: t.status, text: t.transcription_text || '' } : null;
}

function extractCode(text) {
  if (!text) return null;
  const compact = text.replace(/\s+/g, '');
  const m = compact.match(/(\d{6})/);
  return m ? m[1] : null;
}

async function captureAfterCall(reqMs) {
  // Meta places the call within ~30s; recording + transcription follow.
  for (let i = 1; i <= 25; i++) {
    await sleep(15000);
    const rec = await latestRecordingAfter(reqMs);
    if (!rec) {
      log(`  capture ${i}: no fresh recording yet`);
      continue;
    }
    const tr = await transcriptionText(rec.sid);
    if (!tr) {
      log(`  capture ${i}: rec ${rec.sid} (dur ${rec.duration}s) transcription not created yet`);
      continue;
    }
    // Mask digits in the diagnostic line so partial codes don't sit in logs;
    // the confirmed code is emitted once, below, only on success.
    const masked = tr.text.replace(/\d/g, '•');
    log(`  capture ${i}: rec ${rec.sid} dur=${rec.duration}s status=${tr.status} text=${JSON.stringify(masked)}`);
    if (tr.status === 'completed') {
      const code = extractCode(tr.text);
      if (code) {
        console.log(`CODE=${code}`);
        return code;
      }
      log('  transcription completed but no 6-digit code found (bad/clipped recording)');
      return null; // this attempt's recording is unusable
    }
    if (tr.status === 'failed') {
      log('  transcription failed');
      return null;
    }
  }
  log('  gave up waiting for transcription');
  return null;
}

async function main() {
  const INITIAL_WAIT_MIN = Number(process.argv[2] || 75);
  log(`initial wait ${INITIAL_WAIT_MIN} min to clear Meta cooldown...`);
  await sleep(INITIAL_WAIT_MIN * 60 * 1000);

  for (let attempt = 1; attempt <= 5; attempt++) {
    log(`attempt ${attempt}: warming + request_code`);
    await warm();
    const reqMs = Date.now();
    const res = await requestCode();
    if (res.success) {
      log('request_code SUCCESS — Meta is calling the number now');
      const code = await captureAfterCall(reqMs);
      if (code) {
        log(`DONE — captured code ${code}`);
        return;
      }
      log('capture failed this round; will retry request_code after a short spacing');
      await sleep(20 * 60 * 1000);
      continue;
    }
    const code = res.error?.code;
    log(`request_code throttled/failed: ${code} ${res.error?.error_user_msg || res.error?.message || ''}`);
    if (attempt < 5) {
      log('waiting 20 min before next attempt...');
      await sleep(20 * 60 * 1000);
    }
  }
  console.log('STILL_THROTTLED');
  log('exhausted attempts — Meta still throttling');
}

main().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
