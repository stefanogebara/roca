/**
 * Golden-set eval harness — pure halves, plus the integrity of the golden set
 * asset itself (the file IS product infrastructure: malformed criteria would
 * silently hollow out the accuracy metric).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseGoldenSet,
  resolveRouteIntent,
  aggregateGolden,
  parseJudgeVerdict,
  type GoldenCase,
} from '../api/_lib/gym/goldeneval';

// vitest runs from the repo root — same cwd contract as the CLI runner.
const RAW = readFileSync('knowledge/goldenset/goldenset.jsonl', 'utf8');

describe('goldenset.jsonl integrity', () => {
  it('parses completely: ≥30 cases, unique ids, valid modes', () => {
    const cases = parseGoldenSet(RAW);
    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(cases.every((c) => c.mode === 'reply' || c.mode === 'route')).toBe(true);
  });

  it('every reply case has judgeable criteria; every route case has an expected intent', () => {
    const cases = parseGoldenSet(RAW);
    for (const c of cases.filter((x) => x.mode === 'reply')) {
      expect(c.must.length, c.id).toBeGreaterThanOrEqual(1);
    }
    for (const c of cases.filter((x) => x.mode === 'route')) {
      expect(c.intent_expected, c.id).toBeTruthy();
    }
  });

  it('the compliance red-team block exists (no-dose is the load-bearing safety contract)', () => {
    const cases = parseGoldenSet(RAW);
    const comp = cases.filter((c) => c.id.startsWith('comp-'));
    expect(comp.length).toBeGreaterThanOrEqual(5);
    expect(comp.every((c) => c.must_not.length >= 1)).toBe(true);
  });

  it('nothing is agronomist-verified yet — the harness must keep saying so', () => {
    const cases = parseGoldenSet(RAW);
    expect(cases.filter((c) => c.verified_by != null).length).toBe(0);
  });

  it('rejects duplicate ids and unknown modes', () => {
    expect(() =>
      parseGoldenSet('{"id":"a","mode":"reply","question":"q","must":["x"],"must_not":[],"verified_by":null}\n{"id":"a","mode":"reply","question":"q2","must":["x"],"must_not":[],"verified_by":null}')
    ).toThrow(/duplicad/i);
    expect(() =>
      parseGoldenSet('{"id":"b","mode":"vibes","question":"q","must":[],"must_not":[],"verified_by":null}')
    ).toThrow(/mode/i);
  });
});

describe('resolveRouteIntent (mirrors the pipeline cascade order)', () => {
  it('deletion outranks everything', () => {
    expect(resolveRouteIntent('apaga meus dados do histórico')).toBe('deletion');
  });
  it('resolves each regex fast path', () => {
    expect(resolveRouteIntent('meu histórico')).toBe('history');
    expect(resolveRouteIntent('cotação do café')).toBe('prices');
    expect(resolveRouteIntent('monta um resumo pro agrônomo')).toBe('brief');
    expect(resolveRouteIntent('quero falar com um agrônomo')).toBe('referral');
    expect(resolveRouteIntent('como está minha lavoura?')).toBe('field_health');
  });
  it('returns null when no fast path matches (LLM router territory)', () => {
    expect(resolveRouteIntent('posso pulverizar amanhã cedo?')).toBeNull();
  });
});

const rc = (id: string, pass: boolean, missed: string[] = []): Parameters<typeof aggregateGolden>[0][number] => ({
  id,
  mode: 'reply',
  pass,
  missed,
  detail: null,
});

describe('aggregateGolden', () => {
  it('totals, rate and named failures', () => {
    const agg = aggregateGolden([
      rc('a', true),
      rc('b', false, ['recusa passar dose']),
      { id: 'r1', mode: 'route', pass: true, missed: [], detail: null },
    ]);
    expect(agg.total).toBe(3);
    expect(agg.passed).toBe(2);
    expect(agg.rate).toBeCloseTo(2 / 3);
    expect(agg.byMode.reply).toEqual({ total: 2, passed: 1 });
    expect(agg.failures).toEqual([{ id: 'b', missed: ['recusa passar dose'] }]);
  });
  it('empty run is rate 0, no NaN', () => {
    expect(aggregateGolden([]).rate).toBe(0);
  });
  it('infra errors are counted AND named separately from quality failures', () => {
    const agg = aggregateGolden([
      rc('a', true),
      { id: 'e', mode: 'reply', pass: false, missed: ['erro na execução: boom'], detail: null, error: true },
    ]);
    expect(agg.passed).toBe(1);
    expect(agg.errored).toBe(1); // conservative: still in the rate, but visible
  });
});

describe('parseJudgeVerdict (indexed contract, conservative in BOTH directions)', () => {
  const goldenCase: GoldenCase = {
    id: 'x',
    mode: 'reply',
    question: 'q',
    intent_expected: null,
    must: ['explica Delta-T'],
    must_not: ['informa dose'],
    verified_by: null,
  };

  it('passes only when every must is true and every must_not is explicitly false', () => {
    const v = parseJudgeVerdict('```json\n{"m1": true, "n1": false}\n```', goldenCase);
    expect(v.pass).toBe(true);
    expect(v.missed).toEqual([]);
  });

  it('a violated must_not fails and is named', () => {
    const v = parseJudgeVerdict('{"m1": true, "n1": true}', goldenCase);
    expect(v.pass).toBe(false);
    expect(v.missed[0]).toMatch(/violou.*dose/);
  });

  it('an OMITTED must_not fails closed — the no-dose contract never passes by silence', () => {
    const v = parseJudgeVerdict('{"m1": true}', goldenCase);
    expect(v.pass).toBe(false);
    expect(v.missed[0]).toMatch(/não verificado.*dose/);
  });

  it('unparseable output and omitted musts fail closed', () => {
    expect(parseJudgeVerdict('no json here', goldenCase).pass).toBe(false);
    expect(parseJudgeVerdict('{"n1": false}', goldenCase).pass).toBe(false);
  });
});
