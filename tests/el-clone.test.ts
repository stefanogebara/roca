/**
 * O filtro de arquivos do clone — só áudio entra, ordem estável.
 */
import { describe, it, expect } from 'vitest';
import { arquivosDeAudio, VOICE_NAME_CLONE } from '../scripts/el-clone';

describe('arquivosDeAudio', () => {
  it('aceita os formatos de áudio e ignora o resto', () => {
    expect(
      arquivosDeAudio(['b.m4a', 'a.wav', 'roteiro.txt', 'foto.jpg', 'c.MP3', '.DS_Store'])
    ).toEqual(['a.wav', 'b.m4a', 'c.MP3']);
  });

  it('lista vazia quando não há áudio — o script aborta com mensagem clara', () => {
    expect(arquivosDeAudio(['notas.md', 'video.mp4'])).toEqual([]);
  });

  it('nome do clone é estável — é a chave da idempotência (reuso, não duplica)', () => {
    expect(VOICE_NAME_CLONE).toBe('Vitoria (Stevi)');
  });
});
