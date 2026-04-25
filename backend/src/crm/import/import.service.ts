import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, LeadLevel, LeadSource, LeadStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone } from '../utils/phone.util';

export interface ImportRow {
    name: string | null;
    phone: string;
    phoneNormalized: string;
    organization: string | null;
    productCategory: string | null;
    level: LeadLevel | null;
    source: LeadSource;
    assignedStaffName: string | null;
    followUpDate: Date | null;
    status: LeadStatus;
    orderDescription: string | null;
    projectValueEst: string | null;
    notes: string | null;
    leadCameAt: Date;
    lastContactedAt: Date | null;
}

export interface ImportSummary {
    parsed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: { row: number; message: string }[];
}

const HEADERS = [
    'name', 'productCategory', 'organization', 'phone', 'level', 'source',
    'assignedStaff', 'followUpDate', 'status', 'orderDescription',
    'projectValueEst', 'notes', 'createdAt', 'lastUpdated', 'lastContacted',
];

const HEADER_ALIASES: Record<string, string> = {
    'name': 'name',
    'product category': 'productCategory',
    'organization': 'organization',
    'phone': 'phone',
    'lead level': 'level',
    'lead source': 'source',
    'assigned staff': 'assignedStaff',
    'follow-up date': 'followUpDate',
    'status': 'status',
    'order description': 'orderDescription',
    'project value est.': 'projectValueEst',
    'project value est': 'projectValueEst',
    'notes': 'notes',
    'created at': 'createdAt',
    'last updated': 'lastUpdated',
    'last contacted': 'lastContacted',
};

function mapLevel(s: string | null | undefined): LeadLevel | null {
    if (!s) return null;
    const k = s.trim().toLowerCase();
    if (k === 'hot') return 'HOT';
    if (k === 'warm') return 'WARM';
    if (k === 'cold') return 'COLD';
    if (k === 'unqualified') return 'UNQUALIFIED';
    return null;
}

function mapSource(s: string | null | undefined): LeadSource {
    if (!s) return 'OTHER';
    const k = s.trim().toLowerCase();
    if (k === 'meta ads' || k === 'meta' || k === 'facebook' || k === 'instagram') return 'META_ADS';
    if (k === 'whatsapp' || k === 'wa') return 'WHATSAPP';
    if (k === 'website' || k === 'web') return 'WEBSITE';
    if (k === 'referral' || k === 'referensi') return 'REFERRAL';
    if (k === 'walk in' || k === 'walk-in' || k === 'datang langsung') return 'WALK_IN';
    return 'OTHER';
}

function mapStatus(s: string | null | undefined): LeadStatus {
    if (!s) return 'NEW';
    const k = s.trim().toLowerCase();
    if (k === 'closed deal' || k === 'done' || k === 'won') return 'CLOSED_DEAL';
    if (k === 'in progress') return 'IN_PROGRESS';
    if (k === 'new') return 'NEW';
    if (k === 'contacted') return 'CONTACTED';
    if (k === 'responded') return 'RESPONDED';
    if (k === 'no response' || k === 'no respon') return 'NO_RESPONSE';
    if (k === 'waiting') return 'WAITING';
    if (k === 'close cancel' || k === 'lost' || k === 'cancel') return 'CLOSED_LOST';
    return 'NEW';
}

function statusToStageName(status: LeadStatus): string {
    switch (status) {
        case 'NEW':
        case 'CONTACTED':
            return 'Lead Masuk';
        case 'RESPONDED':
        case 'WAITING':
            return 'Follow Up';
        case 'IN_PROGRESS':
            return 'Penawaran';
        case 'CLOSED_DEAL':
            return 'Closed Deal';
        case 'NO_RESPONSE':
        case 'CLOSED_LOST':
            return 'Lost';
        default:
            return 'Lead Masuk';
    }
}

function parseDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function parseRupiah(v: any): string | null {
    if (v === null || v === undefined || v === '') return null;
    const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) && n > 0 ? n.toFixed(2) : null;
}

@Injectable()
export class ImportService {
    constructor(private prisma: PrismaService) { }

    async parseBuffer(buf: Buffer): Promise<ImportRow[]> {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf as any);
        const ws = wb.worksheets[0];
        if (!ws) throw new BadRequestException('Sheet kosong');

        // Read header row
        const headerRow = ws.getRow(1);
        const colMap: Record<number, string> = {};
        headerRow.eachCell((cell, colNumber) => {
            const raw = String(cell.value || '').trim().toLowerCase();
            const key = HEADER_ALIASES[raw];
            if (key) colMap[colNumber] = key;
        });

        if (!Object.values(colMap).includes('phone')) {
            throw new BadRequestException('Kolom Phone tidak ditemukan di header');
        }

        const rows: ImportRow[] = [];
        for (let r = 2; r <= ws.rowCount; r++) {
            const row = ws.getRow(r);
            const get = (key: string) => {
                const col = Object.entries(colMap).find(([, v]) => v === key)?.[0];
                if (!col) return null;
                const cell = row.getCell(Number(col));
                const v = cell.value;
                if (v === null || v === undefined) return null;
                if (typeof v === 'object' && 'text' in (v as any)) return String((v as any).text);
                return v;
            };

            const phoneRaw = get('phone');
            if (!phoneRaw) continue;
            const phoneStr = String(phoneRaw).trim();
            const phoneNorm = normalizePhone(phoneStr);
            if (!phoneNorm) continue;

            const status = mapStatus(get('status') as any);
            const leadCameAt = parseDate(get('createdAt')) || new Date();

            rows.push({
                name: (get('name') as string)?.toString().trim() || null,
                phone: phoneStr,
                phoneNormalized: phoneNorm,
                organization: (get('organization') as string)?.toString().trim() || null,
                productCategory: (get('productCategory') as string)?.toString().trim() || null,
                level: mapLevel(get('level') as any),
                source: mapSource(get('source') as any),
                assignedStaffName: (get('assignedStaff') as string)?.toString().trim() || null,
                followUpDate: parseDate(get('followUpDate')),
                status,
                orderDescription: (get('orderDescription') as string)?.toString().trim() || null,
                projectValueEst: parseRupiah(get('projectValueEst')),
                notes: (get('notes') as string)?.toString().trim() || null,
                leadCameAt,
                lastContactedAt: parseDate(get('lastContacted')),
            });
        }
        return rows;
    }

    async commit(rows: ImportRow[]): Promise<ImportSummary> {
        const summary: ImportSummary = { parsed: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

        // Pre-load stages
        const stages = await this.prisma.leadStage.findMany();
        const stageByName = new Map(stages.map((s) => [s.name, s]));

        // Pre-load workers (case-insensitive lookup)
        const workers = await this.prisma.worker.findMany({ select: { id: true, name: true } });
        const workerMap = new Map(workers.map((w) => [w.name.toLowerCase(), w.id]));

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            try {
                const stage = stageByName.get(statusToStageName(r.status));
                if (!stage) {
                    summary.errors.push({ row: i + 2, message: `Stage "${statusToStageName(r.status)}" tidak ada` });
                    summary.skipped++;
                    continue;
                }

                let assignedWorkerId: number | null = null;
                if (r.assignedStaffName) {
                    const key = r.assignedStaffName.toLowerCase();
                    if (workerMap.has(key)) {
                        assignedWorkerId = workerMap.get(key)!;
                    } else {
                        const w = await this.prisma.worker.create({
                            data: { name: r.assignedStaffName, isActive: true },
                        });
                        workerMap.set(key, w.id);
                        assignedWorkerId = w.id;
                    }
                }

                const existing = await this.prisma.lead.findFirst({
                    where: { phoneNormalized: r.phoneNormalized },
                });

                if (existing) {
                    if (existing.status === 'CLOSED_DEAL') {
                        summary.skipped++;
                        continue;
                    }
                    await this.prisma.lead.update({
                        where: { id: existing.id },
                        data: {
                            name: r.name ?? existing.name,
                            organization: r.organization ?? existing.organization,
                            productCategory: r.productCategory ?? existing.productCategory,
                            level: r.level ?? existing.level,
                            source: r.source,
                            assignedWorkerId: assignedWorkerId ?? existing.assignedWorkerId,
                            followUpDate: r.followUpDate ?? existing.followUpDate,
                            status: r.status,
                            stageId: stage.id,
                            orderDescription: r.orderDescription ?? existing.orderDescription,
                            projectValueEst: r.projectValueEst
                                ? new Prisma.Decimal(r.projectValueEst)
                                : existing.projectValueEst,
                            notes: r.notes ?? existing.notes,
                            lastContactedAt: r.lastContactedAt ?? existing.lastContactedAt,
                        },
                    });
                    summary.updated++;
                } else {
                    const max = await this.prisma.lead.aggregate({
                        where: { stageId: stage.id },
                        _max: { stageOrderIndex: true },
                    });
                    await this.prisma.lead.create({
                        data: {
                            name: r.name,
                            phone: r.phone,
                            phoneNormalized: r.phoneNormalized,
                            organization: r.organization,
                            productCategory: r.productCategory,
                            level: r.level,
                            source: r.source,
                            sourceDetail: null,
                            status: r.status,
                            stageId: stage.id,
                            stageOrderIndex: (max._max.stageOrderIndex ?? -1) + 1,
                            assignedWorkerId,
                            followUpDate: r.followUpDate,
                            orderDescription: r.orderDescription,
                            projectValueEst: r.projectValueEst ? new Prisma.Decimal(r.projectValueEst) : null,
                            notes: r.notes,
                            leadCameAt: r.leadCameAt,
                            lastContactedAt: r.lastContactedAt,
                        },
                    });
                    summary.created++;
                }
            } catch (err: any) {
                summary.errors.push({ row: i + 2, message: err?.message || String(err) });
                summary.skipped++;
            }
        }

        return summary;
    }
}
