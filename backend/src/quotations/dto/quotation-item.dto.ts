export interface QuotationItemInput {
    description: string;
    unit?: string;
    quantity: number | string;      // decimal — diterima string biar presisi
    price: number | string;
    orderIndex?: number;
    productVariantId?: number | null;
}
