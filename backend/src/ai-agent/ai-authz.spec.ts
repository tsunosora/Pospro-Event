import { isManagerRoleName } from './ai-authz';

describe('isManagerRoleName', () => {
  it.each(['owner', 'Admin', 'Pemilik', 'Manajer Operasional', 'supervisor', 'Kepala Gudang'])(
    '%s → true',
    (n) => expect(isManagerRoleName(n)).toBe(true),
  );
  it.each(['kasir', 'crew', 'staff', 'marketing', null, undefined, ''])('%s → false', (n) =>
    expect(isManagerRoleName(n as any)).toBe(false),
  );
});
