/**
 * Voice-note transcription (PT-BR) via an audio-capable model on OpenRouter.
 * WhatsApp voice notes arrive as ogg/opus; we pass the container format through
 * and fail soft to null — the pipeline then asks the farmer to type instead.
 */

import { chat } from './llm';
import { MODELS } from './env';
import { createLogger } from './logger';

const log = createLogger('transcribe');

function formatFromMime(mime: string | null): string {
  if (!mime) return 'ogg';
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'mp4';
  return 'ogg';
}

/** Transcribe a voice note. Returns null when transcription isn't possible. */
export async function transcribeVoice(
  base64: string,
  mime: string | null
): Promise<string | null> {
  try {
    const text = await chat({
      model: MODELS.transcribe(),
      maxTokens: 500,
      audio: { base64, format: formatFromMime(mime) },
      user: 'Transcreva este áudio em português brasileiro, exatamente como falado, sem comentários. Responda somente a transcrição.',
    });
    const cleaned = text.trim();
    return cleaned.length > 0 ? cleaned : null;
  } catch (e) {
    log.error('transcription failed:', (e as Error).message);
    return null;
  }
}
