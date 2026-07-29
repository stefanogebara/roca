/**
 * Roteamento free vs pago do Open-Meteo.
 *
 * 29/jul: os termos do tier grátis proíbem uso comercial de forma explícita
 * ("You may only use the free API services for non-commercial purposes"), e a
 * Stevi é produto comercial. O tier grátis sustenta clima, Delta T e alerta de
 * geada — ou seja, o risco não é de disponibilidade, é jurídico.
 */
import { describe, it, expect } from 'vitest';
import { openMeteoUrl, usandoTierGratis } from '../api/_lib/tools/openMeteo';

const KEY = 'chave-de-teste';

describe('openMeteoUrl — pago quando há chave, grátis quando não há', () => {
  it('sem chave: host público, sem apikey na URL', () => {
    const u = new URL(openMeteoUrl('api', '/v1/forecast', { latitude: '-21.5' }, undefined));
    expect(u.host).toBe('api.open-meteo.com');
    expect(u.searchParams.get('apikey')).toBeNull();
    expect(u.searchParams.get('latitude')).toBe('-21.5');
  });

  it('com chave: host customer + apikey', () => {
    const u = new URL(openMeteoUrl('api', '/v1/forecast', { latitude: '-21.5' }, KEY));
    expect(u.host).toBe('customer-api.open-meteo.com');
    expect(u.searchParams.get('apikey')).toBe(KEY);
    expect(u.searchParams.get('latitude')).toBe('-21.5');
  });

  it('o geocoding segue a mesma regra de prefixo', () => {
    expect(new URL(openMeteoUrl('geocoding-api', '/v1/search', { name: 'Varginha' }, undefined)).host)
      .toBe('geocoding-api.open-meteo.com');
    expect(new URL(openMeteoUrl('geocoding-api', '/v1/search', { name: 'Varginha' }, KEY)).host)
      .toBe('customer-geocoding-api.open-meteo.com');
  });

  it('chave em branco conta como SEM chave — env vazia não vira host quebrado', () => {
    for (const vazia of ['', '   ', undefined]) {
      expect(new URL(openMeteoUrl('api', '/v1/forecast', {}, vazia)).host).toBe('api.open-meteo.com');
    }
  });

  it('preserva parâmetros repetidos (hourly=a&hourly=b vira lista, não sobrescreve)', () => {
    const u = new URL(openMeteoUrl('api', '/v1/forecast', { hourly: ['temperature_2m', 'wind_speed_10m'] }, KEY));
    expect(u.searchParams.getAll('hourly')).toEqual(['temperature_2m', 'wind_speed_10m']);
  });
});

describe('usandoTierGratis — o estado tem que ser legível de fora', () => {
  it('true sem chave, false com chave', () => {
    expect(usandoTierGratis(undefined)).toBe(true);
    expect(usandoTierGratis('')).toBe(true);
    expect(usandoTierGratis(KEY)).toBe(false);
  });
});
