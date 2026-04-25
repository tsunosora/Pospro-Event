import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, LeadLevel, LeadSource, LeadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone } from '../utils/phone.util';

export interface CreateLeadInput {
    name?: string;
    phone: string;
    organization?: string;
    productCategory?: string;
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
    eventDate?: string | null;
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
        if (params.search) {
            const s = params.search.trim();
            where.OR = [
                { name: { contains: s } },
                { organization: { contains: s } },
                { phone: { contains: s } },
                { phoneNormalized: { contains: normalizePhone(s) } },
                { orderDescription: { contains: s } },
                { notes: { contains: s } },
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
                eventDate: this.toDate(input.eventDate) ?? null,
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
        if (input.level !== undefined) data.level = input.level;
        if (input.source !== undefined) data.source = input.source;
        if (input.sourceDetail !== undefined) data.sourceDetail = input.sourceDetail?.trim() || null;
        if (input.greetingTemplate !== undefined) data.greetingTemplate = input.greetingTemplate?.trim() || null;
        if (input.status !== undefined) data.status = input.status;
        if (input.assignedWorkerId !== undefined) {
            data.assignedWorker = input.assignedWorkerId
                ? { connect: { id: input.assignedWorkerId } }
                : { disconnect: true };
        }
        if (input.followUpDate !== undefined) data.followUpDate = this.toDate(input.followUpDate);
        if (input.orderDescription !== undefined) data.orderDescription = input.orderDescription?.trim() || null;
        if (input.projectValueEst !== undefined) data.projectValueEst = this.decOrNull(input.projectValueEst);
        if (input.eventDate !== undefined) data.eventDate = this.toDate(input.eventDate);
        if (input.eventLocation !== undefined) data.eventLocation = input.eventLocation?.trim() || null;
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        if (input.lastContactedAt !== undefined) data.lastContactedAt = this.toDate(input.lastContactedAt);

        const updated = await this.prisma.lead.update({ where: { id }, data, include: LEAD_INCLUDE });

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
}
