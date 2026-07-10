/**
 * TwiML endpoint used to register a Cloud API phone number: Meta places a voice
 * call that reads the 6-digit code aloud, Twilio hits this URL, and we record +
 * transcribe the audio so the code can be read from Twilio's transcription
 * (SMS OTP doesn't reach voice-only BR landlines). Returns static TwiML — no
 * secrets, no PII.
 *
 * Design note: a SINGLE self-contained document with NO `action` callback.
 * Record records immediately (no leading pause to clip the first digit), then
 * falls through to <Hangup/> in the same response. Because there is no second
 * HTTP request, nothing can 500 mid-call — an earlier version used an
 * `action="?done=1"` callback whose hiccup made Twilio speak "an application
 * error has occurred", which got captured in the recording instead of the code.
 * `timeout="8"` tolerates Meta's pauses between the (repeated) readings so the
 * recording spans a full clean readout.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
      '<Record maxLength="20" timeout="8" playBeep="false" transcribe="true" trim="do-not-trim" finishOnKey=""/>' +
      '<Hangup/>' +
      '</Response>'
  );
}
