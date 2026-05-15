export interface QuotationItemInput {
    description: string;
    unit?: string;
    quantity: number | string;      // decimal — diterima string biar presisi
    /** Multiplier tambahan untuk multi-faktor (mis. hari sewa). Subtotal = qty × unitMultiplier × price. */
    unitMultiplier?: number | string | null;
    price: number | string;
    orderIndex?: number;
    productVariantId?: number | null;
    categoryName?: string | null;   // untuk grouping di PDF (mis. "Konstruksi Utama Booth")
    /** Multi-event grouping: 0=event utama, 1+ = additionalEvents[i-1]. null = shared/global. */
    eventIndex?: number | null;
    /** Package grouping (mode 'package'): nama paket (mis. "Package 1"). null = mode normal. */
    packageGroup?: string | null;
}
