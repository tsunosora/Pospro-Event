import { create } from 'zustand';

// A unique line key is used so AREA_BASED products can have multiple lines (different sizes/finishing)
// UNIT items: lineId = String(productVariantId)  → merges on re-click
// AREA_BASED: lineId = `${productVariantId}_${Date.now()}` → always a new line
export interface PriceTier {
    minQty: number;
    maxQty: number | null;
    price: number;
    tierName?: string | null;
}

export interface CartItem {
    lineId: string;
    id: number;                  // product id
    productVariantId: number;
    name: string;
    sku: string;
    price: number;               // computed total price (for AREA_BASED: pricePerM2 × area)
    pricePerUnit: number;        // base rate (price/unit or price/m²)
    qty: number;                 // for AREA_BASED always 1; dimensions define the amount
    stock: number;
    trackStock: boolean;         // false = unlimited stock, no deduction
    pricingMode: 'UNIT' | 'AREA_BASED';
    priceTiers: PriceTier[];     // [] = no tiering, price is always pricePerUnit
    note?: string;               // operator note: design name, finishing type, custom text, etc.
    customPrice?: number | null; // admin-overridden price; when set, replaces computed price
    // AREA_BASED only
    unitType?: 'm' | 'cm' | 'menit';
    widthCm?: number;
    heightCm?: number;
    areaCm2?: number;
    areaM2?: number;
}

interface CartState {
    items: CartItem[];
    taxRate: number;
    discount: number;

    addItem: (product: any, variant: any, areaDimensions?: { widthCm: number; heightCm: number; unitType: 'm' | 'cm' | 'menit'; note?: string }) => void;
    removeItem: (lineId: string) => void;
    updateQuantity: (lineId: string, delta: number) => void;
    updateAreaDimensions: (lineId: string, widthCm: number, heightCm: number, unitType: 'm' | 'cm' | 'menit', pricePerUnitM2: number, note?: string) => void;
    updateNote: (lineId: string, note: string) => void;
    updateCustomPrice: (lineId: string, customPrice: number | null) => void;
    clearCart: () => void;
    setDiscount: (amount: number) => void;

    subtotal: () => number;
    taxAmount: () => number;
    grandTotal: () => number;
}

/** Returns the unit price that applies for a given qty based on price tiers. Falls back to basePrice. */
function applyTierPrice(qty: number, basePrice: number, tiers: PriceTier[]): number {
    if (!tiers || tiers.length === 0) return basePrice;
    const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty); // descending
    const matched = sorted.find(t => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty));
    return matched ? matched.price : basePrice;
}

function computeAreaPrice(width: number, height: number, unitPrice: number, unitType: 'm' | 'cm' | 'menit') {
    // priceMultiplier: raw area in input unit — matches how price is set per product
    //   m    → price per m²,  multiplier = w × h (m²)
    //   cm   → price per cm², multiplier = w × h (cm²), no conversion
    //   menit→ price per unit, multiplier = w
    let priceMultiplier = 0;
    if (unitType === 'm') priceMultiplier = width * height;
    else if (unitType === 'cm') priceMultiplier = width * height; // raw cm², price is per cm²
    else if (unitType === 'menit') priceMultiplier = width;

    const price = priceMultiplier * unitPrice;
    return { areaM2: priceMultiplier, price };
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    taxRate: 0.10,
    discount: 0,

    addItem: (product, variant, areaDimensions) => {
        const pricingMode: 'UNIT' | 'AREA_BASED' = product.pricingMode || 'UNIT';
        const pricePerUnit = Number(variant.price || 0);
        const tiers: PriceTier[] = (variant.priceTiers || []).map((t: any) => ({
            minQty: Number(t.minQty),
            maxQty: t.maxQty !== null && t.maxQty !== undefined ? Number(t.maxQty) : null,
            price: Number(t.price),
            tierName: t.tierName ?? null,
        }));

        set((state) => {
            if (pricingMode === 'AREA_BASED') {
                if (!areaDimensions) return state; // must have dimensions from modal

                const { widthCm, heightCm, unitType, note } = areaDimensions;
                const { areaM2, price } = computeAreaPrice(widthCm, heightCm, pricePerUnit, unitType);

                // Each call ALWAYS creates a NEW line item (different sizes per job)
                const lineId = `${variant.id}_${Date.now()}`;
                return {
                    items: [...state.items, {
                        lineId,
                        id: product.id,
                        productVariantId: variant.id,
                        name: product.name + (variant.variantName ? ` — ${variant.variantName}` : '') + (variant.size ? ` (${variant.size})` : ''),
                        sku: variant.sku,
                        price,
                        pricePerUnit,
                        qty: 1,
                        stock: Number(variant.stock),
                        trackStock: product.trackStock !== false,
                        pricingMode: 'AREA_BASED',
                        priceTiers: tiers,
                        note,
                        unitType,
                        widthCm,
                        heightCm,
                        areaM2
                    }]
                };
            }

            // UNIT mode — merge by productVariantId
            const lineId = String(variant.id);
            const trackStock = product.trackStock !== false;
            const existing = state.items.find(i => i.lineId === lineId);
            if (existing) {
                if (trackStock && existing.qty >= Number(variant.stock)) return state;
                const newQty = existing.qty + 1;
                const newPrice = existing.customPrice != null
                    ? existing.customPrice
                    : applyTierPrice(newQty, existing.pricePerUnit, existing.priceTiers);
                return {
                    items: state.items.map(i =>
                        i.lineId === lineId ? { ...i, qty: newQty, price: newPrice } : i
                    )
                };
            }
            const initPrice = applyTierPrice(1, pricePerUnit, tiers);
            return {
                items: [...state.items, {
                    lineId,
                    id: product.id,
                    productVariantId: variant.id,
                    name: product.name + (variant.variantName ? ` — ${variant.variantName}` : '') + (variant.size ? ` — ${variant.size}` : ''),
                    sku: variant.sku,
                    price: initPrice,
                    pricePerUnit,
                    qty: 1,
                    stock: Number(variant.stock),
                    trackStock,
                    pricingMode: 'UNIT',
                    priceTiers: tiers,
                }]
            };
        });
    },

    removeItem: (lineId) => {
        set((state) => ({ items: state.items.filter(i => i.lineId !== lineId) }));
    },

    updateQuantity: (lineId, delta) => {
        set((state) => ({
            items: state.items.map(i => {
                if (i.lineId !== lineId || i.pricingMode === 'AREA_BASED') return i;
                const newQty = i.qty + delta;
                if (newQty <= 0 || (i.trackStock !== false && newQty > i.stock)) return i;
                if (i.customPrice != null) return { ...i, qty: newQty };
                const newPrice = applyTierPrice(newQty, i.pricePerUnit, i.priceTiers);
                return { ...i, qty: newQty, price: newPrice };
            })
        }));
    },

    updateAreaDimensions: (lineId, widthCm, heightCm, unitType, pricePerUnitM2, note) => {
        set((state) => ({
            items: state.items.map(i => {
                if (i.lineId !== lineId || i.pricingMode !== 'AREA_BASED') return i;
                const { areaM2, price } = computeAreaPrice(widthCm, heightCm, pricePerUnitM2, unitType);
                return { ...i, unitType, widthCm, heightCm, areaM2, price, note: note ?? i.note };
            })
        }));
    },

    updateNote: (lineId, note) => {
        set((state) => ({
            items: state.items.map(i => i.lineId === lineId ? { ...i, note } : i)
        }));
    },

    updateCustomPrice: (lineId, customPrice) => {
        set((state) => ({
            items: state.items.map(i => {
                if (i.lineId !== lineId) return i;
                if (customPrice === null) {
                    const { customPrice: _removed, ...rest } = i;
                    if (i.pricingMode === 'UNIT') {
                        return { ...rest, price: applyTierPrice(i.qty, i.pricePerUnit, i.priceTiers) };
                    } else {
                        const { price } = computeAreaPrice(i.widthCm!, i.heightCm!, i.pricePerUnit, i.unitType!);
                        return { ...rest, price };
                    }
                }
                return { ...i, customPrice, price: customPrice };
            })
        }));
    },

    clearCart: () => set({ items: [], discount: 0 }),
    setDiscount: (amount) => set({ discount: amount }),

    subtotal: () => {
        const { items } = get();
        return items.reduce((acc, item) => {
            if (item.pricingMode === 'AREA_BASED') return acc + item.price;
            return acc + (item.price * item.qty);
        }, 0);
    },

    taxAmount: () => {
        const { subtotal, discount, taxRate } = get();
        return Math.max(0, (subtotal() - discount) * taxRate);
    },

    grandTotal: () => {
        const { subtotal, discount, taxAmount } = get();
        return Math.max(0, subtotal() - discount) + taxAmount();
    }
}));
