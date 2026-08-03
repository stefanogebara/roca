import { describe, it, expect } from 'vitest';
import {
  normalizePhoneBR,
  isMobileBR,
  numberIsUndeliverable,
  sendablePhone,
  eligibleToSend,
  isBusinessHours,
  planBatch,
  clampDailyCap,
  isOptOut,
  parseProspectLines,
  brtDayStartIso,
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

// A citação virou requisito em 03/ago (ver sendablePhone): sem `wa_phone_source`
// nada é elegível, então a fixture base precisa dela para seguir testando o que
// ela sempre testou — os estados de segurança, não a procedência.
const base: ProspectLike = {
  phone: '+5511999002121',
  wa_phone: '+5511999002121',
  wa_phone_source: 'https://exemplo.coop.br/contato — botão Zap',
  wa_status: 'valid',
  status: 'ready',
  send_status: null,
};

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

describe('brtDayStartIso', () => {
  it('returns 03:00 UTC (00:00 BRT) of the current BRT day', () => {
    // 2026-07-08 15:00 UTC → BRT day is the 8th → start = 8th 03:00 UTC.
    expect(brtDayStartIso(new Date('2026-07-08T15:00:00Z'))).toBe('2026-07-08T03:00:00.000Z');
    // 2026-07-08 02:00 UTC = 23:00 BRT on the 7th → start = 7th 03:00 UTC.
    expect(brtDayStartIso(new Date('2026-07-08T02:00:00Z'))).toBe('2026-07-07T03:00:00.000Z');
  });
});

describe('parseProspectLines', () => {
  it('parses fields, validates phones, defaults kind, skips blanks/comments', () => {
    const rows = parseProspectLines(
      [
        '# header comment',
        'Cooperativa Central, (19) 3822-1234, Campinas, sp, coop',
        'Revenda Boa Safra, 11999002121',
        'Sem Telefone',
        '',
        'Agro XPTO, 123, , , boguskind',
      ].join('\n')
    );
    expect(rows).toHaveLength(3); // "Sem Telefone" (no phone) and blanks/comments dropped
    expect(rows[0]).toMatchObject({ name: 'Cooperativa Central', phone: '+551938221234', wa_status: 'valid', kind: 'coop', city: 'Campinas', uf: 'SP' });
    expect(rows[1]).toMatchObject({ name: 'Revenda Boa Safra', wa_status: 'valid', kind: 'revenda' });
    // Bad phone kept but marked invalid (never fabricated) and unknown kind defaulted.
    expect(rows[2]).toMatchObject({ name: 'Agro XPTO', phone: null, wa_status: 'invalid', kind: 'revenda' });
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

// isMobileBR classifica o número — é um SINAL (útil no painel e na priorização),
// nunca um portão de envio. Ver o bloco de eligibleToSend abaixo.
describe('isMobileBR — classifica celular vs fixo', () => {
  it('reconhece celular E.164 brasileiro', () => {
    expect(isMobileBR('+5535999429176')).toBe(true);
    expect(isMobileBR('+5511987654321')).toBe(true);
  });

  it('reconhece fixo — 71% da base veio do Places com telefone comercial', () => {
    expect(isMobileBR('+553532142166')).toBe(false); // coccamig, Varginha
    expect(isMobileBR('+553534705412')).toBe(false); // Agropecuária JL, Alfenas
    expect(isMobileBR('+553536981200')).toBe(false);
  });

  it('rejeita lixo sem explodir', () => {
    expect(isMobileBR(null)).toBe(false);
    expect(isMobileBR('')).toBe(false);
    expect(isMobileBR('1234')).toBe(false);
    expect(isMobileBR('+1 970 550 9125')).toBe(false); // não é BR
  });
});

// O filtro por CLASSE (bloquear todo fixo), implementado na manhã de 27/jul,
// estava errado: 9 das nossas 14 entregas bem-sucedidas foram para fixos.
// A inferência "todo 131026 veio de fixo, logo fixo não recebe" confundiu
// P(fixo|131026) com P(131026|fixo) — a base é 71% fixo, então quase tudo
// "vem de fixo". Taxa real de entrega: fixo 39%, celular 50%. O que separa
// não é a classe, é a EVIDÊNCIA sobre aquele número específico.
describe('eligibleToSend julga a PROCEDÊNCIA, não a classe do número', () => {
  // O princípio antigo era "fixo e celular valem igual" — e continua valendo.
  // O que mudou em 03/ago é o que habilita: citação, não o telefone do cadastro.
  const base = { status: 'ready', wa_status: 'valid', send_status: null } as never;
  const fonte = 'https://exemplo.coop.br/contato — botão Zap';

  it('fixo COM wa.me citado é elegível — WhatsApp Business aceita linha fixa', () => {
    expect(eligibleToSend(
      { ...(base as object), phone: '+553532142166', wa_phone: '+553532142166', wa_phone_source: fonte } as never,
      new Set()
    )).toBe(true);
  });
  it('celular COM fonte citada é elegível', () => {
    expect(eligibleToSend(
      { ...(base as object), phone: '+5535999429176', wa_phone: '+5535999429176', wa_phone_source: fonte } as never,
      new Set()
    )).toBe(true);
  });

  // O CORTE. Sem citação não vai, seja fixo ou celular: o telefone do cadastro
  // é palpite, e 3 de 3 palpites voltaram 131026 em 03/ago.
  it('sem fonte citada NÃO é elegível, nem fixo nem celular', () => {
    expect(eligibleToSend({ ...(base as object), phone: '+553532142166' } as never, new Set())).toBe(false);
    expect(eligibleToSend({ ...(base as object), phone: '+5535999429176' } as never, new Set())).toBe(false);
  });

  it('número que a Meta já declarou inalcançável NÃO é reenviado', () => {
    expect(eligibleToSend(
      { ...(base as object), phone: '+553532924233', wa_error: '131026 Message undeliverable' } as never,
      new Set()
    )).toBe(false);
  });
  it('inalcançável, mas achamos OUTRO número citado → volta a ser elegível', () => {
    expect(eligibleToSend({
      ...(base as object),
      phone: '+553532924233',
      wa_error: '131026 Message undeliverable',
      wa_phone: '+5535999887766',
      wa_phone_source: fonte,
    } as never, new Set())).toBe(true);
  });
  it('falha de COBRANÇA não condena o número — foi problema nosso', () => {
    expect(eligibleToSend({
      ...(base as object),
      phone: '+553532142166',
      wa_phone: '+553532142166',
      wa_phone_source: fonte,
      wa_error: '131042 Business eligibility payment issue',
    } as never, new Set())).toBe(true);
  });
});

describe('numberIsUndeliverable — só o erro que fala do NÚMERO conta', () => {
  it('131026 condena o número', () => {
    expect(numberIsUndeliverable('131026 Message undeliverable')).toBe(true);
  });
  it('131042 (cobrança) e 131049 (limite) são nossos, não do número', () => {
    expect(numberIsUndeliverable('131042 Business eligibility payment issue')).toBe(false);
    expect(numberIsUndeliverable('131049 healthy ecosystem limit')).toBe(false);
  });
  it('sem erro registrado, nada é condenado', () => {
    expect(numberIsUndeliverable(null)).toBe(false);
  });
});

describe('sendablePhone — o número confirmado vence o telefone do Places', () => {
  const fonte = 'https://exemplo.coop.br/contato';
  it('usa o wa_phone quando existe', () => {
    expect(sendablePhone({ phone: '+553532142166', wa_phone: '+5535999887766', wa_phone_source: fonte } as never))
      .toBe('+5535999887766');
  });
  // MUDANÇA DELIBERADA DE CONTRATO (03/ago): antes, sem wa_phone citado a
  // função caía no telefone do Places. Hoje devolve null.
  //
  // O que desempatou: dos envios de 03/ago, os 6 com fonte citada entregaram e
  // os 3 SEM fonte falharam com 131026 undeliverable — 3 de 3 — estourando o
  // breaker. Discar o cadastro é palpite, e cada 131026 é sinal negativo de
  // qualidade no MESMO número que atende produtor.
  it('sem wa_phone citado → NÃO enviável, mesmo tendo telefone no cadastro', () => {
    expect(sendablePhone({ phone: '+5535999429176', wa_phone: null } as never)).toBeNull();
    expect(sendablePhone({ phone: '+553532142166', wa_phone: null } as never)).toBeNull();
  });

  it('null aqui significa "enriquecer", não "descartar"', () => {
    // O prospect segue na base: eligibleToSend só o tira da FILA.
    const semFonte = { phone: '+553532142166', wa_phone: null, wa_phone_source: null } as never;
    expect(sendablePhone(semFonte)).toBeNull();
  });
  it('sem número nenhum → nada a enviar', () => {
    expect(sendablePhone({ phone: null, wa_phone: null } as never)).toBeNull();
    expect(sendablePhone({ phone: 'lixo', wa_phone: null } as never)).toBeNull();
  });
  // Fixo COM wa.me publicado é enviável — WhatsApp Business aceita linha fixa.
  // A coccamig provou: wa.me/553532142166 no site dela, e o envio para esse
  // número voltou 131042 (cobrança), nunca 131026 (inalcançável).
  it('fixo com wa.me comprovado É enviável', () => {
    expect(sendablePhone({
      phone: '+553532142166',
      wa_phone: '+553532142166',
      wa_phone_source: 'https://coccamig.com.br — botão wa.me/553532142166',
    } as never)).toBe('+553532142166');
  });
  it('wa_phone sem fonte citada NÃO vale — e agora não cai no cadastro tampouco', () => {
    // Número sem citação é palpite de alguém. Antes o palpite era descartado e
    // o cadastro assumia; agora os dois são recusados, que é o ponto.
    expect(sendablePhone({ phone: '+553532142166', wa_phone: '+5535999887766', wa_phone_source: null } as never))
      .toBeNull();
  });
  it('wa_phone que nem é número BR válido NÃO é aceito — e não há para onde cair', () => {
    // A intenção do teste é a mesma; o desfecho mudou com o corte de 03/ago.
    // Antes, um wa_phone inválido cedia lugar ao telefone do cadastro. Agora o
    // cadastro também não vale, então o prospect volta pra fila de enriquecimento.
    expect(sendablePhone({ phone: '+5535999429176', wa_phone: '+55351234', wa_phone_source: fonte } as never))
      .toBeNull();
  });
  it('fixo com wa.me é o MESMO número — o disparo não muda de destino', () => {
    const p = { phone: '+553532668200', wa_phone: '+553532668200', wa_phone_source: fonte } as never;
    expect(sendablePhone(p)).toBe('+553532668200');
  });
});
