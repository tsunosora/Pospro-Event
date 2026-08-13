import { tallyVote } from './vote.logic';

describe('tallyVote', () => {
  it('menjumlahkan bobot suara & menentukan pemenang', () => {
    const r = tallyVote(
      [{ menuId: 1, weight: 1 }, { menuId: 2, weight: 1 }, { menuId: 1, weight: 1 }],
      [1, 2, 3],
    );
    expect(r.counts).toEqual({ 1: 2, 2: 1, 3: 0 });
    expect(r.winnerMenuId).toBe(1);
    expect(r.totalVotes).toBe(3);
  });

  it('perwakilan berbobot (anak perusahaan) diakumulasi', () => {
    // 1 perwakilan menu 2 mewakili 5 suara mengalahkan 3 perwakilan menu 1 (@1)
    const r = tallyVote(
      [{ menuId: 1, weight: 1 }, { menuId: 1, weight: 1 }, { menuId: 1, weight: 1 }, { menuId: 2, weight: 5 }],
      [1, 2],
    );
    expect(r.counts).toEqual({ 1: 3, 2: 5 });
    expect(r.winnerMenuId).toBe(2);
    expect(r.totalVotes).toBe(8);
  });

  it('weight kosong/invalid dianggap 1', () => {
    const r = tallyVote([{ menuId: 3, weight: 0 as any }, { menuId: 3 } as any], [3, 4]);
    expect(r.counts[3]).toBe(2); // 1 + 1
  });

  it('tie dipecah oleh menuId terkecil (deterministik)', () => {
    const r = tallyVote([{ menuId: 3, weight: 1 }, { menuId: 2, weight: 1 }], [2, 3]);
    expect(r.winnerMenuId).toBe(2);
  });

  it('tanpa suara → winner null', () => {
    const r = tallyVote([], [5, 6]);
    expect(r.winnerMenuId).toBeNull();
    expect(r.totalVotes).toBe(0);
  });
});
