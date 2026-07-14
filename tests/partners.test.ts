import { describe, it, expect } from 'vitest';
import {
  partnerCovers,
  isConsentYes,
  isConsentNo,
  partnerFirstName,
  consentAskText,
  isLeadStale,
} from '../api/_lib/partners';

const SLA_NOW = new Date('2026-07-20T12:00:00Z');
const slaHoursAgo = (h: number) => new Date(SLA_NOW.getTime() - h * 3_600_000).toISOString();

describe('isLeadStale (24h SLA — a consented farmer is waiting)', () => {
  it('stale when the partner was pinged ≥24h ago with no dossier delivered', () => {
    expect(
      isLeadStale({ partner_notified_at: slaHoursAgo(30), delivered_at: null, sla_alerted_at: null }, SLA_NOW)
    ).toBe(true);
  });
  it('not stale inside the window, after delivery, or once already alerted', () => {
    expect(
      isLeadStale({ partner_notified_at: slaHoursAgo(10), delivered_at: null, sla_alerted_at: null }, SLA_NOW)
    ).toBe(false);
    expect(
      isLeadStale(
        { partner_notified_at: slaHoursAgo(30), delivered_at: slaHoursAgo(20), sla_alerted_at: null },
        SLA_NOW
      )
    ).toBe(false);
    expect(
      isLeadStale(
        { partner_notified_at: slaHoursAgo(30), delivered_at: null, sla_alerted_at: slaHoursAgo(2) },
        SLA_NOW
      )
    ).toBe(false);
    expect(
      isLeadStale({ partner_notified_at: null, delivered_at: null, sla_alerted_at: null }, SLA_NOW)
    ).toBe(false);
  });
});

// Michel's real coverage centroid (Espera Feliz, Caparaó MG).
const michel = { lat: -20.6504, lon: -41.9086, radius_km: 60, crops: ['café'], active: true };

describe('partnerCovers (geo + crop match)', () => {
  it('covers a coffee farm inside the radius', () => {
    // Caparaó town ~25 km away.
    expect(partnerCovers(michel, { lat: -20.52, lon: -41.9, crop: ['café'] })).toBe(true);
  });
  it('rejects a farm outside the radius (Varginha, Sul de Minas ~370 km)', () => {
    expect(partnerCovers(michel, { lat: -21.55, lon: -45.43, crop: ['café'] })).toBe(false);
  });
  it('crop filter applies only when both sides declare crops', () => {
    expect(partnerCovers(michel, { lat: -20.52, lon: -41.9, crop: ['soja'] })).toBe(false);
    expect(partnerCovers(michel, { lat: -20.52, lon: -41.9, crop: null })).toBe(true);
    expect(partnerCovers({ ...michel, crops: null }, { lat: -20.52, lon: -41.9, crop: ['soja'] })).toBe(true);
  });
  it('inactive or pinless partners never match', () => {
    expect(partnerCovers({ ...michel, active: false }, { lat: -20.52, lon: -41.9 })).toBe(false);
    expect(partnerCovers({ ...michel, lat: null }, { lat: -20.52, lon: -41.9 })).toBe(false);
  });
});

describe('consent detection', () => {
  it('clear yes forms', () => {
    for (const t of ['sim', 'Pode sim!', 'claro', 'pode passar', 'manda', 'beleza', '👍', 'autorizo', 'fechado']) {
      expect(isConsentYes(t), t).toBe(true);
    }
  });
  it('clear no forms — including "não pode" (negation beats the yes-word)', () => {
    for (const t of ['não', 'nao pode', 'prefiro não', 'agora não', 'melhor não, obrigado']) {
      expect(isConsentNo(t), t).toBe(true);
      expect(isConsentYes(t), t).toBe(false);
    }
  });
  it('ambiguous stays ambiguous (falls through to normal handling)', () => {
    for (const t of ['quem é ele?', 'quanto custa?', 'me fala mais']) {
      expect(isConsentYes(t), t).toBe(false);
      expect(isConsentNo(t), t).toBe(false);
    }
  });
});

describe('copy helpers', () => {
  it('partnerFirstName strips surname and org', () => {
    expect(partnerFirstName('Michel Silva (Gaia Tech)')).toBe('Michel');
  });
  it('consent ask names the partner, the data shared, and asks ONE question', () => {
    const ask = consentAskText({
      id: 'x', name: 'Michel Silva (Gaia Tech)', phone: '+55', coverage_label: 'Espera Feliz e região',
      lat: 0, lon: 0, radius_km: 60, crops: null, active: true,
    });
    expect(ask).toContain('Michel');
    expect(ask).toContain('Espera Feliz');
    expect(ask).toMatch(/contato e o resumo/);
    expect((ask.match(/\?/g) ?? []).length).toBe(1);
  });
});
