export interface BahanCostInput {
  quantity: number | string | null | undefined;
  unitPrice: number | string | null | undefined;
}

/** Estimasi cost menu = Σ(quantity × unitPrice). Nilai kosong/invalid dianggap 0. */
export function hitungEstimasiCost(bahan: BahanCostInput[]): number {
  return bahan.reduce((sum, b) => {
    const q = Number(b?.quantity) || 0;
    const p = Number(b?.unitPrice) || 0;
    return sum + q * p;
  }, 0);
}
