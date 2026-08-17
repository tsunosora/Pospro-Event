export function itemTotal(quantity: number, price: number): number {
  return Number(quantity) * Number(price);
}

export function subtotalPengajuan(
  items: { quantity: number | string; price: number | string }[],
): number {
  return items.reduce((a, it) => a + itemTotal(Number(it.quantity), Number(it.price)), 0);
}

export function canConvert(
  items: { status: string; convertedRabItemId: number | null }[],
): boolean {
  return items.some((it) => it.status === 'APPROVED' && it.convertedRabItemId == null);
}
