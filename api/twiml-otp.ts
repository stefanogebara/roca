/**
 * One-off TwiML endpoint used to register the Cloud API phone number: Meta places
 * a voice call that reads the 6-digit code aloud, Twilio hits this URL, and we
 * record the audio so the code can be transcribed and submitted programmatically
 * (SMS OTP doesn't reach VoIP numbers). Returns static TwiML — no secrets, no PII,
 * safe to be public. Can be removed once the number is verified.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
      '<Pause length="1"/>' +
      '<Record maxLength="25" playBeep="false" transcribe="true"/>' +
      '</Response>'
  );
}
