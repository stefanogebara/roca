import { describe, it, expect } from 'vitest';
import { buildVazioAlertText, alertDedupKey, alertSendPlan } from '../api/_lib/alerts';
import type { CalendarTransition } from '../api/_lib/tools/calendar';

const start: CalendarTransition = { uf: 'MT', kind: 'vazio_start', date: '2026-06-08', daysAway: 3 };
const end: CalendarTransition = { uf: 'MG', kind: 'vazio_end', date: '2026-09-30', daysAway: 5 };

describe('buildVazioAlertText', () => {
  it('warns about a starting vazio with date, source and the no-live-soy rule', () => {
    const t = buildVazioAlertText(start);
    expect(t).toContain('MT');
    expect(t).toMatch(/come[çc]a/i);
    expect(t).toContain('3 dia');
    expect(t).toMatch(/Portaria SDA\/MAPA/);
    expect(t).toMatch(/guaxa|soja viva/i);
  });

  it('frames an ending vazio as planting opening up', () => {
    const t = buildVazioAlertText(end);
    expect(t).toMatch(/termina/i);
    expect(t).toContain('5 dia');
    expect(t).toMatch(/plantio|plantar/i);
  });

  it('uses singular for 1 day away', () => {
    expect(buildVazioAlertText({ ...start, daysAway: 1 })).toContain('1 dia');
    expect(buildVazioAlertText({ ...start, daysAway: 1 })).not.toContain('1 dias');
  });

  it('never has the shape of a prescription (no dose, no product)', () => {
    for (const t of [buildVazioAlertText(start), buildVazioAlertText(end)]) {
      expect(t).not.toMatch(/\d+\s?(l|ml|kg|g)\s?\/\s?ha/i);
      expect(t).not.toMatch(/aplique|dose de/i);
    }
  });
});

describe('alertDedupKey', () => {
  it('is stable per transition and distinct across transitions', () => {
    expect(alertDedupKey(start)).toBe(alertDedupKey({ ...start, daysAway: 1 }));
    expect(alertDedupKey(start)).not.toBe(alertDedupKey(end));
    expect(alertDedupKey(start)).not.toBe(alertDedupKey({ ...start, kind: 'vazio_end' }));
  });
});

describe('alertSendPlan — Meta 24h window rules per channel', () => {
  const now = new Date('2026-07-25T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

  it('twilio (sandbox era) is always freeform', () => {
    expect(alertSendPlan({ channel: 'twilio', lastInboundAt: null, now, templateConfigured: false })).toBe('freeform');
    expect(alertSendPlan({ channel: null, lastInboundAt: null, now, templateConfigured: true })).toBe('freeform');
  });

  it('cloud inside the 24h service window is freeform (free)', () => {
    expect(alertSendPlan({ channel: 'cloud', lastInboundAt: hoursAgo(3), now, templateConfigured: false })).toBe('freeform');
  });

  it('cloud outside the window uses the UTILITY template when configured', () => {
    expect(alertSendPlan({ channel: 'cloud', lastInboundAt: hoursAgo(48), now, templateConfigured: true })).toBe('template');
  });

  it('cloud outside the window with NO template skips honestly (never a doomed freeform)', () => {
    expect(alertSendPlan({ channel: 'cloud', lastInboundAt: hoursAgo(48), now, templateConfigured: false })).toBe('skip');
    expect(alertSendPlan({ channel: 'cloud', lastInboundAt: null, now, templateConfigured: false })).toBe('skip');
  });
});
