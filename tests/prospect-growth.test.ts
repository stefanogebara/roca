import { describe, it, expect } from 'vitest';
import { buildQueries, toProspectInput } from '../api/_lib/prospect/source';
import {
  shortName,
  kindHook,
  buildTemplateParams,
  buildBumpParams,
  renderBumpText,
  renderTemplateText,
} from '../api/_lib/prospect/personalize';
import { computeFunnelStats, playbookBlock } from '../api/_lib/prospect/learn';

describe('sourcing query grid', () => {
  it('bounds the run (maxCities × queries)', () => {
    const qs = buildQueries(['Varginha MG', 'Lavras MG', 'Alfenas MG', 'Machado MG', 'Guaxupé MG'], 2);
    expect(qs.length).toBe(10); // 2 cities × 5 ICP terms
    expect(qs[0].q).toMatch(/em Varginha MG$/);
    expect(qs[0].city).toBe('Varginha');
  });
});

describe('toProspectInput', () => {
  it('validates phones through the P1 core, never fabricates', () => {
    const ok = toProspectInput({ name: 'Agro X', phone: '(35) 99999-1234', city: null, source: 'maps://x' }, 'revenda', 'Lavras');
    expect(ok.phone).toBe('+5535999991234');
    expect(ok.wa_status).toBe('pending');
    expect(ok.city).toBe('Lavras');
    const bad = toProspectInput({ name: 'Agro Y', phone: '1234', city: 'Alfenas', source: 'maps://y' }, 'revenda', 'Lavras');
    expect(bad.phone).toBeNull();
    expect(bad.wa_status).toBe('invalid');
    expect(bad.city).toBe('Alfenas'); // listing city wins over query city
  });
});

describe('personalization', () => {
  it('shortName strips corporate noise', () => {
    expect(shortName('GBAGRO - Consultoria e Representação Comercial Ltda')).toBe('GBAGRO');
    expect(shortName('Agropecuária União')).toBe('Agropecuária União');
    expect(shortName('Cooxupé - Matriz Guaxupé')).toBe('Cooxupé'); // caught live: hyphen branch suffix
    expect(shortName('Agro.com Agricultura e Pecuária')).toBe('Agro.com Agricultura e Pecuária');
  });
  it('kindHook maps every kind, with a safe default', () => {
    expect(kindHook('consultoria')).toMatch(/consultoria/);
    expect(kindHook('revenda')).toMatch(/produtores/);
    expect(kindHook('cooperativa')).toMatch(/cooperados/);
    expect(kindHook('fazenda')).toMatch(/caf[ée]/);
    expect(kindHook('whatever')).toMatch(/produtor rural/);
  });
  it('buildTemplateParams matches the configured template arity', () => {
    const p = { name: 'Agro Forte Ltda', kind: 'revenda', city: 'Varginha' };
    expect(buildTemplateParams(p, 1)).toHaveLength(1);
    const v2 = buildTemplateParams(p, 3);
    expect(v2).toHaveLength(3);
    expect(v2[0]).toBe('Agro Forte');
    expect(v2[2]).toBe('Varginha');
  });
});

describe('bump cadence (D+3)', () => {
  it('buildBumpParams: short name + city with safe default', () => {
    expect(buildBumpParams({ name: 'Agro Forte Ltda', city: 'Varginha' })).toEqual(['Agro Forte', 'Varginha']);
    expect(buildBumpParams({ name: 'Cocatrel', city: null })[1]).toBe('Sul de Minas');
  });
  it('renderBumpText interpolates and never mentions price', () => {
    const t = renderBumpText(['Agro Forte', 'Varginha']);
    expect(t).toContain('Agro Forte');
    expect(t).toContain('Varginha');
    expect(t).not.toMatch(/R\$\s?\d/);
  });
  it('renderTemplateText covers both intro arities', () => {
    expect(renderTemplateText(['A', 'fazem x', 'C'])).toContain('região de C');
    expect(renderTemplateText(['A'])).toContain('A');
  });
});

describe('learning loop', () => {
  it('computes funnel stats by kind', () => {
    const s = computeFunnelStats(
      [
        { kind: 'revenda', status: 'replied', send_status: 'sent' },
        { kind: 'revenda', status: 'contacted', send_status: 'sent' },
        { kind: 'consultoria', status: 'discovered', send_status: null },
      ],
      1
    );
    expect(s.total).toBe(3);
    expect(s.contacted).toBe(2);
    expect(s.replied).toBe(1);
    expect(s.optedOut).toBe(1);
    expect(s.replyRateByKind.revenda).toBe('1/2');
  });

  it('a promoted partner still counts as contacted+replied (and as converted)', () => {
    // Promotion flips status to 'partner' and the reply overwrote send_status —
    // the funnel must not "lose" its best outcome.
    const s = computeFunnelStats(
      [
        { kind: 'consultoria', status: 'partner', send_status: 'replied' },
        { kind: 'consultoria', status: 'stale', send_status: 'sent' },
      ],
      0
    );
    expect(s.contacted).toBe(2);
    expect(s.replied).toBe(1);
    expect(s.partners).toBe(1);
    expect(s.replyRateByKind.consultoria).toBe('1/2');
  });

  it('playbookBlock is bounded and marked informational', () => {
    const b = playbookBlock(['x'.repeat(300), 'objeção comum: já tem agrônomo da coop', 'a', 'b', 'c', 'd', 'e', 'f']);
    expect(b).toMatch(/informativo/i);
    expect(b).toMatch(/REGRAS DURAS/);
    expect(b!.length).toBeLessThanOrEqual(700);
    expect((b!.match(/^- /gm) ?? []).length).toBeLessThanOrEqual(6);
  });

  it('playbookBlock is null when nothing was learned', () => {
    expect(playbookBlock([])).toBeNull();
  });
});

describe('templates v3 / coop_v2 (aprovados 27/jul) — compatibilidade com o registry', () => {
  it('buildTemplateParams com arity 2 devolve [nome, cidade] — o v3 pede exatamente isso', () => {
    // Bug pego antes de religar: com paramCount=2 o builder caía no ramo de 1
    // param e mandava só o nome. A guarda fail-closed abortaria o dispatch
    // (template_shape_mismatch), do mesmo jeito que no outage #132000.
    const p = { name: 'Rural Center Ltda', kind: 'revenda', city: 'Machado' };
    const v3 = buildTemplateParams(p, 2);
    expect(v3).toHaveLength(2);
    expect(v3[0]).toBe('Rural Center'); // shortName tira o sufixo societário
    expect(v3[1]).toBe('Machado');
  });

  it('cidade ausente cai no default seguro, sem furar a arity', () => {
    const v3 = buildTemplateParams({ name: 'Agro X', kind: 'consultoria', city: null }, 2);
    expect(v3).toHaveLength(2);
    expect(v3[1]).toBe('Sul de Minas');
  });

  it('o registry conhece os dois novos com 2 params (senão o dispatch aborta)', async () => {
    const { registryParamCount } = await import('../api/_lib/prospect/template');
    expect(registryParamCount('stevi_parceria_v3')).toBe(2);
    expect(registryParamCount('stevi_parceria_coop_v2')).toBe(2);
  });
});

describe('template de alerta no registry (cobertura de canário do loop de retenção)', () => {
  it('stevi_alerta_v1 está no registry com 1 param — senão o canário não o vigia', async () => {
    const { registryParamCount } = await import('../api/_lib/prospect/template');
    // Sem isto, templateShapeError devolve 'template desconhecido no registry' e
    // o único template do loop de retenção fica sem monitoramento: uma pausa da
    // Meta só apareceria na próxima geada, quando o alerta não sair.
    expect(registryParamCount('stevi_alerta_v1')).toBe(1);
  });
});
