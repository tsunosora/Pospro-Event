import { computeSaldoKas } from './belanja.logic';

describe('computeSaldoKas', () => {
  it('saldo = masuk - keluar', () => {
    expect(computeSaldoKas(1_000_000, 350_000)).toEqual({ masuk: 1_000_000, keluar: 350_000, saldo: 650_000 });
  });
  it('saldo bisa minus', () => {
    expect(computeSaldoKas(500_000, 700_000).saldo).toBe(-200_000);
  });
  it('nol aman', () => {
    expect(computeSaldoKas(0, 0)).toEqual({ masuk: 0, keluar: 0, saldo: 0 });
  });
});
