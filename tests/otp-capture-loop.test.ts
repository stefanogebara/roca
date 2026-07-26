/**
 * The capture loop's survival contract.
 *
 * This is the regression for 26/07: once Meta has placed the verification
 * call, the code EXISTS in a Twilio recording. A network blip while polling
 * must cost one iteration — never the run — because giving up there burns
 * Meta's request_code cooldown for nothing.
 *
 * The loop lives inside otp-capture.mjs (a CLI that runs main() on import), so
 * this test rebuilds the same poll shape over the real fetchJsonWithRetry and
 * the real extraction rule, and drives it with an injected fetch.
 */
import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error — plain .mjs helper, no types
import { fetchJsonWithRetry } from '../scripts/otp-net.mjs';

const connectTimeout = () => {
  const e = new TypeError('fetch failed');
  (e as unknown as { cause: { code: string } }).cause = { code: 'UND_ERR_CONNECT_TIMEOUT' };
  return e;
};
const ok = (body: unknown) => ({ status: 200, json: async () => body });

/** Same digit rule as otp-capture.mjs. */
function extractCode(text: string): string | null {
  const m = text.replace(/\s+/g, '').match(/(\d{6})/);
  return m ? m[1] : null;
}

/** The hardened poll: transport failure costs an iteration, not the run. */
async function pollForCode(fetchImpl: unknown, maxRounds = 6): Promise<string | null> {
  const cfg = { fetchImpl, sleepImpl: async () => {}, attempts: 2, label: 'twilio' };
  for (let i = 0; i < maxRounds; i++) {
    let recs, trs;
    try {
      recs = await fetchJsonWithRetry('https://api.twilio.com/Recordings.json', {}, cfg);
    } catch {
      continue; // network blip — try again next round
    }
    const rec = (recs.recordings ?? [])[0];
    if (!rec) continue;
    try {
      trs = await fetchJsonWithRetry(`https://api.twilio.com/${rec.sid}/Transcriptions.json`, {}, cfg);
    } catch {
      continue;
    }
    const t = (trs.transcriptions ?? [])[0];
    if (!t || t.status !== 'completed') continue;
    const code = extractCode(t.transcription_text ?? '');
    if (code) return code;
  }
  return null;
}

describe('capture loop survives the network', () => {
  it('extracts the code even when every poll round starts with a connect timeout', async () => {
    const fetchImpl = vi
      .fn()
      // round 1: listing dies twice (exhausts retries) → loop must continue
      .mockRejectedValueOnce(connectTimeout())
      .mockRejectedValueOnce(connectTimeout())
      // round 2: listing works, transcription dies twice → loop must continue
      .mockResolvedValueOnce(ok({ recordings: [{ sid: 'RE1' }] }))
      .mockRejectedValueOnce(connectTimeout())
      .mockRejectedValueOnce(connectTimeout())
      // round 3: everything lands
      .mockResolvedValueOnce(ok({ recordings: [{ sid: 'RE1' }] }))
      .mockResolvedValueOnce(
        ok({ transcriptions: [{ status: 'completed', transcription_text: 'your code is 779083.' }] })
      );

    await expect(pollForCode(fetchImpl)).resolves.toBe('779083');
  });

  it('keeps polling while the transcription is still pending', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ recordings: [{ sid: 'RE1' }] }))
      .mockResolvedValueOnce(ok({ transcriptions: [{ status: 'in-progress', transcription_text: '' }] }))
      .mockResolvedValueOnce(ok({ recordings: [{ sid: 'RE1' }] }))
      .mockResolvedValueOnce(
        ok({ transcriptions: [{ status: 'completed', transcription_text: 'code is 112233' }] })
      );

    await expect(pollForCode(fetchImpl)).resolves.toBe('112233');
  });

  it('returns null (never throws) when the network is down for the whole window', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(connectTimeout());
    await expect(pollForCode(fetchImpl, 3)).resolves.toBeNull();
  });
});
