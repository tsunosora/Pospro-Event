import { hitungEstimasiCost } from './menu.logic';

describe('hitungEstimasiCost', () => {
  it('menjumlahkan quantity × unitPrice tiap bahan', () => {
    const bahan = [
      { quantity: 2, unitPrice: 15000 }, // 30000
      { quantity: 0.5, unitPrice: 40000 }, // 20000
    ];
    expect(hitungEstimasiCost(bahan)).toBe(50000);
  });

  it('mengembalikan 0 untuk daftar kosong', () => {
    expect(hitungEstimasiCost([])).toBe(0);
  });

  it('memperlakukan nilai null/undefined sebagai 0', () => {
    const bahan = [{ quantity: 3, unitPrice: undefined as any }];
    expect(hitungEstimasiCost(bahan)).toBe(0);
  });

  it('menerima string numerik (mis. dari Decimal)', () => {
    const bahan = [{ quantity: '2' as any, unitPrice: '12500' as any }];
    expect(hitungEstimasiCost(bahan)).toBe(25000);
  });
});
