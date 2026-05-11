import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, LeadLevel, LeadSource, LeadStatus, EventBrand } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone } from '../utils/phone.util';

export interface CreateLeadInput {
    name?: string;
    phone: string;
    organization?: string;
    productCategory?: string;
    city?: string;
    brand?: EventBrand | null;
    level?: LeadLevel | null;
    source?: LeadSource;
    sourceDetail?: string;
    greetingTemplate?: string;
    status?: LeadStatus;
    stageId?: number;
    assignedWorkerId?: number | null;
    followUpDate?: string | null;
    orderDescription?: string;
    projectValueEst?: number | string | null;
    eventDateStart?: string | null;
    eventDateEnd?: string | null;
    eventLocation?: string;
    notes?: string;
    leadCameAt?: string;
    lastContactedAt?: string | null;
    labelIds?: number[];
}

export interface UpdateLeadInput extends Partial<CreateLeadInput> { }

export interface ReorderInput {
    leadId: number;
    newStageId: number;
    newOrderIndex: number;
}

export interface ActivityInput {
    kind: string;
    text?: string;
    workerId?: number | null;
    meta?: any;
}

export interface ConvertInput {
    createQuotation?: boolean;
    quotationVariant?: 'SEWA' | 'PENGADAAN_BOOTH';
    createRab?: boolean;
}

const LEAD_INCLUDE = {
    stage: true,
    assignedWorker: { select: { id: true, name: true, position: true, photoUrl: true } },
    previousAssignedWorker: { select: { id: true, name: true, position: true, photoUrl: true } },
    labels: { include: { label: true } },
    convertedCustomer: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
    constructor(private prisma: PrismaService) { }

    private toDate(s: string | null | undefined): Date | null | undefined {
        if (s === undefined) return undefined;
        if (s === null || s === '') return null;
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    private decOrNull(v: number | string | null | undefined): Prisma.Decimal | null | undefined {
        if (v === undefined) return undefined;
        if (v === null || v === '') return null;
        try { return new Prisma.Decimal(v as any); } catch { return null; }
    }

    private async pickDefaultStage() {
        const s = await this.prisma.leadStage.findFirst({
            where: { isTerminal: false },
            orderBy: { orderIndex: 'asc' },
        });
        if (!s) throw new BadRequestException('Belum ada LeadStage. Jalankan seed-crm dulu.');
        return s;
    }

    async board() {
        const stages = await this.prisma.leadStage.findMany({
            where: { isTerminal: false },
            orderBy: { orderIndex: 'asc' },
        });
        const leads = await this.prisma.lead.findMany({
            where: { stage: { isTerminal: false } },
            orderBy: [{ stageId: 'asc' }, { stageOrderIndex: 'asc' }],
            include: LEAD_INCLUDE,
        });
        const grouped: Record<number, typeof leads> = {};
        for (const s of stages) grouped[s.id] = [];
        for (const l of leads) (grouped[l.stageId] ??= []).push(l);
        return { stages, leadsByStage: grouped };
    }

    async list(params: {
        stageId?: number;
        level?: LeadLevel;
        assignedWorkerId?: number;
        brand?: EventBrand;
        city?: string;
        productCategory?: string;
        search?: string;
        from?: string;
        to?: string;
        limit?: number;
        offset?: number;
    }) {
        const where: Prisma.LeadWhereInput = {};
        if (params.stageId) where.stageId = params.stageId;
        if (params.level) where.level = params.level;
        if (params.assignedWorkerId) where.assignedWorkerId = params.assignedWorkerId;
        if (params.brand) where.brand = params.brand;
        if (params.city) where.city = params.city;
        if (params.productCategory) where.productCategory = params.productCategory;
        if (params.search) {
            const s = params.search.trim();
            where.OR = [
                { name: { contains: s } },
                { organization: { contains: s } },
                { phone: { contains: s } },
                { phoneNormalized: { contains: normalizePhone(s) } },
                { orderDescription: { contains: s } },
                { notes: { contains: s } },
                { city: { contains: s } },
            ];
        }
        if (params.from || params.to) {
            where.leadCameAt = {};
            if (params.from) (where.leadCameAt as any).gte = new Date(params.from);
            if (params.to) (where.leadCameAt as any).lte = new Date(params.to);
        }
        const [items, total] = await this.prisma.$transaction([
            this.prisma.lead.findMany({
                where,
                include: LEAD_INCLUDE,
                orderBy: { leadCameAt: 'desc' },
                take: Math.min(Math.max(params.limit ?? 50, 1), 500),
                skip: Math.max(params.offset ?? 0, 0),
            }),
            this.prisma.lead.count({ where }),
        ]);
        return { items, total };
    }

    async getOne(id: number) {
        const lead = await this.prisma.lead.findUnique({
            where: { id },
            include: {
                ...LEAD_INCLUDE,
                activities: {
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                    include: { worker: { select: { id: true, name: true } } },
                },
            },
        });
        if (!lead) throw new NotFoundException(`Lead ${id} tidak ditemukan`);
        return lead;
    }

    async create(input: CreateLeadInput) {
        if (!input.phone?.trim()) throw new BadRequestException('phone wajib diisi');
        const phoneNorm = normalizePhone(input.phone);
        if (!phoneNorm) throw new BadRequestException('phone tidak valid');

        let stageId = input.stageId;
        if (!stageId) stageId = (await this.pickDefaultStage()).id;

        const max = await this.prisma.lead.aggregate({
            where: { stageId },
            _max: { stageOrderIndex: true },
        });

        const labelIds = input.labelIds ?? [];
        const lead = await this.prisma.lead.create({
            data: {
                name: input.name?.trim() || null,
                phone: input.phone.trim(),
                phoneNormalized: phoneNorm,
                organization: input.organization?.trim() || null,
                productCategory: input.productCategory?.trim() || null,
                city: input.city?.trim() || null,
                brand: input.brand ?? null,
                level: input.level ?? null,
                source: input.source ?? 'OTHER',
                sourceDetail: input.sourceDetail?.trim() || null,
                greetingTemplate: input.greetingTemplate?.trim() || null,
                status: input.status ?? 'NEW',
                stageId,
                stageOrderIndex: (max._max.stageOrderIndex ?? -1) + 1,
                assignedWorkerId: input.assignedWorkerId ?? null,
                followUpDate: this.toDate(input.followUpDate) ?? null,
                orderDescription: input.orderDescription?.trim() || null,
                projectValueEst: this.decOrNull(input.projectValueEst) ?? null,
                // Cast `as any` — column baru hasil rename + add, Prisma Client perlu regenerate dulu.
                ...(({
                    eventDateStart: this.toDate(input.eventDateStart) ?? null,
                    eventDateEnd: this.toDate(input.eventDateEnd) ?? null,
                }) as any),
                eventLocation: input.eventLocation?.trim() || null,
                notes: input.notes?.trim() || null,
                leadCameAt: this.toDate(input.leadCameAt) || new Date(),
                lastContactedAt: this.toDate(input.lastContactedAt) ?? null,
                labels: labelIds.length
                    ? { create: labelIds.map((labelId) => ({ labelId })) }
                    : undefined,
            },
            include: LEAD_INCLUDE,
        });
        return lead;
    }

    async update(id: number, input: UpdateLeadInput) {
        const existing = await this.prisma.lead.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Lead ${id} tidak ditemukan`);

        const data: Prisma.LeadUpdateInput = {};
        if (input.name !== undefined) data.name = input.name?.trim() || null;
        if (input.phone !== undefined) {
            data.phone = input.phone.trim();
            data.phoneNormalized = normalizePhone(input.phone);
        }
        if (input.organization !== undefined) data.organization = input.organization?.trim() || null;
        if (input.productCategory !== undefined) data.productCategory = input.productCategory?.trim() || null;
        if (input.city !== undefined) data.city = input.city?.trim() || null;
        if (input.brand !== undefined) data.brand = input.brand;
        if (input.level !== undefined) data.level = input.level;
        if (input.source !== undefined) data.source = input.source;
        if (input.sourceDetail !== undefined) data.sourceDetail = input.sourceDetail?.trim() || null;
        if (input.greetingTemplate !== undefined) data.greetingTemplate = input.greetingTemplate?.trim() || null;
        if (input.status !== undefined) data.status = input.status;

        // Detect transfer: assigned worker berubah & sebelumnya sudah ada owner
        let transferLog: { from: number; to: number | null } | null = null;
        if (input.assignedWorkerId !== undefined) {
            const newWid = input.assignedWorkerId ?? null;
            const oldWid = existing.assignedWorkerId ?? null;
            if (newWid !== oldWid) {
                if (oldWid !== null) {
                    // Ada transfer dari marketer lama ke marketer baru (atau ke "tidak di-assign")
                    data.previousAssignedWorker = { connect: { id: oldWid } };
                    transferLog = { from: oldWid, to: newWid };
                }
                data.assignedWorker = newWid
                    ? { connect: { id: newWid } }
                    : { disconnect: true };
            }
        }
        if (input.followUpDate !== undefined) data.followUpDate = this.toDate(input.followUpDate);
        if (input.orderDescription !== undefined) data.orderDescription = input.orderDescription?.trim() || null;
        if (input.projectValueEst !== undefined) data.projectValueEst = this.decOrNull(input.projectValueEst);
        // Cast `as any` — column baru, Prisma Client perlu regenerate dulu
        if (input.eventDateStart !== undefined) (data as any).eventDateStart = this.toDate(input.eventDateStart);
        if (input.eventDateEnd !== undefined) (data as any).eventDateEnd = this.toDate(input.eventDateEnd);
        if (input.eventLocation !== undefined) data.eventLocation = input.eventLocation?.trim() || null;
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        if (input.lastContactedAt !== undefined) data.lastContactedAt = this.toDate(input.lastContactedAt);

        const updated = await this.prisma.lead.update({ where: { id }, data, include: LEAD_INCLUDE });

        // Auto-log TRANSFERRED activity bila assignedWorker berubah dari marketer lain
        if (transferLog) {
            const [fromW, toW] = await Promise.all([
                this.prisma.worker.findUnique({ where: { id: transferLog.from }, select: { name: true } }),
                transferLog.to !== null
                    ? this.prisma.worker.findUnique({ where: { id: transferLog.to }, select: { name: true } })
                    : Promise.resolve(null),
            ]);
            const fromName = fromW?.name ?? `#${transferLog.from}`;
            const toName = transferLog.to !== null ? (toW?.name ?? `#${transferLog.to}`) : '(tidak di-assign)';
            await this.prisma.leadActivity.create({
                data: {
                    leadId: id,
                    kind: 'TRANSFERRED',
                    text: `Pindah tangan dari ${fromName} ke ${toName}`,
                    workerId: transferLog.to,
                    meta: { fromWorkerId: transferLog.from, toWorkerId: transferLog.to },
                },
            });
        }

        if (input.labelIds !== undefined) {
            await this.prisma.leadLabelOnLead.deleteMany({ where: { leadId: id } });
            if (input.labelIds.length > 0) {
                await this.prisma.leadLabelOnLead.createMany({
                    data: input.labelIds.map((labelId) => ({ leadId: id, labelId })),
                });
            }
            return this.getOne(id);
        }
        return updated;
    }

    async remove(id: number) {
        await this.prisma.lead.delete({ where: { id } });
        return { ok: true };
    }

    /** Set / clear image URL untuk lead — dipakai oleh upload-image & remove-image endpoint. */
    async setImage(id: number, imageUrl: string | null) {
        const lead = await this.prisma.lead.update({
            where: { id },
            data: { imageUrl },
            select: { id: true, name: true, imageUrl: true },
        });
        return lead;
    }

    /** Drag-drop reorder antar / dalam kolom kanban. */
    async reorder({ leadId, newStageId, newOrderIndex }: ReorderInput) {
        const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) throw new NotFoundException(`Lead ${leadId} tidak ditemukan`);
        const targetStage = await this.prisma.leadStage.findUnique({ where: { id: newStageId } });
        if (!targetStage) throw new NotFoundException(`Stage ${newStageId} tidak ditemukan`);

        const oldStageId = lead.stageId;
        const stageChanged = oldStageId !== newStageId;

        await this.prisma.$transaction(async (tx) => {
            if (stageChanged) {
                // Kompres kolom asal: kurangi orderIndex setelah posisi lead lama
                await tx.lead.updateMany({
                    where: { stageId: oldStageId, stageOrderIndex: { gt: lead.stageOrderIndex } },
                    data: { stageOrderIndex: { decrement: 1 } },
                });
                // Buka slot di kolom tujuan
                await tx.lead.updateMany({
                    where: { stageId: newStageId, stageOrderIndex: { gte: newOrderIndex } },
                    data: { stageOrderIndex: { increment: 1 } },
                });
                await tx.lead.update({
                    where: { id: leadId },
                    data: { stageId: newStageId, stageOrderIndex: newOrderIndex },
                });

                // Status auto-sync (kasar) — tetap bisa dioverride lewat update biasa
                const newStatus = targetStage.isWinStage
                    ? 'CLOSED_DEAL'
                    : targetStage.isTerminal
                        ? 'CLOSED_LOST'
                        : lead.status === 'NEW' && newOrderIndex >= 0
                            ? 'IN_PROGRESS'
                            : lead.status;
                if (newStatus !== lead.status) {
                    await tx.lead.update({ where: { id: leadId }, data: { status: newStatus as LeadStatus } });
                }

                await tx.leadActivity.create({
                    data: {
                        leadId,
                        kind: 'STAGE_CHANGED',
                        text: null,
                        meta: { fromStageId: oldStageId, toStageId: newStageId },
                    },
                });
            } else {
                // Same column reorder — geser lainnya
                if (newOrderIndex < lead.stageOrderIndex) {
                    await tx.lead.updateMany({
                        where: {
                            stageId: oldStageId,
                            stageOrderIndex: { gte: newOrderIndex, lt: lead.stageOrderIndex },
                        },
                        data: { stageOrderIndex: { increment: 1 } },
                    });
                } else if (newOrderIndex > lead.stageOrderIndex) {
                    await tx.lead.updateMany({
                        where: {
                            stageId: oldStageId,
                            stageOrderIndex: { gt: lead.stageOrderIndex, lte: newOrderIndex },
                        },
                        data: { stageOrderIndex: { decrement: 1 } },
                    });
                }
                await tx.lead.update({
                    where: { id: leadId },
                    data: { stageOrderIndex: newOrderIndex },
                });
            }
        });

        return this.getOne(leadId);
    }

    // ---- Activities ----

    async addActivity(leadId: number, input: ActivityInput) {
        if (!input.kind?.trim()) throw new BadRequestException('kind wajib');
        const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) throw new NotFoundException(`Lead ${leadId} tidak ditemukan`);

        const activity = await this.prisma.leadActivity.create({
            data: {
                leadId,
                kind: input.kind.trim().toUpperCase(),
                text: input.text?.trim() || null,
                workerId: input.workerId ?? null,
                meta: input.meta ?? Prisma.JsonNull,
            },
        });

        // Auto-bump lastContactedAt untuk activity yang relevan
        if (['GREETING_SENT', 'COMPRO_SENT', 'RESPONSE', 'CALL', 'WHATSAPP'].includes(activity.kind)) {
            await this.prisma.lead.update({
                where: { id: leadId },
                data: { lastContactedAt: new Date() },
            });
        }

        return activity;
    }

    async listActivities(leadId: number) {
        return this.prisma.leadActivity.findMany({
            where: { leadId },
            orderBy: { createdAt: 'desc' },
            include: { worker: { select: { id: true, name: true } } },
        });
    }

    // ---- Convert ----

    async convert(leadId: number, input: ConvertInput) {
        const lead = await this.prisma.lead.findUnique({
            where: { id: leadId },
            include: { stage: true },
        });
        if (!lead) throw new NotFoundException(`Lead ${leadId} tidak ditemukan`);
        if (lead.convertedCustomerId) {
            throw new BadRequestException('Lead sudah pernah di-convert');
        }
        if (!lead.name?.trim()) {
            throw new BadRequestException('Nama lead kosong — isi dulu sebelum convert');
        }

        return this.prisma.$transaction(async (tx) => {
            const customer = await tx.customer.create({
                data: {
                    name: lead.name!.trim(),
                    phone: lead.phone,
                    companyName: lead.organization || null,
                    address: lead.eventLocation || null,
                },
            });

            await tx.lead.update({
                where: { id: leadId },
                data: { convertedCustomerId: customer.id, convertedAt: new Date() },
            });

            await tx.leadActivity.create({
                data: {
                    leadId,
                    kind: 'CONVERTED',
                    text: `Convert ke Customer #${customer.id}`,
                    meta: { customerId: customer.id, options: input as any },
                },
            });

            // TODO: createQuotation / createRab — disatukan di milestone berikutnya
            return { customerId: customer.id, customer };
        });
    }

    // ---- Stats ----

    async stats() {
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dow = (now.getDay() + 6) % 7; // Senin=0
        const startWeek = new Date(startToday);
        startWeek.setDate(startToday.getDate() - dow);
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [today, week, month, total, converted, bySource] = await this.prisma.$transaction([
            this.prisma.lead.count({ where: { leadCameAt: { gte: startToday } } }),
            this.prisma.lead.count({ where: { leadCameAt: { gte: startWeek } } }),
            this.prisma.lead.count({ where: { leadCameAt: { gte: startMonth } } }),
            this.prisma.lead.count(),
            this.prisma.lead.count({ where: { convertedAt: { not: null } } }),
            this.prisma.lead.groupBy({
                by: ['source'],
                _count: { _all: true },
                where: { leadCameAt: { gte: startMonth } },
                orderBy: { source: 'asc' },
            }),
        ]);

        return {
            today,
            week,
            month,
            total,
            converted,
            conversionRate: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0,
            bySource,
        };
    }

    /** Untuk autocomplete: return nilai unik dari kolom tertentu yang sudah pernah dipakai. */
    async distinctValues(field: 'city' | 'productCategory' | 'sourceDetail'): Promise<string[]> {
        const rows = await this.prisma.lead.findMany({
            where: { [field]: { not: null } },
            select: { [field]: true },
            distinct: [field],
            take: 500,
        });
        return rows
            .map((r) => (r as any)[field] as string | null)
            .filter((v): v is string => !!v && v.trim() !== '')
            .sort((a, b) => a.localeCompare(b, 'id'));
    }

    /**
     * Dashboard summary lengkap untuk halaman /crm
     * - Total + avg lead per hari
     * - Distribusi level (kualitas lead)
     * - Distribusi sumber & status
     * - Project value: won / lost / pipeline
     * - Series harian untuk chart
     */
    async dashboardSummary(params: { from?: string; to?: string; brand?: EventBrand }) {
        const fromDate = params.from ? new Date(params.from) : null;
        const toDate = params.to ? new Date(params.to) : null;
        const where: Prisma.LeadWhereInput = {};
        if (params.brand) where.brand = params.brand;
        if (fromDate || toDate) {
            where.leadCameAt = {};
            if (fromDate) (where.leadCameAt as any).gte = fromDate;
            if (toDate) (where.leadCameAt as any).lte = toDate;
        }

        const [total, byLevel, bySource, byStatus, valueWonAgg, valueLostAgg, valuePipeAgg, byStage, leads] =
            await Promise.all([
                this.prisma.lead.count({ where }),
                this.prisma.lead.groupBy({
                    by: ['level'],
                    _count: { _all: true },
                    where,
                    orderBy: { level: 'asc' },
                }),
                this.prisma.lead.groupBy({
                    by: ['source'],
                    _count: { _all: true },
                    where,
                    orderBy: { source: 'asc' },
                }),
                this.prisma.lead.groupBy({
                    by: ['status'],
                    _count: { _all: true },
                    where,
                    orderBy: { status: 'asc' },
                }),
                this.prisma.lead.aggregate({
                    where: { ...where, status: 'CLOSED_DEAL' as LeadStatus },
                    _sum: { projectValueEst: true },
                    _count: { _all: true },
                }),
                this.prisma.lead.aggregate({
                    where: { ...where, status: 'CLOSED_LOST' as LeadStatus },
                    _sum: { projectValueEst: true },
                    _count: { _all: true },
                }),
                this.prisma.lead.aggregate({
                    where: {
                        ...where,
                        status: {
                            in: ['NEW', 'CONTACTED', 'RESPONDED', 'NO_RESPONSE', 'WAITING', 'IN_PROGRESS'] as LeadStatus[],
                        },
                    },
                    _sum: { projectValueEst: true },
                    _count: { _all: true },
                }),
                this.prisma.lead.groupBy({
                    by: ['stageId'],
                    _count: { _all: true },
                    where,
                    orderBy: { stageId: 'asc' },
                }),
                this.prisma.lead.findMany({
                    where,
                    select: {
                        leadCameAt: true,
                        status: true,
                        projectValueEst: true,
                    },
                    take: 5000,
                    orderBy: { leadCameAt: 'asc' },
                }),
            ]);

        // Build daily series: bucket by yyyy-MM-dd
        const buckets = new Map<string, { count: number; won: number; lost: number; valueWon: number; valueLost: number }>();
        const start = fromDate ?? (leads[0]?.leadCameAt ?? new Date());
        const end = toDate ?? new Date();
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
            const key = d.toISOString().slice(0, 10);
            buckets.set(key, { count: 0, won: 0, lost: 0, valueWon: 0, valueLost: 0 });
        }
        for (const l of leads) {
            const key = l.leadCameAt.toISOString().slice(0, 10);
            const b = buckets.get(key) ?? { count: 0, won: 0, lost: 0, valueWon: 0, valueLost: 0 };
            b.count += 1;
            if (l.status === 'CLOSED_DEAL') {
                b.won += 1;
                b.valueWon += Number(l.projectValueEst ?? 0);
            } else if (l.status === 'CLOSED_LOST') {
                b.lost += 1;
                b.valueLost += Number(l.projectValueEst ?? 0);
            }
            buckets.set(key, b);
        }
        const dailySeries = Array.from(buckets.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v }));

        const days = Math.max(1, dailySeries.length);
        const avgPerDay = Math.round((total / days) * 10) / 10;

        // Stage labels
        const stages = await this.prisma.leadStage.findMany({
            select: { id: true, name: true, color: true, isWinStage: true, isTerminal: true },
        });
        const stageMap = new Map(stages.map((s) => [s.id, s]));

        const wonValue = Number(valueWonAgg._sum.projectValueEst ?? 0);
        const lostValue = Number(valueLostAgg._sum.projectValueEst ?? 0);
        const pipeValue = Number(valuePipeAgg._sum.projectValueEst ?? 0);
        const wonCount = valueWonAgg._count._all;
        const lostCount = valueLostAgg._count._all;
        const pipeCount = valuePipeAgg._count._all;
        const closedTotal = wonCount + lostCount;
        const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 1000) / 10 : 0;

        return {
            period: {
                from: fromDate ? fromDate.toISOString() : null,
                to: toDate ? toDate.toISOString() : null,
                days,
            },
            total,
            avgPerDay,
            byLevel: byLevel.map((b) => ({ level: b.level ?? 'UNSET', count: b._count._all })),
            bySource: bySource.map((b) => ({ source: b.source, count: b._count._all })),
            byStatus: byStatus.map((b) => ({ status: b.status, count: b._count._all })),
            byStage: byStage
                .map((b) => {
                    const s = stageMap.get(b.stageId);
                    return s
                        ? { stageId: b.stageId, name: s.name, color: s.color, isWinStage: s.isWinStage, isTerminal: s.isTerminal, count: b._count._all }
                        : null;
                })
                .filter((x): x is NonNullable<typeof x> => x !== null),
            projectValue: {
                won: wonValue,
                lost: lostValue,
                pipeline: pipeValue,
                wonCount,
                lostCount,
                pipelineCount: pipeCount,
                winRate,
            },
            dailySeries,
        };
    }

    /** Performa per marketer: jumlah lead, conversion, total nilai, respon, stuck. */
    async performanceByMarketer(params: { from?: string; to?: string; brand?: EventBrand }) {
        const where: Prisma.LeadWhereInput = {};
        if (params.brand) where.brand = params.brand;
        if (params.from || params.to) {
            where.leadCameAt = {};
            if (params.from) (where.leadCameAt as any).gte = new Date(params.from);
            if (params.to) (where.leadCameAt as any).lte = new Date(params.to);
        }

        // Hanya hitung performa untuk role yang menangani lead di CRM
        const workers = await this.prisma.worker.findMany({
            where: { isActive: true, position: { in: ['MARKETING', 'SALES'] } },
            select: { id: true, name: true, position: true, photoUrl: true },
            orderBy: { name: 'asc' },
        });

        const STUCK_DAYS = 7;
        const stuckThreshold = new Date(Date.now() - STUCK_DAYS * 24 * 60 * 60 * 1000);
        const openStatuses: LeadStatus[] = [
            'NEW',
            'CONTACTED',
            'RESPONDED',
            'NO_RESPONSE',
            'WAITING',
            'IN_PROGRESS',
        ];

        const rows = await Promise.all(
            workers.map(async (w) => {
                const baseWhere: Prisma.LeadWhereInput = { ...where, assignedWorkerId: w.id };

                const [total, won, valueAgg, respLeads, stuck] = await this.prisma.$transaction([
                    this.prisma.lead.count({ where: baseWhere }),
                    this.prisma.lead.count({
                        where: { ...baseWhere, status: 'CLOSED_DEAL' },
                    }),
                    this.prisma.lead.aggregate({
                        where: { ...baseWhere, status: 'CLOSED_DEAL' },
                        _sum: { projectValueEst: true },
                    }),
                    this.prisma.lead.findMany({
                        where: { ...baseWhere, lastContactedAt: { not: null } },
                        select: { leadCameAt: true, lastContactedAt: true },
                        take: 1000,
                    }),
                    this.prisma.lead.count({
                        where: {
                            ...baseWhere,
                            status: { in: openStatuses },
                            OR: [
                                { lastContactedAt: null, leadCameAt: { lt: stuckThreshold } },
                                { lastContactedAt: { lt: stuckThreshold } },
                            ],
                        },
                    }),
                ]);

                const respHours = respLeads
                    .map((r) =>
                        r.lastContactedAt
                            ? (r.lastContactedAt.getTime() - r.leadCameAt.getTime()) / 3600000
                            : 0,
                    )
                    .filter((h) => h >= 0);
                const avgRespHours = respHours.length
                    ? Math.round((respHours.reduce((a, b) => a + b, 0) / respHours.length) * 10) / 10
                    : null;

                return {
                    workerId: w.id,
                    name: w.name,
                    position: w.position,
                    photoUrl: w.photoUrl,
                    totalLeads: total,
                    convertedLeads: won,
                    conversionRate: total > 0 ? Math.round((won / total) * 1000) / 10 : 0,
                    totalValueClosed: Number(valueAgg._sum.projectValueEst ?? 0),
                    avgResponseHours: avgRespHours,
                    stuckLeads: stuck,
                };
            }),
        );

        // Urutkan: yang paling produktif (nilai closing) di atas
        rows.sort((a, b) => b.totalValueClosed - a.totalValueClosed);
        return rows;
    }
}
