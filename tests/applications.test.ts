import { describe, it, expect } from 'vitest';
import {
  isApplicationLog,
  resolveApplyDate,
  finalizeApplication,
  formatApplicationConfirm,
  type ParsedApplication,
} from '../api/_lib/tools/applicationParse';
import { checkOutbound } from '../api/_lib/compliance';

// A fixed "now" so relative-date resolution is deterministic (UTC noon).
const NOW = new Date('2026-07-15T12:00:00Z');

describe('isApplicationLog — past-tense declaration, never a question', () => {
  it('matches clear past-tense application declarations', () => {
    expect(isApplicationLog('apliquei Priori Xtra 0,3 L/ha na soja')).toBe(true);
    expect(isApplicationLog('pulverizei ontem contra a ferrugem')).toBe(true);
    expect(isApplicationLog('fiz uma aplicação de fungicida hoje')).toBe(true);
    expect(isApplicationLog('apliquei calcário no talhão de cima')).toBe(true);
    expect(isApplicationLog('aplicamos glifosato semana passada')).toBe(true);
  });

  it('matches weak verbs (passei/joguei) only with a product/chemical hint', () => {
    expect(isApplicationLog('joguei glifosato no pasto')).toBe(true);
    expect(isApplicationLog('passei veneno na lavoura de manhã')).toBe(true);
    // weak verb, no product context → not an application log
    expect(isApplicationLog('passei na fazenda pra ver a plantação')).toBe(false);
    expect(isApplicationLog('joguei a semente fora, tava velha')).toBe(false);
  });

  it('does NOT match questions / future / negation (the spray_window confusables)', () => {
    expect(isApplicationLog('posso aplicar hoje?')).toBe(false);
    expect(isApplicationLog('quando devo pulverizar?')).toBe(false);
    expect(isApplicationLog('o que aplicar na ferrugem da soja')).toBe(false);
    expect(isApplicationLog('qual produto usar contra a lagarta?')).toBe(false);
    expect(isApplicationLog('não apliquei ainda')).toBe(false);
    expect(isApplicationLog('vou aplicar amanhã')).toBe(false);
    expect(isApplicationLog('pretendo pulverizar depois da chuva')).toBe(false);
  });

  it('does NOT match unrelated chatter', () => {
    expect(isApplicationLog('bom dia')).toBe(false);
    expect(isApplicationLog('como está minha lavoura?')).toBe(false);
    expect(isApplicationLog('quanto tá a soja hoje?')).toBe(false);
  });
});

describe('resolveApplyDate — relative Portuguese dates → ISO', () => {
  it('resolves ontem / anteontem / hoje', () => {
    expect(resolveApplyDate('apliquei ontem', NOW)).toBe('2026-07-14');
    expect(resolveApplyDate('pulverizei anteontem', NOW)).toBe('2026-07-13');
    expect(resolveApplyDate('apliquei hoje de manhã', NOW)).toBe('2026-07-15');
  });

  it('resolves "dia N" — this month, or last month when it would be future', () => {
    expect(resolveApplyDate('no dia 3 apliquei', NOW)).toBe('2026-07-03');
    // day 20 is after today (15) → assume last month
    expect(resolveApplyDate('apliquei dia 20', NOW)).toBe('2026-06-20');
  });

  it('defaults to today when no date is stated', () => {
    expect(resolveApplyDate('apliquei Priori na soja', NOW)).toBe('2026-07-15');
  });
});

describe('finalizeApplication — deterministic post-processing of the extract', () => {
  const base = { now: NOW, source: 'declared_text' as const };

  it('maps a full extract and canonicalizes the crop', () => {
    const app = finalizeApplication(
      'apliquei Priori Xtra 0,3 L/ha na lavoura de soja contra ferrugem ontem',
      {
        applied_on: '2026-07-14',
        crop: 'lavoura de soja',
        product_name: 'Priori Xtra',
        active_ingredient: 'azoxistrobina + ciproconazol',
        dose_text: '0,3 L/ha',
        area_ha: 12,
        target: 'ferrugem',
      },
      base
    );
    expect(app.applied_on).toBe('2026-07-14');
    expect(app.crop).toBe('soja'); // normalizeCrop canonicalized it
    expect(app.product_name).toBe('Priori Xtra');
    expect(app.dose_text).toBe('0,3 L/ha');
    expect(app.area_ha).toBe(12);
    expect(app.target).toBe('ferrugem');
    expect(app.source).toBe('declared_text');
    expect(app.raw_text).toContain('Priori Xtra');
  });

  it('coerces a comma-decimal area string and drops non-positive/garbage', () => {
    expect(finalizeApplication('x', { area_ha: '2,5' }, base).area_ha).toBe(2.5);
    expect(finalizeApplication('x', { area_ha: 0 }, base).area_ha).toBeNull();
    expect(finalizeApplication('x', { area_ha: 'muito' }, base).area_ha).toBeNull();
  });

  it('falls back to date-from-text when the extract has no valid date', () => {
    expect(finalizeApplication('apliquei ontem', { applied_on: '' }, base).applied_on).toBe(
      '2026-07-14'
    );
    expect(
      finalizeApplication('apliquei ontem', { applied_on: 'sei lá' }, base).applied_on
    ).toBe('2026-07-14');
  });

  it('keeps a declared crop verbatim when it is not a canonical crop', () => {
    expect(finalizeApplication('x', { crop: 'tomate' }, base).crop).toBe('tomate');
  });

  it('falls back to a known crop when none was declared', () => {
    const app = finalizeApplication('apliquei ontem', null, {
      ...base,
      knownCrops: ['milho'],
    });
    expect(app.crop).toBe('milho');
    expect(app.product_name).toBeNull();
    expect(app.dose_text).toBeNull();
  });

  it('never throws on a null/garbage extract — nothing is lost (raw_text kept)', () => {
    const app = finalizeApplication('apliquei alguma coisa ontem', null, base);
    expect(app.raw_text).toBe('apliquei alguma coisa ontem');
    expect(app.applied_on).toBe('2026-07-14');
  });
});

describe('formatApplicationConfirm — reads back the record, gate-safe', () => {
  const full: ParsedApplication = {
    applied_on: '2026-07-14',
    crop: 'soja',
    product_name: 'Priori Xtra',
    active_ingredient: 'azoxistrobina + ciproconazol',
    dose_text: '0,3 L/ha',
    area_ha: 12,
    target: 'ferrugem',
    source: 'declared_text',
    raw_text: 'apliquei Priori Xtra 0,3 L/ha na soja contra ferrugem ontem',
  };

  it('echoes the key fields the farmer can verify', () => {
    const msg = formatApplicationConfirm(full);
    expect(msg).toContain('soja');
    expect(msg).toContain('Priori Xtra');
    expect(msg).toContain('ferrugem');
    expect(msg).toContain('14/07');
  });

  it('does NOT restate the numeric dose in text (keeps it out of the prescription shape)', () => {
    const msg = formatApplicationConfirm(full);
    expect(msg).not.toContain('0,3 L/ha');
  });

  it('passes the outbound compliance gate — a record echo is not a prescription', () => {
    // This is the load-bearing assertion: the confirm reply must survive
    // checkOutbound, because a per-log confirmation IS outbound text (unlike the
    // rendered report, which the gate never sees).
    expect(checkOutbound(formatApplicationConfirm(full)).safe).toBe(true);
  });

  it('degrades gracefully to whatever fields exist', () => {
    const minimal: ParsedApplication = {
      applied_on: '2026-07-15',
      crop: null,
      product_name: null,
      active_ingredient: null,
      dose_text: null,
      area_ha: null,
      target: null,
      source: 'declared_voice',
      raw_text: 'apliquei uma coisa hoje',
    };
    const msg = formatApplicationConfirm(minimal);
    expect(msg).toContain('15/07');
    expect(checkOutbound(msg).safe).toBe(true);
  });
});
