import { APP_GUIDE, guideTableOfContents, retrieveGuideSections } from './app-guide';

describe('app-guide', () => {
  it('punya banyak seksi & TOC menyebut penawaran', () => {
    expect(APP_GUIDE.length).toBeGreaterThan(5);
    const toc = guideTableOfContents();
    expect(toc).toMatch(/penawaran|quotation/i);
    expect(toc.split('\n').length).toBe(APP_GUIDE.length);
  });

  it('retrieve by keyword mengembalikan seksi relevan', () => {
    const hits = retrieveGuideSections('cara bikin penawaran sph', 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.join(' ')).toMatch(/penawaran|quotation/i);
  });

  it('retrieve pertanyaan cashflow menempatkan seksi Cashflow di atas', () => {
    const hits = retrieveGuideSections('bagaimana catat pemasukan pengeluaran cashflow', 3);
    expect(hits[0]).toMatch(/cashflow/i);
  });

  it('membatasi jumlah seksi sesuai limit', () => {
    const hits = retrieveGuideSections('penawaran event rab cashflow crm customer', 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it('query tanpa kecocokan → array kosong', () => {
    expect(retrieveGuideSections('zzz qqq', 3)).toHaveLength(0);
  });
});
