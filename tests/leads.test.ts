import { describe, it, expect } from 'vitest';
import { isLeadStatus, LEAD_STATUSES } from '../api/_lib/opsLeads';

// The status endpoint writes whatever passes isLeadStatus straight to the DB —
// so this guard is the whole defence against arbitrary/injected status values.
describe('isLeadStatus', () => {
  it('accepts exactly the pipeline states', () => {
    for (const s of LEAD_STATUSES) expect(isLeadStatus(s)).toBe(true);
    expect(LEAD_STATUSES).toEqual(['novo', 'contatado', 'fechado']);
  });
  it('rejects anything else', () => {
    for (const bad of ['new', 'NOVO', 'deleted', '', ' novo', 42, null, undefined, {}]) {
      expect(isLeadStatus(bad)).toBe(false);
    }
  });
});
