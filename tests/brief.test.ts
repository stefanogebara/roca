import { describe, it, expect } from 'vitest';
import { composeBrief } from '../api/_lib/brief';

describe('composeBrief', () => {
  it('assembles a full briefing and stays groups-only (no product, no dose)', () => {
    const text = composeBrief(
      { uf: 'MT', crop: ['soja'] },
      {
        pest: 'ferrugem',
        crop: 'soja',
        stage: 'V8',
        symptom: 'folhas amarelando, pústulas no verso',
        area: '30% da área',
        applied: 'nada ainda',
        when: 'notei essa semana',
      }
    );
    expect(text).toContain('Resumo pra levar ao agrônomo');
    expect(text).toContain('soja');
    expect(text).toContain('V8');
    expect(text).toContain('30% da área');
    // Grounded reference is present with groups + count...
    expect(text).toMatch(/produtos registrados/);
    expect(text).toContain('A escolha do produto e da dose é do agrônomo');
    // ...but NEVER a specific active ingredient or a dose (compliance).
    expect(text).not.toMatch(/azoxistrobina|ciproconazol|mancozeb/i);
    expect(text).not.toMatch(/\d+\s*(ml|l\/ha|g\/ha|litros?)\b/i);
  });

  it('scopes grounding to the farmer\'s crop (café, not soja)', () => {
    const text = composeBrief({ uf: 'MG', crop: ['cafe'] }, { ...blank(), pest: 'ferrugem' });
    expect(text).toMatch(/em cafe/);
    expect(text).not.toMatch(/em soja/);
  });

  it('returns a useful skeleton on thin data and nudges the missing fields', () => {
    const text = composeBrief({ uf: null, crop: null }, blank());
    expect(text).toContain('a confirmar');
    expect(text).toContain('estágio da lavoura');
    expect(text).toContain('quanto da área tá afetado');
    expect(text).toContain('encaminhar essa mensagem');
    expect(text).not.toContain('undefined');
  });
});

function blank() {
  return { pest: null, crop: null, stage: null, symptom: null, area: null, applied: null, when: null };
}
