export interface RabItemInput {
    categoryId: number;
    description: string;
    unit?: string;
    quantity: number | string;
    quantityCost?: number | string;
    priceRab: number | string;
    priceCost: number | string;
    orderIndex?: number;
    productVariantId?: number | null;
    notes?: string;
}
