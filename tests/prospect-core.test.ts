import { describe, it, expect } from 'vitest';
import {
  normalizePhoneBR,
  isBusinessHours,
  eligibleToSend,
  planBatch,
  clampDailyCap,
  isOptOut,
  DAILY_CAP_CEILING,
  type ProspectLike,
} from '../api/_lib/prospect/core';

describe('normalizePhoneBR', () => {
  it('normalizes common BR formats to E.164', () => {
    expect(normalizePhoneBR('+55 11 99900-2121')).toBe('+5511999002121');
    expect(normalizePhoneBR('5511999002121')).toBe('+5511999002121');
    expect(normalizePhoneBR('11999002121')).toBe('+5511999002121');
    expect(normalizePhoneBR('(19) 98432-1221')).toBe('+5519984321221');
    expect(normalizePhoneBR('19 3822-1234')).toBe('+551938221234'); // landline
  });
  it('rejects invalid numbers rather than fabricating', () => {
    for (const bad of ['', null, undefined, '123', '999999999999999', 'abc', '00 90000-0000', '11 09900-2121']) {
      expect(normalizePhoneBR(bad as string)).toBeNull();
    }
  });
  it('requires a 9 in front of a mobile subscriber', () => {
    expect(normalizePhoneBR('11 89900-2121')).toBeNull(); // 8-digit-ish mobile without 9 → invalid
    expect(normalizePhoneBR('11 99900-2121')).toBe('+5511999002121');
  });
});

describe('isBusinessHours (BRT Mon–Fri 09–18)', () => {
  it('allows a Wednesday midday BRT', () => {
    // 2026-07-08 15:00 UTC = 12:00 BRT, a Wednesday.
    expect(isBusinessHours(new Date('2026-07-08T15:00:00Z'))).toBe(true);
  });
  it('blocks nights and weekends', () => {
    expect(isBusinessHours(new Date('2026-07-08T02:00:00Z'))).toBe(false); // 23:00 BRT prev day
    expect(isBusinessHours(new Date('2026-07-11T15:00:00Z'))).toBe(false); // Saturday
    expect(isBusinessHours(new Date('2026-07-08T22:00:00Z'))).toBe(false); // 19:00 BRT
    expect(isBusinessHours(new Date('2026-07-08T11:00:00Z'))).toBe(false); // 08:00 BRT
  });
});

const base: ProspectLike = { phone: '+5511999002121', wa_status: 'valid', status: 'ready', send_status: null };

describe('eligibleToSend', () => {
  const noOptouts = new Set<string>();
  it('sends only ready + valid + unsent + not-opted-out', () => {
    expect(eligibleToSend(base, noOptouts)).toBe(true);
  });
  it('blocks every unsafe state', () => {
    expect(eligibleToSend({ ...base, status: 'discovered' }, noOptouts)).toBe(false);
    expect(eligibleToSend({ ...base, wa_status: 'invalid' }, noOptouts)).toBe(false);
    expect(eligibleToSend({ ...base, phone: null }, noOptouts)).toBe(false);
    expect(eligibleToSend({ ...base, send_status: 'sent' }, noOptouts)).toBe(false); // dedup
    expect(eligibleToSend(base, new Set(['+5511999002121']))).toBe(false); // opt-out
  });
});

describe('pacing', () => {
  it('clamps the daily cap to the ceiling', () => {
    expect(clampDailyCap(20)).toBe(20);
    expect(clampDailyCap(999)).toBe(DAILY_CAP_CEILING);
    expect(clampDailyCap(-5)).toBe(0);
  });
  it('planBatch respects remaining cap and batch size', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(planBatch(items, { dailyCap: 20, sentToday: 0, batchSize: 8 })).toHaveLength(8);
    expect(planBatch(items, { dailyCap: 20, sentToday: 18, batchSize: 8 })).toHaveLength(2); // cap nearly hit
    expect(planBatch(items, { dailyCap: 20, sentToday: 20, batchSize: 8 })).toHaveLength(0); // cap hit
    expect(planBatch(items, { dailyCap: 999, sentToday: 0, batchSize: 8 })).toHaveLength(8); // ceiling still caps overall
  });
});

describe('isOptOut', () => {
  it('detects opt-out intents', () => {
    for (const t of ['parar', 'quero sair', 'me remove', 'não quero mais', 'descadastrar', 'STOP']) {
      expect(isOptOut(t), t).toBe(true);
    }
  });
  it('does not fire on normal messages', () => {
    for (const t of ['quero saber mais', 'como funciona?', 'tenho interesse', null]) {
      expect(isOptOut(t as string), String(t)).toBe(false);
    }
  });
});
