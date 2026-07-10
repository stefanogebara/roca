/**
 * TwiML endpoint used to register a Cloud API phone number: Meta places a voice
 * call that reads the 6-digit code aloud, Twilio hits this URL, and we record +
 * transcribe the audio so the code can be read from Twilio's transcription
 * (SMS OTP doesn't reach voice-only BR landlines). Returns static TwiML — no
 * secrets, no PII. Records immediately (no leading pause that clips the first
 * digit) and hangs up cleanly after (the `?done=1` action), so Record's default
 * "re-request the document" behaviour can't loop into an application error.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Content-Type', 'text/xml');
  if (req.query.done !== undefined) {
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
    return;
  }
  res.status(200).send(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
      '<Record maxLength="30" playBeep="false" transcribe="true" trim="do-not-trim" action="/api/twiml-otp?done=1" method="GET"/>' +
      '</Response>'
  );
}
