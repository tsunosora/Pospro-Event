import { hitungVariance } from './plan.logic';

describe('hitungVariance', () => {
  it('selisih = realCost - estimatedCost; over=true jika real > estimasi', () => {
    const r = hitungVariance({ estimatedCost: 50000, realCost: 62000, budget: 70000 });
    expect(r.selisih).toBe(12000);
    expect(r.over).toBe(true);
    expect(r.sisaBudget).toBe(8000); // 70000 - 62000
    expect(r.overBudget).toBe(false);
  });

  it('over=false saat real <= estimasi; sisaBudget null saat budget tak diset', () => {
    const r = hitungVariance({ estimatedCost: 50000, realCost: 45000, budget: null });
    expect(r.selisih).toBe(-5000);
    expect(r.over).toBe(false);
    expect(r.sisaBudget).toBeNull();
    expect(r.overBudget).toBe(false);
  });

  it('overBudget=true saat real > budget', () => {
    const r = hitungVariance({ estimatedCost: 50000, realCost: 80000, budget: 70000 });
    expect(r.overBudget).toBe(true);
    expect(r.sisaBudget).toBe(-10000);
  });

  it('nilai kosong/null diperlakukan 0', () => {
    const r = hitungVariance({ estimatedCost: null, realCost: undefined, budget: 0 });
    expect(r.estimatedCost).toBe(0);
    expect(r.realCost).toBe(0);
    expect(r.selisih).toBe(0);
    expect(r.sisaBudget).toBeNull(); // budget 0 dianggap tak diset
  });

  it('menerima string numerik (Decimal)', () => {
    const r = hitungVariance({ estimatedCost: '50000' as any, realCost: '55000' as any, budget: '60000' as any });
    expect(r.selisih).toBe(5000);
    expect(r.sisaBudget).toBe(5000);
  });
});
