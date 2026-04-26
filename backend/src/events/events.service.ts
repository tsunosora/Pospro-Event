import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { EventBrand, EventStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface EventPhaseInput {
    departureStart?: string | Date | null;
    departureEnd?: string | Date | null;
    setupStart?: string | Date | null;
    setupEnd?: string | Date | null;
    loadingStart?: string | Date | null;
    loadingEnd?: string | Date | null;
    eventStart?: string | Date | null;
    eventEnd?: string | Date | null;
}

export interface CreateEventInput extends EventPhaseInput {
    name: string;
    brand?: EventBrand;
    status?: EventStatus;
    venue?: string | null;
    customerId?: number | null;
    customerName?: string | null;
    picWorkerId?: number | null;
    picName?: string | null;
    notes?: string | null;
}

export interface UpdateEventInput extends Partial<CreateEventInput> { }

export interface ListEventsFilter {
    status?: EventStatus;
    brand?: EventBrand;
    year?: number;
    month?: number;
    search?: string;
}

const toDate = (v: string | Date | null | undefined) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Tanggal tidak valid');
    return d;
};

@Injectable()
export class EventsService {
    constructor(private prisma: PrismaService) { }

    private async generateCode(date: Date) {
        const year = date.getFullYear();
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        const count = await this.prisma.event.count({
            where: { createdAt: { gte: start, lt: end } },
        });
        const seq = String(count + 1).padStart(4, '0');
        return `EVT-${year}-${seq}`;
    }

    async findAll(filter: ListEventsFilter = {}) {
        const where: any = {};
        if (filter.status) where.status = filter.status;
        if (filter.brand) where.brand = filter.brand;
        if (filter.search) {
            where.OR = [
                { name: { contains: filter.search } },
                { venue: { contains: filter.search } },
                { customerName: { contains: filter.search } },
                { code: { contains: filter.search } },
            ];
        }
        if (filter.year) {
            const start = new Date(filter.year, filter.month ? filter.month - 1 : 0, 1);
            const end = filter.month
                ? new Date(filter.year, filter.month, 1)
                : new Date(filter.year + 1, 0, 1);
            where.OR = [
                ...(where.OR ?? []),
                { eventStart: { gte: start, lt: end } },
                { eventEnd: { gte: start, lt: end } },
                { setupStart: { gte: start, lt: end } },
                { departureStart: { gte: start, lt: end } },
            ];
        }
        return this.prisma.event.findMany({
            where,
            orderBy: [{ eventStart: 'asc' }, { createdAt: 'desc' }],
            include: {
                customer: { select: { id: true, name: true, companyName: true } },
                picWorker: { select: { id: true, name: true, position: true } },
                _count: { select: { withdrawals: true, crewAssignments: true } },
                crewAssignments: {
                    select: {
                        teamId: true,
                        team: { select: { id: true, name: true, color: true } },
                    },
                },
            },
        });
    }

    async findOne(id: number) {
        const ev = await this.prisma.event.findUnique({
            where: { id },
            include: {
                customer: true,
                picWorker: { select: { id: true, name: true, position: true, photoUrl: true } },
                withdrawals: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        worker: { select: { id: true, name: true } },
                        warehouse: { select: { id: true, name: true } },
                        items: {
                            include: {
                                productVariant: {
                                    select: {
                                        id: true, sku: true, variantName: true,
                                        product: { select: { id: true, name: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!ev) throw new NotFoundException(`Event id=${id} tidak ditemukan`);
        return ev;
    }

    async create(input: CreateEventInput) {
        const name = input.name?.trim();
        if (!name) throw new BadRequestException('Nama event wajib diisi');

        const now = new Date();
        const code = await this.generateCode(now);

        return this.prisma.event.create({
            data: {
                code,
                name,
                brand: input.brand ?? 'EXINDO',
                status: input.status ?? 'SCHEDULED',
                venue: input.venue?.trim() || null,
                customerId: input.customerId ?? null,
                customerName: input.customerName?.trim() || null,
                picWorkerId: input.picWorkerId ?? null,
                picName: input.picName?.trim() || null,
                departureStart: toDate(input.departureStart) ?? null,
                departureEnd: toDate(input.departureEnd) ?? null,
                setupStart: toDate(input.setupStart) ?? null,
                setupEnd: toDate(input.setupEnd) ?? null,
                loadingStart: toDate(input.loadingStart) ?? null,
                loadingEnd: toDate(input.loadingEnd) ?? null,
                eventStart: toDate(input.eventStart) ?? null,
                eventEnd: toDate(input.eventEnd) ?? null,
                notes: input.notes?.trim() || null,
            },
        });
    }

    async update(id: number, input: UpdateEventInput) {
        await this.findOne(id);
        const data: any = {};
        if (input.name !== undefined) {
            const n = input.name.trim();
            if (!n) throw new BadRequestException('Nama event wajib diisi');
            data.name = n;
        }
        if (input.brand !== undefined) data.brand = input.brand;
        if (input.status !== undefined) data.status = input.status;
        if (input.venue !== undefined) data.venue = input.venue?.trim() || null;
        if (input.customerId !== undefined) data.customerId = input.customerId ?? null;
        if (input.customerName !== undefined) data.customerName = input.customerName?.trim() || null;
        if (input.picWorkerId !== undefined) data.picWorkerId = input.picWorkerId ?? null;
        if (input.picName !== undefined) data.picName = input.picName?.trim() || null;
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

        const phaseFields: (keyof EventPhaseInput)[] = [
            'departureStart', 'departureEnd',
            'setupStart', 'setupEnd',
            'loadingStart', 'loadingEnd',
            'eventStart', 'eventEnd',
        ];
        for (const k of phaseFields) {
            if ((input as any)[k] !== undefined) data[k] = toDate((input as any)[k]);
        }

        return this.prisma.event.update({ where: { id }, data });
    }

    async remove(id: number) {
        const ev = await this.prisma.event.findUnique({
            where: { id },
            include: { _count: { select: { withdrawals: true } } },
        });
        if (!ev) throw new NotFoundException(`Event id=${id} tidak ditemukan`);
        if (ev._count.withdrawals > 0) {
            throw new BadRequestException(
                `Event tidak bisa dihapus karena masih terkait ${ev._count.withdrawals} pengeluaran barang`,
            );
        }
        await this.prisma.event.delete({ where: { id } });
        return { ok: true };
    }

    async buildWhatsappMessage(
        id: number,
        opts: { includeLink?: boolean; shareBaseUrl?: string } = {},
    ) {
        const ev = await this.findOne(id);
        const fmt = (d: Date | null | undefined) => {
            if (!d) return '—';
            const dd = new Date(d);
            return dd.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
        };
        const brand = ev.brand === 'EXINDO' ? 'CV. Exindo' : ev.brand === 'XPOSER' ? 'CV. Xposer' : 'Lain';
        const klien = ev.customer?.name ?? ev.customerName ?? '—';
        const pic = ev.picWorker?.name ?? ev.picName ?? '—';

        const lines: string[] = [];
        lines.push(`*📅 JADWAL EVENT — ${ev.name}*`);
        lines.push(`_${ev.code} • ${brand}_`);
        lines.push('');
        if (ev.venue) lines.push(`📍 *Lokasi:* ${ev.venue}`);
        lines.push(`👤 *Klien:* ${klien}`);
        lines.push(`🧑‍💼 *PIC:* ${pic}`);
        lines.push('');
        lines.push('*🗓️ Rundown:*');
        lines.push(`🟡 Berangkat : ${fmt(ev.departureStart)}  →  ${fmt(ev.departureEnd)}`);
        lines.push(`🟠 Pasang    : ${fmt(ev.setupStart)}  →  ${fmt(ev.setupEnd)}`);
        lines.push(`🔵 Loading   : ${fmt(ev.loadingStart)}  →  ${fmt(ev.loadingEnd)}`);
        lines.push(`🟢 Event     : ${fmt(ev.eventStart)}  →  ${fmt(ev.eventEnd)}`);
        if (ev.notes) {
            lines.push('');
            lines.push('*📝 Catatan:*');
            lines.push(ev.notes);
        }
        if (opts.includeLink) {
            const token = await this.ensureShareToken(id);
            const base = (opts.shareBaseUrl ?? process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
            lines.push('');
            lines.push(`🔗 Detail lengkap: ${base}/share/events/${token}`);
        }
        return lines.join('\n');
    }

    async ensureShareToken(id: number) {
        const ev = await this.prisma.event.findUnique({ where: { id }, select: { id: true, shareToken: true } });
        if (!ev) throw new NotFoundException(`Event id=${id} tidak ditemukan`);
        if (ev.shareToken) return ev.shareToken;
        const token = crypto.randomBytes(16).toString('hex');
        await this.prisma.event.update({ where: { id }, data: { shareToken: token } });
        return token;
    }

    async regenerateShareToken(id: number) {
        await this.findOne(id);
        const token = crypto.randomBytes(16).toString('hex');
        await this.prisma.event.update({ where: { id }, data: { shareToken: token } });
        return token;
    }

    async findByToken(token: string) {
        const ev = await this.prisma.event.findUnique({
            where: { shareToken: token },
            include: {
                customer: { select: { id: true, name: true, companyName: true } },
                picWorker: { select: { id: true, name: true, position: true } },
                packingItems: {
                    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
                    include: {
                        productVariant: {
                            select: {
                                id: true, sku: true, variantName: true,
                                product: { select: { id: true, name: true } },
                            },
                        },
                        storageLocation: {
                            select: {
                                id: true, code: true, name: true,
                                warehouse: { select: { id: true, name: true } },
                            },
                        },
                        checkedBy: { select: { id: true, name: true } },
                    },
                },
                withdrawals: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        worker: { select: { id: true, name: true } },
                        warehouse: { select: { id: true, name: true } },
                        items: {
                            include: {
                                productVariant: {
                                    select: {
                                        id: true, sku: true, variantName: true,
                                        product: { select: { id: true, name: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!ev) throw new NotFoundException('Link share tidak valid atau sudah dicabut');
        const summary = await this.summarizeWithdrawals(ev.withdrawals as any);
        return { event: ev, summary };
    }

    private async summarizeWithdrawals(withdrawals: any[]) {
        const itemMap = new Map<number, any>();
        for (const w of withdrawals) {
            for (const it of w.items) {
                const v = it.productVariant;
                const qty = Number(it.quantity);
                const ret = Number(it.returnedQty);
                const prev = itemMap.get(v.id);
                if (prev) {
                    prev.totalQuantity += qty;
                    prev.totalReturned += ret;
                    prev.outstanding = prev.totalQuantity - prev.totalReturned;
                    prev.withdrawalCount += 1;
                } else {
                    itemMap.set(v.id, {
                        productVariantId: v.id,
                        sku: v.sku,
                        variantName: v.variantName,
                        productName: v.product.name,
                        totalQuantity: qty,
                        totalReturned: ret,
                        outstanding: qty - ret,
                        withdrawalCount: 1,
                    });
                }
            }
        }
        const items = Array.from(itemMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
        return {
            totalWithdrawals: withdrawals.length,
            totalUniqueItems: items.length,
            totalQty: items.reduce((s, x) => s + x.totalQuantity, 0),
            totalOutstanding: items.reduce((s, x) => s + x.outstanding, 0),
            items,
        };
    }

    async summary(id: number) {
        const ev = await this.findOne(id);
        const itemMap = new Map<number, {
            productVariantId: number;
            sku: string;
            variantName: string | null;
            productName: string;
            totalQuantity: number;
            totalReturned: number;
            outstanding: number;
            withdrawalCount: number;
        }>();

        for (const w of ev.withdrawals) {
            for (const it of w.items) {
                const v = it.productVariant;
                const qty = Number(it.quantity);
                const ret = Number(it.returnedQty);
                const prev = itemMap.get(v.id);
                if (prev) {
                    prev.totalQuantity += qty;
                    prev.totalReturned += ret;
                    prev.outstanding = prev.totalQuantity - prev.totalReturned;
                    prev.withdrawalCount += 1;
                } else {
                    itemMap.set(v.id, {
                        productVariantId: v.id,
                        sku: v.sku,
                        variantName: v.variantName,
                        productName: v.product.name,
                        totalQuantity: qty,
                        totalReturned: ret,
                        outstanding: qty - ret,
                        withdrawalCount: 1,
                    });
                }
            }
        }
        const items = Array.from(itemMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);

        return {
            eventId: ev.id,
            code: ev.code,
            name: ev.name,
            totalWithdrawals: ev.withdrawals.length,
            totalUniqueItems: items.length,
            totalQty: items.reduce((s, x) => s + x.totalQuantity, 0),
            totalOutstanding: items.reduce((s, x) => s + x.outstanding, 0),
            items,
        };
    }

    async dashboardSnapshot() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Events bulan ini (eventStart atau setupStart atau departureStart jatuh di bulan ini)
        const monthEvents = await this.prisma.event.findMany({
            where: {
                status: { notIn: ['DRAFT', 'CANCELLED'] },
                OR: [
                    { eventStart: { gte: monthStart, lt: monthEnd } },
                    { setupStart: { gte: monthStart, lt: monthEnd } },
                    { departureStart: { gte: monthStart, lt: monthEnd } },
                ],
            },
            orderBy: [{ eventStart: 'asc' }, { setupStart: 'asc' }],
            include: {
                customer: { select: { id: true, name: true, companyName: true } },
                picWorker: { select: { id: true, name: true, position: true } },
            },
        });

        // Event sedang berjalan
        const inProgress = await this.prisma.event.findMany({
            where: { status: 'IN_PROGRESS' },
            orderBy: [{ setupStart: 'asc' }],
            include: {
                customer: { select: { id: true, name: true, companyName: true } },
                picWorker: { select: { id: true, name: true, position: true } },
            },
        });

        // PIC aktif: worker yang jadi PIC di event IN_PROGRESS atau yang setup/eventnya overlap "sekarang"
        const activeEventsForPic = await this.prisma.event.findMany({
            where: {
                status: { in: ['IN_PROGRESS', 'SCHEDULED'] },
                picWorkerId: { not: null },
                OR: [
                    { status: 'IN_PROGRESS' },
                    {
                        AND: [
                            { setupStart: { lte: now } },
                            { OR: [{ eventEnd: { gte: now } }, { eventEnd: null }] },
                        ],
                    },
                ],
            },
            orderBy: [{ eventStart: 'asc' }],
            include: {
                picWorker: { select: { id: true, name: true, position: true, phone: true } },
            },
        });

        const picMap = new Map<number, {
            workerId: number;
            name: string;
            position: string | null;
            phone: string | null;
            events: Array<{
                id: number;
                code: string;
                name: string;
                venue: string | null;
                status: EventStatus;
                setupStart: Date | null;
                eventStart: Date | null;
                eventEnd: Date | null;
            }>;
        }>();
        for (const ev of activeEventsForPic) {
            if (!ev.picWorker) continue;
            const w = ev.picWorker;
            const prev = picMap.get(w.id) ?? {
                workerId: w.id,
                name: w.name,
                position: w.position ?? null,
                phone: w.phone ?? null,
                events: [],
            };
            prev.events.push({
                id: ev.id,
                code: ev.code,
                name: ev.name,
                venue: ev.venue,
                status: ev.status,
                setupStart: ev.setupStart,
                eventStart: ev.eventStart,
                eventEnd: ev.eventEnd,
            });
            picMap.set(w.id, prev);
        }
        const activePics = Array.from(picMap.values());

        // Barang keluar (Withdrawal status CHECKED_OUT) — termasuk yang terkait event
        const recentWithdrawals = await this.prisma.withdrawal.findMany({
            where: { status: 'CHECKED_OUT' },
            orderBy: [{ createdAt: 'desc' }],
            take: 15,
            include: {
                worker: { select: { id: true, name: true } },
                event: { select: { id: true, code: true, name: true, venue: true } },
                items: {
                    include: {
                        productVariant: {
                            select: {
                                id: true, sku: true, variantName: true,
                                product: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
            },
        });

        const itemsOut = recentWithdrawals.reduce(
            (s, w) => s + w.items.reduce((ss, it) => ss + (Number(it.quantity) - Number(it.returnedQty)), 0),
            0,
        );

        return {
            stats: {
                monthEvents: monthEvents.length,
                inProgress: inProgress.length,
                activePics: activePics.length,
                itemsOut,
            },
            monthEvents,
            inProgress,
            activePics,
            recentWithdrawals,
            generatedAt: now.toISOString(),
        };
    }
}
