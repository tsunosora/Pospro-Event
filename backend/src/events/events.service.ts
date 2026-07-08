import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { EventBrand, EventStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

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
    // Wage override per event
    dailyWageRate?: number | string | null;
    overtimeRatePerHour?: number | string | null;
    // Wage khusus PIC (dipakai untuk worker yang = event.picWorkerId). Null = ikut member rate.
    dailyWageRatePic?: number | string | null;
    overtimeRatePerHourPic?: number | string | null;
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

const EVENT_STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Draft',
    SCHEDULED: 'Terjadwal',
    IN_PROGRESS: 'Berjalan',
    COMPLETED: 'Selesai',
    CANCELLED: 'Dibatalkan',
};

@Injectable()
export class EventsService {
    constructor(
        private prisma: PrismaService,
        private notifications: NotificationsService,
    ) { }

    private async generateCode(date: Date) {
        const year = date.getFullYear();
        const prefix = `EVT-${year}-`;
        const last = await this.prisma.event.findFirst({
            where: { code: { startsWith: prefix } },
            orderBy: { code: 'desc' },
            select: { code: true },
        });
        const lastSeq = last ? (parseInt(last.code.slice(prefix.length), 10) || 0) : 0;
        const seq = String(lastSeq + 1).padStart(4, '0');
        return `${prefix}${seq}`;
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

    /**
     * Versi publik untuk timeline yang dibagikan ke tukang (tanpa login).
     * Hanya event status operasional (bukan DRAFT/CANCELLED). Melampirkan
     * orderDescription dari Lead (via Customer) supaya tukang tahu barang yang dipesan.
     * Tidak memuat data finansial/RAB.
     */
    async findAllPublic(filter: { year?: number; month?: number; teamId?: number } = {}) {
        const where: any = {
            status: { in: [EventStatus.SCHEDULED, EventStatus.IN_PROGRESS, EventStatus.COMPLETED] },
        };
        if (filter.year) {
            const start = new Date(filter.year, filter.month ? filter.month - 1 : 0, 1);
            const end = filter.month
                ? new Date(filter.year, filter.month, 1)
                : new Date(filter.year + 1, 0, 1);
            where.OR = [
                { eventStart: { gte: start, lt: end } },
                { eventEnd: { gte: start, lt: end } },
                { setupStart: { gte: start, lt: end } },
                { departureStart: { gte: start, lt: end } },
            ];
        }
        // Filter per team/bagian — hanya event yang punya crew dari team tsb.
        if (filter.teamId) {
            where.crewAssignments = { some: { teamId: filter.teamId } };
        }

        const events = await this.prisma.event.findMany({
            where,
            orderBy: [{ eventStart: 'asc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                code: true,
                name: true,
                brand: true,
                status: true,
                venue: true,
                customerId: true,
                customerName: true,
                picName: true,
                departureStart: true, departureEnd: true,
                setupStart: true, setupEnd: true,
                loadingStart: true, loadingEnd: true,
                eventStart: true, eventEnd: true,
                customer: { select: { id: true, name: true, companyName: true } },
                picWorker: { select: { id: true, name: true, position: true } },
                crewAssignments: {
                    select: { team: { select: { id: true, name: true, color: true } } },
                },
            },
        });

        // Lookup orderDescription dari Lead via Customer (Lead.convertedCustomerId === event.customerId).
        const customerIds = Array.from(
            new Set(events.map((e) => e.customerId).filter((id): id is number => id != null)),
        );
        const descByCustomer = new Map<number, string>();
        if (customerIds.length > 0) {
            const leads = await this.prisma.lead.findMany({
                where: { convertedCustomerId: { in: customerIds }, orderDescription: { not: null } },
                select: { convertedCustomerId: true, orderDescription: true },
            });
            for (const l of leads) {
                if (l.convertedCustomerId != null && l.orderDescription) {
                    descByCustomer.set(l.convertedCustomerId, l.orderDescription);
                }
            }
        }

        return events.map((ev) => {
            // Team unik per event (untuk chip & judul filter di halaman publik).
            const teamMap = new Map<number, { id: number; name: string; color: string }>();
            for (const a of ev.crewAssignments ?? []) {
                if (a.team) teamMap.set(a.team.id, a.team);
            }
            const { crewAssignments, ...rest } = ev;
            return {
                ...rest,
                teams: Array.from(teamMap.values()),
                orderDescription: ev.customerId != null ? (descByCustomer.get(ev.customerId) ?? null) : null,
            };
        });
    }

    // ── Token link publik Event Timeline (kiosk tukang) ──────────────────
    private async getStoreSettingsRow() {
        // orderBy id asc → baris kanonik yang stabil (bisa ada >1 baris storeSettings).
        let s = await this.prisma.storeSettings.findFirst({
            orderBy: { id: 'asc' },
            select: { id: true, timelineShareToken: true },
        });
        if (!s) {
            s = await this.prisma.storeSettings.create({
                data: { storeName: 'PosPro', storeAddress: '' },
                select: { id: true, timelineShareToken: true },
            });
        }
        return s;
    }

    /** Ambil token timeline yang ada, atau buat baru bila belum ada. */
    async ensureTimelineShareToken() {
        const s = await this.getStoreSettingsRow();
        if (s.timelineShareToken) return s.timelineShareToken;
        const token = crypto.randomBytes(16).toString('hex');
        await this.prisma.storeSettings.update({
            where: { id: s.id },
            data: { timelineShareToken: token },
        });
        return token;
    }

    /** Buat token baru — mencabut akses link timeline lama. */
    async regenerateTimelineShareToken() {
        const s = await this.getStoreSettingsRow();
        const token = crypto.randomBytes(16).toString('hex');
        await this.prisma.storeSettings.update({
            where: { id: s.id },
            data: { timelineShareToken: token },
        });
        return token;
    }

    /** Endpoint publik: validasi token lalu kembalikan data timeline. */
    async findTimelineByToken(token: string, filter: { year?: number; month?: number; teamId?: number } = {}) {
        const s = await this.prisma.storeSettings.findFirst({
            orderBy: { id: 'asc' },
            select: { timelineShareToken: true },
        });
        if (!token || !s?.timelineShareToken || s.timelineShareToken !== token) {
            throw new NotFoundException('Link timeline tidak valid atau sudah dicabut');
        }
        return this.findAllPublic(filter);
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
        if (name.length > 255) throw new BadRequestException('Nama event terlalu panjang (maks 255 karakter)');

        const now = new Date();
        const data = {
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
            dailyWageRate: input.dailyWageRate != null && input.dailyWageRate !== '' ? input.dailyWageRate as any : null,
            overtimeRatePerHour: input.overtimeRatePerHour != null && input.overtimeRatePerHour !== '' ? input.overtimeRatePerHour as any : null,
            dailyWageRatePic: input.dailyWageRatePic != null && input.dailyWageRatePic !== '' ? input.dailyWageRatePic as any : null,
            overtimeRatePerHourPic: input.overtimeRatePerHourPic != null && input.overtimeRatePerHourPic !== '' ? input.overtimeRatePerHourPic as any : null,
        };

        // Retry sekali jika race condition P2002 (dua request bersamaan dapat kode sama)
        for (let attempt = 0; attempt < 2; attempt++) {
            const code = await this.generateCode(now);
            try {
                const created = await this.prisma.event.create({ data: { code, ...data } });
                this.notifyEventCreated(created).catch(() => { });
                return created;
            } catch (err: any) {
                if (attempt === 0 && err?.code === 'P2002' && err?.meta?.target?.includes('code')) continue;
                throw err;
            }
        }
    }

    async update(id: number, input: UpdateEventInput) {
        const existing = await this.findOne(id);
        const data: any = {};
        if (input.name !== undefined) {
            const n = input.name.trim();
            if (!n) throw new BadRequestException('Nama event wajib diisi');
            if (n.length > 255) throw new BadRequestException('Nama event terlalu panjang (maks 255 karakter)');
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
        if (input.dailyWageRate !== undefined) {
            data.dailyWageRate = input.dailyWageRate != null && input.dailyWageRate !== '' ? input.dailyWageRate as any : null;
        }
        if (input.overtimeRatePerHour !== undefined) {
            data.overtimeRatePerHour = input.overtimeRatePerHour != null && input.overtimeRatePerHour !== '' ? input.overtimeRatePerHour as any : null;
        }
        if (input.dailyWageRatePic !== undefined) {
            data.dailyWageRatePic = input.dailyWageRatePic != null && input.dailyWageRatePic !== '' ? input.dailyWageRatePic as any : null;
        }
        if (input.overtimeRatePerHourPic !== undefined) {
            data.overtimeRatePerHourPic = input.overtimeRatePerHourPic != null && input.overtimeRatePerHourPic !== '' ? input.overtimeRatePerHourPic as any : null;
        }

        const phaseFields: (keyof EventPhaseInput)[] = [
            'departureStart', 'departureEnd',
            'setupStart', 'setupEnd',
            'loadingStart', 'loadingEnd',
            'eventStart', 'eventEnd',
        ];
        for (const k of phaseFields) {
            if ((input as any)[k] !== undefined) data[k] = toDate((input as any)[k]);
        }

        const updated = await this.prisma.event.update({ where: { id }, data });
        if (input.status !== undefined && input.status !== (existing as any).status) {
            this.notifyEventStatus(updated, (existing as any).status).catch(() => { });
        }
        return updated;
    }

    /** Notif Discord: event/pipeline baru dibuat. */
    private async notifyEventCreated(ev: any) {
        const brand = ev.brand === 'EXINDO' ? 'CV. Exindo' : ev.brand === 'XPOSER' ? 'CV. Xposer' : ev.brand;
        const lines = [
            `🎪 **Event Baru Dibuat — ${ev.name}**`,
            `🏷️ ${ev.code} • ${brand}`,
        ];
        if (ev.venue) lines.push(`📍 Venue: ${ev.venue}`);
        if (ev.customerName) lines.push(`👤 Klien: ${ev.customerName}`);
        if (ev.picName) lines.push(`🧑‍💼 PIC: ${ev.picName}`);
        if (ev.eventStart) {
            const d = new Date(ev.eventStart).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            lines.push(`📅 Mulai: ${d}`);
        }
        lines.push(`📌 Status: ${EVENT_STATUS_LABEL[ev.status] ?? ev.status}`);
        await this.notifications.notifyDiscord(lines.join('\n'));
    }

    /** Notif Discord: status event berubah (mis. SCHEDULED → berjalan → selesai). */
    private async notifyEventStatus(ev: any, oldStatus: string) {
        const emoji = ev.status === 'IN_PROGRESS' ? '🚀'
            : ev.status === 'COMPLETED' ? '✅'
            : ev.status === 'CANCELLED' ? '🚫' : '🔄';
        await this.notifications.notifyDiscord(
            `${emoji} **Status Event — ${ev.name}** (${ev.code})\n` +
            `${EVENT_STATUS_LABEL[oldStatus] ?? oldStatus} → **${EVENT_STATUS_LABEL[ev.status] ?? ev.status}**`,
        );
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

    async buildEventMessage(
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
        lines.push(`**📅 JADWAL EVENT — ${ev.name}**`);
        lines.push(`_${ev.code} • ${brand}_`);
        lines.push('');
        if (ev.venue) lines.push(`📍 **Lokasi:** ${ev.venue}`);
        lines.push(`👤 **Klien:** ${klien}`);
        lines.push(`🧑‍💼 **PIC:** ${pic}`);
        lines.push('');
        lines.push('**🗓️ Rundown:**');
        lines.push(`🟡 Berangkat : ${fmt(ev.departureStart)}  →  ${fmt(ev.departureEnd)}`);
        lines.push(`🟠 Pasang    : ${fmt(ev.setupStart)}  →  ${fmt(ev.setupEnd)}`);
        lines.push(`🔵 Loading   : ${fmt(ev.loadingStart)}  →  ${fmt(ev.loadingEnd)}`);
        lines.push(`🟢 Event     : ${fmt(ev.eventStart)}  →  ${fmt(ev.eventEnd)}`);
        if (ev.notes) {
            lines.push('');
            lines.push('**📝 Catatan:**');
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
