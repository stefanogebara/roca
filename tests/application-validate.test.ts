import { describe, it, expect } from 'vitest';
import { validateApplication } from '../api/_lib/tools/applicationValidate';
import { lookupPest } from '../api/_lib/tools/agrofit';

describe('validateApplication — AGROFIT presence check (never a recommendation)', () => {
  it('returns sem_dados when there is no target to ground', () => {
    expect(
      validateApplication({ crop: 'soja', product_name: 'Priori Xtra', active_ingredient: null, target: null })
        .level
    ).toBe('sem_dados');
    expect(
      validateApplication({ crop: null, product_name: null, active_ingredient: null, target: null }).level
    ).toBe('sem_dados');
  });

  it('returns nao_localizado for a crop+target absent from the registry', () => {
    const v = validateApplication({
      crop: 'soja',
      product_name: null,
      active_ingredient: null,
      target: 'praga-que-nao-existe-xyzabc',
    });
    expect(v.level).toBe('nao_localizado');
  });

  it('returns existe_registro when the target is registered but no active is named', () => {
    const v = validateApplication({
      crop: 'soja',
      product_name: null,
      active_ingredient: null,
      target: 'ferrugem',
    });
    expect(v.level).toBe('existe_registro');
    expect(v.note).toMatch(/produtos/);
  });

  it('returns registrado when the declared active is one AGROFIT lists for that crop+target', () => {
    // Derive a genuinely-registered active from the data so the test tracks the
    // bundled registry rather than a hard-coded product name.
    const hit = lookupPest('soja', 'ferrugem');
    expect(hit).not.toBeNull();
    const knownActive = hit!.entry.ativos[0]; // e.g. "Azoxistrobina"
    const v = validateApplication({
      crop: 'soja',
      product_name: null,
      active_ingredient: knownActive,
      target: 'ferrugem',
    });
    expect(v.level).toBe('registrado');
  });

  it('grounds to the farmer crop even when the active is unknown to us', () => {
    const v = validateApplication({
      crop: 'soja',
      product_name: 'ProdutoDesconhecidoXYZ',
      active_ingredient: null,
      target: 'ferrugem',
    });
    // The target is registered for soja → existe_registro (we just can't confirm
    // this specific product). Never nao_localizado on a real pest.
    expect(v.level).toBe('existe_registro');
  });
});
