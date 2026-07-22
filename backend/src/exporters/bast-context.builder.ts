import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveTheme, imageToDataUri } from './quotation-context.builder';

const MONTHS_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatDateId(d?: Date | null): string {
    const date = d ?? new Date();
    return `${date.getDate()} ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`;
}

/** Format tanggal pelaksanaan event jadi "18 Mei 2026" atau "18 – 20 Mei 2026". */
function formatDateRange(start?: Date | null, end?: Date | null): string | null {
    if (!start && !end) return null;
    if (start && !end) return formatDateId(start);
    if (!start && end) return formatDateId(end);
    const a = formatDateId(start!);
    const b = formatDateId(end!);
    return a === b ? a : `${a} – ${b}`;
}

/** Prisma Decimal → angka rapi tanpa trailing zero (mis. "2", "1.5"). */
function fmtQty(q: unknown): string {
    const n = Number(q ?? 0);
    if (!Number.isFinite(n)) return String(q ?? '');
    return String(Number(n.toFixed(4)));
}

interface BastItemRow {
    no: number;
    description: string;
    quantity: string;
    note: string;
}
interface BastItemGroup {
    categoryName: string | null;
    items: BastItemRow[];
}

@Injectable()
export class BastContextBuilder {
    constructor(private prisma: PrismaService) { }

    async build(eventId: number) {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            include: {
                customer: true,
                picWorker: true,
                rabPlan: { include: { items: { include: { category: true } } } },
                packingItems: { include: { productVariant: { include: { product: true } } }, orderBy: { orderIndex: 'asc' } },
                bastItems: { orderBy: { orderIndex: 'asc' } },
            },
        });
        if (!event) throw new NotFoundException('Event tidak ditemukan');

        // ── Brand presentation — pola sama dengan quotation-context.builder (~919, ~1225) ──
        const settings = await this.prisma.storeSettings.findFirst();
        const brandSettings = event.brand
            ? await this.prisma.brandSettings.findUnique({ where: { brand: event.brand } })
            : null;

        const company = {
            name: brandSettings?.companyName ?? settings?.storeName ?? '',
            address: brandSettings?.address ?? settings?.storeAddress ?? '',
            phone: brandSettings?.phone ?? settings?.storePhone ?? '',
            email: brandSettings?.email ?? settings?.companyEmail ?? '',
            logoUrl: imageToDataUri(brandSettings?.logoImageUrl ?? settings?.logoImageUrl ?? null),
            letterheadUrl: imageToDataUri(brandSettings?.letterheadImageUrl ?? null),
        };
        const theme = resolveTheme(brandSettings?.themeColor ?? null, event.brand ?? null);

        // ── Penanda tangan vendor: worker BAST override → PIC event → direktur brand ──
        const signerWorkerId = event.bastSignedByWorkerId ?? event.picWorkerId ?? null;
        const signerWorker = signerWorkerId
            ? await this.prisma.worker.findUnique({ where: { id: signerWorkerId } })
            : null;
        const vendor = {
            name: company.name,
            signerName:
                signerWorker?.signatureDisplayName?.trim() ||
                signerWorker?.name ||
                brandSettings?.directorName ||
                settings?.directorName ||
                '',
            signatureUrl: imageToDataUri(signerWorker?.signatureImageUrl ?? null),
            stampUrl: imageToDataUri(signerWorker?.stampImageUrl ?? brandSettings?.stampImageUrl ?? null),
        };

        // ── Daftar item: prioritas item MANUAL (BastItem) → RAB items → packing items ──
        const rabItems = event.rabPlan?.items ?? [];
        const manualItems = event.bastItems ?? [];
        const itemGroups: BastItemGroup[] = [];
        let no = 0;
        if (manualItems.length) {
            const g: BastItemGroup = { categoryName: null, items: [] };
            for (const m of manualItems) {
                g.items.push({
                    no: ++no,
                    description: m.description,
                    quantity: m.quantity ?? '',
                    note: m.condition ?? '',
                });
            }
            itemGroups.push(g);
        } else if (rabItems.length) {
            // Group berurutan by category (pertahankan urutan kategori kemunculan pertama).
            const order = [...rabItems].sort((a, b) => {
                const ca = a.category?.orderIndex ?? 0;
                const cb = b.category?.orderIndex ?? 0;
                if (ca !== cb) return ca - cb;
                if (a.categoryId !== b.categoryId) return a.categoryId - b.categoryId;
                return a.orderIndex - b.orderIndex;
            });
            const byCat = new Map<number, BastItemGroup>();
            for (const it of order) {
                let g = byCat.get(it.categoryId);
                if (!g) {
                    g = { categoryName: it.category?.name ?? null, items: [] };
                    byCat.set(it.categoryId, g);
                    itemGroups.push(g);
                }
                g.items.push({
                    no: ++no,
                    description: it.description,
                    quantity: `${fmtQty(it.quantity)}${it.unit ? ' ' + it.unit : ''}`.trim(),
                    note: '',
                });
            }
        } else if (event.packingItems.length) {
            const g: BastItemGroup = { categoryName: null, items: [] };
            for (const p of event.packingItems) {
                const v = p.productVariant;
                const variantSuffix = [v?.variantName, v?.size, v?.color].filter(Boolean).join(' ');
                const name = v?.product?.name
                    ? `${v.product.name}${variantSuffix ? ' — ' + variantSuffix : ''}`
                    : `Item #${p.productVariantId}`;
                g.items.push({
                    no: ++no,
                    description: name,
                    quantity: fmtQty(p.quantity),
                    note: '',
                });
            }
            itemGroups.push(g);
        }
        const flatCount = itemGroups.reduce((n2, g) => n2 + g.items.length, 0);

        // ── Nomor & tanggal default ──
        const bastNumber = event.bastNumber?.trim() || `BAST-${event.code}`;
        const bastDate = event.bastDate ?? event.eventEnd ?? new Date();
        const receiverName =
            event.bastReceiverName?.trim() ||
            event.customer?.companyPIC?.trim() ||
            event.customer?.name ||
            event.customerName ||
            '.................';

        return {
            company,
            theme,
            doc: {
                number: bastNumber,
                dateFormatted: formatDateId(bastDate),
                notes: event.bastNotes?.trim() || null,
            },
            project: {
                name: event.name,
                location: event.venue ?? null,
                dateRange: formatDateRange(event.eventStart, event.eventEnd),
            },
            vendor,
            receiver: {
                name: receiverName,
                position: event.bastReceiverPosition?.trim() || null,
                company: event.customer?.companyName || null,
            },
            items: { length: flatCount },
            itemGroups,
        };
    }
}
