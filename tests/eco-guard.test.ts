/**
 * Guard de eco do lado do PRODUTOR.
 *
 * Em 03/ago, 880 de 926 mensagens `out` do dia foram `smalltalk`: um
 * atendimento automático do outro lado ficou trocando despedida com a Stevi por
 * 25+ turnos, ~13s cada, das 13:48 às 14:22. Cada turno é uma invocação e uma
 * chamada de LLM — e contamina caderno, digest e WAU, que passam a contar
 * ruído. Qualquer leitura de tração daquele dia está inflada.
 *
 * O `ecoDeMaquina` da Vitória NÃO pega isto, e a diferença é de forma, não de
 * ajuste: lá o sinal é a contraparte repetindo A SI MESMA, com piso de 40 chars
 * porque gente repete "ok" o dia inteiro. Aqui o sinal é a contraparte
 * repetindo A NÓS, verbatim, emoji incluso:
 *
 *   13:42:22 out  "Até mais! Tamo junto. 🌱"
 *   13:42:35 in   "Até mais! Tamo junto. 🌱"
 *
 * Uma pessoa não cola de volta a frase exata da Stevi. Um robô-espelho sim. Por
 * isso aqui NÃO há piso de tamanho — "Até mais! 🌱" tem 3 palavras e é o caso
 * real — e a comparação é estrita (só caixa e espaço normalizados). Estrito é o
 * que torna seguro não ter piso.
 */
import { describe, it, expect } from 'vitest';
import { ecoDoNossoTexto } from '../api/_lib/ecoGuard';

type Turno = { role: 'produtor' | 'stevi'; text: string };
const stevi = (text: string): Turno => ({ role: 'stevi', text });
const produtor = (text: string): Turno => ({ role: 'produtor', text });

describe('ecoDoNossoTexto', () => {
  it('pega o caso real: devolveram a nossa despedida verbatim', () => {
    const turns = [produtor('Até mais! 🌱'), stevi('Até mais! Tamo junto. 🌱')];
    expect(ecoDoNossoTexto(turns, 'Até mais! Tamo junto. 🌱')).toBe(true);
  });

  it('sem piso de tamanho — "Até mais! 🌱" é curta E é o caso real', () => {
    expect(ecoDoNossoTexto([stevi('Até mais! 🌱')], 'Até mais! 🌱')).toBe(true);
  });

  it('normaliza caixa e espaço em excesso (mesma frase, digitação diferente)', () => {
    expect(ecoDoNossoTexto([stevi('Até mais! 🌱')], '  até   mais!  🌱 ')).toBe(true);
  });

  it('olha alguns turnos atrás, não só o último', () => {
    const turns = [stevi('Até mais! 🌱'), produtor('oi'), stevi('Opa, e aí?')];
    expect(ecoDoNossoTexto(turns, 'Até mais! 🌱')).toBe(true);
  });

  // ── O que o guard NÃO pode calar ──────────────────────────────────────────

  it('paráfrase NÃO é eco — só o texto idêntico', () => {
    // Estrito de propósito. Um robô que parafraseia escapa deste guard, e isso
    // é preferível ao inverso: afrouxar aqui é arriscar calar um produtor.
    expect(ecoDoNossoTexto([stevi('Até mais! 🌱')], 'Até mais! Estarei por aqui. 🌱')).toBe(false);
  });

  it('repetição do PRODUTOR não conta — só o que a Stevi mandou', () => {
    // Gente repete. Insistir ("alguém aí?", "alguém aí?") é humano e urgente —
    // exatamente quem não pode levar silêncio.
    const turns = [produtor('alguém aí?'), stevi('Oi! Como posso ajudar?')];
    expect(ecoDoNossoTexto(turns, 'alguém aí?')).toBe(false);
  });

  it('citar a Stevi para PERGUNTAR sobre aquilo não é eco', () => {
    const turns = [stevi('Aplique 0,5 L/ha de mancozebe.')];
    expect(ecoDoNossoTexto(turns, 'Aplique 0,5 L/ha de mancozebe. isso mesmo?')).toBe(false);
  });

  it('mensagem vazia ou só espaço não dispara', () => {
    expect(ecoDoNossoTexto([stevi('  ')], '   ')).toBe(false);
    expect(ecoDoNossoTexto([stevi('Até mais! 🌱')], '')).toBe(false);
  });

  it('histórico vazio não dispara (primeiro contato)', () => {
    expect(ecoDoNossoTexto([], 'Até mais! 🌱')).toBe(false);
  });
});
