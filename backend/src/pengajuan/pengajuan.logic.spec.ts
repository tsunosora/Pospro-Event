import { itemTotal, subtotalPengajuan, canConvert } from './pengajuan.logic';

describe('pengajuan.logic', () => {
  it('itemTotal = qty * harga', () => {
    expect(itemTotal(3, 2000)).toBe(6000);
  });
  it('subtotal menjumlahkan semua item', () => {
    expect(
      subtotalPengajuan([
        { quantity: 3, price: 2000 },
        { quantity: 1, price: 4000 },
      ]),
    ).toBe(10000);
  });
  it('canConvert true bila ada >=1 item APPROVED belum ter-convert', () => {
    expect(
      canConvert([
        { status: 'PENDING', convertedRabItemId: null },
        { status: 'APPROVED', convertedRabItemId: null },
      ]),
    ).toBe(true);
  });
  it('canConvert false bila semua APPROVED sudah ter-convert', () => {
    expect(canConvert([{ status: 'APPROVED', convertedRabItemId: 10 }])).toBe(false);
  });
  it('canConvert false bila tidak ada yang APPROVED', () => {
    expect(canConvert([{ status: 'PENDING', convertedRabItemId: null }])).toBe(false);
  });
});
