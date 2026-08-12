/** Saldo kas = masuk - keluar. Fungsi murni supaya mudah di-unit-test. */
export function computeSaldoKas(masuk: number, keluar: number) {
  return { masuk, keluar, saldo: masuk - keluar };
}
