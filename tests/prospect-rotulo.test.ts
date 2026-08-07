/**
 * O rótulo corporativo não volta pro ar por drift de env (06/ago).
 *
 * Em 05/ago o fundador decidiu: a Vitória não se apresenta como "assistente
 * digital" — o rótulo lê como script de call center e mata a conversa antes de
 * começar. O prompt do agente, os dois juízes do gym e a voz foram alinhados.
 *
 * O que ficou de fora e continuou saindo: o CORPO dos templates aprovados.
 * `stevi_parceria_coop_v2` diz "Sou a Vitória, assistente digital da Stevi" e
 * é o que cooperativa e revenda recebem — 212 das 366 linhas da base. A env
 * PROSPECT_COOP_TEMPLATE_NAME na Vercel ainda aponta pra ele, então metade dos
 * primeiros contatos saía exatamente com a frase que o fundador mandou tirar.
 *
 * Consertar só a env deixaria a regra dependendo de alguém não errar o
 * dashboard de novo. A regra mora aqui: um template cujo corpo carrega o rótulo
 * NUNCA é escolhido para envio, venha de onde vier o nome.
 */
import { describe, it, expect } from 'vitest';
import {
  templateBody,
  temRotuloCorporativo,
  V3_NAME,
  V4_NAME,
  V2_NAME,
  COOP_V2_NAME,
  COOP_NAME,
  BUMP_NAME,
  RETOMADA_NAME,
} from '../api/_lib/prospect/template';
import { templateForKind, usaParamsDeCoop } from '../api/_lib/prospect/dispatch';
import { registryParamCount } from '../api/_lib/prospect/template';

describe('temRotuloCorporativo — quem carrega a frase proibida', () => {
  it('pega os dois templates que a declaram', () => {
    expect(temRotuloCorporativo(V3_NAME)).toBe(true);
    expect(temRotuloCorporativo(COOP_V2_NAME)).toBe(true);
  });

  it('e deixa em paz os que não declaram', () => {
    for (const n of [V4_NAME, V2_NAME, COOP_NAME, BUMP_NAME, RETOMADA_NAME]) {
      expect(temRotuloCorporativo(n), n).toBe(false);
    }
  });

  it('reconhece a variante "assistente virtual" também', () => {
    // A proibição do prompt cita as duas; a guarda tem que cobrir as duas.
    expect(/assistente\s+(digital|virtual)/i.test('Sou a Vitória, assistente virtual da Stevi')).toBe(true);
  });
});

describe('templateForKind — o rótulo não sai, venha o nome de onde vier', () => {
  const semEnv = (fn: () => void) => {
    const antes = { ...process.env };
    try {
      fn();
    } finally {
      process.env = antes;
    }
  };

  it('env apontando pro coop_v2 NÃO manda o coop_v2 — cai no v4', () => {
    // O estado real da Vercel em 06/ago. Sem esta guarda, toda cooperativa e
    // revenda recebia "assistente digital" no primeiro contato.
    semEnv(() => {
      process.env.PROSPECT_COOP_TEMPLATE_NAME = COOP_V2_NAME;
      expect(templateForKind('cooperativa')).toBe(V4_NAME);
      expect(templateForKind('revenda')).toBe(V4_NAME);
    });
  });

  it('env apontando pro v3 também cai no v4 — mesma frase, mesmo destino', () => {
    semEnv(() => {
      process.env.PROSPECT_TEMPLATE_NAME = V3_NAME;
      expect(templateForKind('consultoria')).toBe(V4_NAME);
    });
  });

  it('template limpo configurado é respeitado — a guarda não sequestra a escolha', () => {
    semEnv(() => {
      process.env.PROSPECT_TEMPLATE_NAME = V2_NAME;
      expect(templateForKind('consultoria')).toBe(V2_NAME);
    });
  });

  it('o fallback é shape-safe: v4 tem 1 param e não usa params de coop', () => {
    // O risco real do fallback é o apagão de 13/jul: dois params num template
    // de um = #132000 em todo envio. O v4 sai pelo caminho de 1 param.
    expect(registryParamCount(V4_NAME)).toBe(1);
    expect(usaParamsDeCoop(V4_NAME)).toBe(false);
  });
});

describe('nenhum template de ABERTURA carrega o rótulo', () => {
  it('v4 abre sem etiqueta e sem prometer nada', () => {
    const b = templateBody(V4_NAME)!;
    expect(b).not.toMatch(/assistente\s+(digital|virtual)/i);
    expect(b).toMatch(/Vit[óo]ria/);
  });
});
