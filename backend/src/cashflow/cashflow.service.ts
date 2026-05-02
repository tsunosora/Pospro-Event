import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashflowType, Prisma } from '@prisma/client';

@Injectable()
export class CashflowService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.CashflowCreateInput & { bankAccountId?: number | null; eventId?: number | null; rabPlanId?: number | null }) {
        const { bankAccountId, eventId, rabPlanId, ...rest } = data as any;
        return this.prisma.cashflow.create({
            data: {
                ...rest,
                ...(bankAccountId ? { bankAccount: { connect: { id: bankAccountId } } } : {}),
                ...(eventId ? { event: { connect: { id: eventId } } } : {}),
                ...(rabPlanId ? { rabPlan: { connect: { id: rabPlanId } } } : {}),
            },
        });
    }

    /**
     * List + summary cashflow.
     * Optimasi:
     *  - Summary dihitung via Prisma `groupBy` (1 SQL aggregate, tidak fetch row data)
     *    → drastis kurangi payload + memory dibanding fetch ulang semua row buat di-loop
     *  - Pagination opsional via page/limit (default: ALL — backward compat)
     *    Saat limit di-set, response include pagination meta.
     */
    async findAll(
        startDate?: string,
        endDate?: string,
        eventId?: number,
        rabPlanId?: number,
        page?: number,
        limit?: number,
    ) {
        const where: Prisma.CashflowWhereInput = {};
        if (startDate || endDate) {
            where.date = {};
            if (startDate) (where.date as any).gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                (where.date as any).lte = end;
            }
        }
        if (eventId) where.eventId = eventId;
        if (rabPlanId) where.rabPlanId = rabPlanId;

        // Pagination params — kalau di-set keduanya, aktif. Default: tanpa pagination (return semua).
        const usePagination = typeof page === 'number' && typeof limit === 'number' && limit > 0;
        const skip = usePagination ? Math.max(0, (page! - 1) * limit!) : undefined;
        const take = usePagination ? limit : undefined;

        const [list, summaryRows, totalCount] = await Promise.all([
            this.prisma.cashflow.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take,
                include: {
                    user: { select: { email: true, name: true } },
                    bankAccount: { select: { bankName: true, accountNumber: true } },
                    event: { select: { id: true, code: true, name: true } },
                    rabPlan: { select: { id: true, code: true, title: true } },
                },
            }),
            // groupBy by type → 1 row per type, hanya field amount (sum) — jauh lebih ringan
            this.prisma.cashflow.groupBy({
                by: ['type'],
                where,
                _sum: { amount: true },
            }),
            // Total count untuk pagination meta — cuma kalau pagination aktif
            usePagination ? this.prisma.cashflow.count({ where }) : Promise.resolve(0),
        ]);

        let totalIncome = 0;
        let totalExpense = 0;
        for (const row of summaryRows) {
            const sum = row._sum.amount ? parseFloat(row._sum.amount.toString()) : 0;
            if (row.type === CashflowType.INCOME) totalIncome += sum;
            else totalExpense += sum;
        }

        const result: any = {
            list,
            summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense },
        };
        if (usePagination) {
            result.pagination = {
                page: page!,
                limit: limit!,
                totalCount,
                totalPages: Math.ceil(totalCount / limit!),
            };
        }
        return result;
    }

    async getMonthlyTrend() {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const cashflows = await this.prisma.cashflow.findMany({
            where: { date: { gte: sixMonthsAgo } },
            select: { type: true, amount: true, date: true },
        });

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

            const monthEntries = cashflows.filter(cf => cf.date >= monthStart && cf.date <= monthEnd);
            const income = monthEntries.filter(cf => cf.type === CashflowType.INCOME).reduce((s, cf) => s + parseFloat(cf.amount.toString()), 0);
            const expense = monthEntries.filter(cf => cf.type === CashflowType.EXPENSE).reduce((s, cf) => s + parseFloat(cf.amount.toString()), 0);

            return { month: monthNames[d.getMonth()], income, expense };
        });
    }

    async getCategoryBreakdown(startDate?: string, endDate?: string) {
        const where: Prisma.CashflowWhereInput = {};
        if (startDate || endDate) {
            where.date = {};
            if (startDate) (where.date as any).gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                (where.date as any).lte = end;
            }
        }

        const cashflows = await this.prisma.cashflow.findMany({
            where,
            select: { type: true, category: true, amount: true },
        });

        const incomeMap: Record<string, number> = {};
        const expenseMap: Record<string, number> = {};

        for (const cf of cashflows) {
            const amount = parseFloat(cf.amount.toString());
            if (cf.type === CashflowType.INCOME) {
                incomeMap[cf.category] = (incomeMap[cf.category] ?? 0) + amount;
            } else {
                expenseMap[cf.category] = (expenseMap[cf.category] ?? 0) + amount;
            }
        }

        return {
            income: Object.entries(incomeMap).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
            expense: Object.entries(expenseMap).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
        };
    }

    async update(id: number, data: {
        category?: string;
        amount?: number;
        note?: string;
        platformSource?: string | null;
        paymentMethod?: string | null;
        bankAccountId?: number | null;
        eventId?: number | null;
        rabPlanId?: number | null;
    }) {
        const entry = await this.prisma.cashflow.findUnique({ where: { id } });
        if (!entry) throw new NotFoundException('Cashflow entry not found');
        return this.prisma.cashflow.update({ where: { id }, data: data as any });
    }

    /** Leaderboard laba per event — semua event yang punya cashflow entries */
    async getAllEventsProfit(opts: { startDate?: string; endDate?: string } = {}) {
        const where: Prisma.CashflowWhereInput = { eventId: { not: null } };
        if (opts.startDate || opts.endDate) {
            where.date = {};
            if (opts.startDate) (where.date as any).gte = new Date(opts.startDate);
            if (opts.endDate) {
                const end = new Date(opts.endDate);
                end.setHours(23, 59, 59, 999);
                (where.date as any).lte = end;
            }
        }

        const entries = await this.prisma.cashflow.findMany({
            where,
            select: {
                eventId: true,
                type: true,
                amount: true,
                event: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        venue: true,
                        eventStart: true,
                        status: true,
                        customerName: true,
                        customer: { select: { id: true, name: true, companyName: true } },
                    },
                },
            },
        });

        // Aggregate per event
        const byEvent = new Map<number, {
            eventId: number;
            event: NonNullable<typeof entries[0]['event']>;
            totalIncome: number;
            totalExpense: number;
            entryCount: number;
        }>();

        for (const cf of entries) {
            if (!cf.eventId || !cf.event) continue;
            const cur = byEvent.get(cf.eventId) ?? {
                eventId: cf.eventId,
                event: cf.event,
                totalIncome: 0,
                totalExpense: 0,
                entryCount: 0,
            };
            const amount = parseFloat(cf.amount.toString());
            if (cf.type === CashflowType.INCOME) cur.totalIncome += amount;
            else cur.totalExpense += amount;
            cur.entryCount++;
            byEvent.set(cf.eventId, cur);
        }

        const rows = Array.from(byEvent.values()).map((r) => ({
            eventId: r.eventId,
            eventCode: r.event.code,
            eventName: r.event.name,
            venue: r.event.venue,
            eventStart: r.event.eventStart,
            status: r.event.status,
            customerName: r.event.customer?.name ?? r.event.customerName ?? '—',
            customerCompany: r.event.customer?.companyName ?? null,
            totalIncome: r.totalIncome,
            totalExpense: r.totalExpense,
            grossProfit: r.totalIncome - r.totalExpense,
            marginPct: r.totalIncome > 0 ? ((r.totalIncome - r.totalExpense) / r.totalIncome) * 100 : 0,
            entryCount: r.entryCount,
        }));

        // Sort by gross profit desc
        rows.sort((a, b) => b.grossProfit - a.grossProfit);

        // Aggregate totals
        const grandIncome = rows.reduce((s, r) => s + r.totalIncome, 0);
        const grandExpense = rows.reduce((s, r) => s + r.totalExpense, 0);

        return {
            rows,
            summary: {
                eventCount: rows.length,
                totalIncome: grandIncome,
                totalExpense: grandExpense,
                grossProfit: grandIncome - grandExpense,
                marginPct: grandIncome > 0 ? ((grandIncome - grandExpense) / grandIncome) * 100 : 0,
            },
        };
    }

    /** Ringkasan keuangan per event: total income (dp+pelunasan) − total expense */
    async getEventProfit(eventId: number) {
        const entries = await this.prisma.cashflow.findMany({
            where: { eventId },
            select: { type: true, amount: true, category: true, date: true },
        });
        let income = 0, expense = 0;
        const byCategory: Record<string, { income: number; expense: number }> = {};
        for (const cf of entries) {
            const amount = parseFloat(cf.amount.toString());
            if (cf.type === CashflowType.INCOME) income += amount;
            else expense += amount;
            byCategory[cf.category] = byCategory[cf.category] ?? { income: 0, expense: 0 };
            if (cf.type === CashflowType.INCOME) byCategory[cf.category].income += amount;
            else byCategory[cf.category].expense += amount;
        }

        // Monthly trend — last 6 months including current
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
        const now = new Date();
        const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            const monthEntries = entries.filter((cf) => cf.date >= monthStart && cf.date <= monthEnd);
            const inc = monthEntries.filter((cf) => cf.type === CashflowType.INCOME).reduce((s, cf) => s + parseFloat(cf.amount.toString()), 0);
            const exp = monthEntries.filter((cf) => cf.type === CashflowType.EXPENSE).reduce((s, cf) => s + parseFloat(cf.amount.toString()), 0);
            return {
                month: `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
                income: inc,
                expense: exp,
                profit: inc - exp,
            };
        });

        return {
            eventId,
            totalIncome: income,
            totalExpense: expense,
            grossProfit: income - expense,
            marginPct: income > 0 ? ((income - expense) / income) * 100 : 0,
            byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, ...v })),
            entryCount: entries.length,
            monthlyTrend,
        };
    }

    async getPlatformBreakdown(startDate?: string, endDate?: string) {
        const where: Prisma.CashflowWhereInput = { type: CashflowType.INCOME };
        if (startDate || endDate) {
            where.date = {};
            if (startDate) (where.date as any).gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                (where.date as any).lte = end;
            }
        }

        const cashflows = await (this.prisma as any).cashflow.findMany({
            where,
            select: { platformSource: true, amount: true },
        });

        const platformMap: Record<string, number> = {};
        for (const cf of cashflows) {
            const key = cf.platformSource ?? 'POS (Offline)';
            platformMap[key] = (platformMap[key] ?? 0) + parseFloat(cf.amount.toString());
        }

        return Object.entries(platformMap)
            .map(([platform, total]) => ({ platform, total }))
            .sort((a, b) => b.total - a.total);
    }

    async remove(id: number) {
        const entry = await this.prisma.cashflow.findUnique({ where: { id } });
        if (!entry) throw new NotFoundException('Cashflow entry not found');
        return this.prisma.cashflow.delete({ where: { id } });
    }

    async removeBulk(ids: number[]) {
        if (!ids?.length) return { ok: true, deleted: 0 };
        const res = await this.prisma.cashflow.deleteMany({
            where: { id: { in: ids } },
        });
        return { ok: true, deleted: res.count };
    }

    /** Export semua cashflow entry untuk satu event sebagai CSV (UTF-8 with BOM) */
    async exportEventCsv(eventId: number): Promise<{ csv: string; filename: string }> {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: { code: true, name: true },
        });
        if (!event) throw new NotFoundException('Event tidak ditemukan');

        const entries = await this.prisma.cashflow.findMany({
            where: { eventId },
            orderBy: { date: 'asc' },
            include: {
                bankAccount: { select: { bankName: true, accountNumber: true } },
                user: { select: { name: true, email: true } },
                rabPlan: { select: { code: true } },
            },
        });

        const escape = (s: unknown): string => {
            const v = s == null ? '' : String(s);
            if (v.includes(',') || v.includes('"') || v.includes('\n')) {
                return `"${v.replace(/"/g, '""')}"`;
            }
            return v;
        };

        const fmtDate = (d: Date) =>
            d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const fmtMethod = (m: string | null) => {
            if (!m) return '';
            if (m === 'CASH') return 'Tunai';
            if (m === 'QRIS') return 'QRIS';
            if (m === 'BANK_TRANSFER') return 'Transfer';
            return m;
        };

        const headers = [
            'Tanggal',
            'Tipe',
            'Kategori',
            'Nominal',
            'Catatan',
            'Payment Method',
            'Bank',
            'Platform Source',
            'RAB',
            'User',
        ];

        let totalIncome = 0;
        let totalExpense = 0;

        const rows = entries.map((cf) => {
            const amount = parseFloat(cf.amount.toString());
            if (cf.type === CashflowType.INCOME) totalIncome += amount;
            else totalExpense += amount;

            const bank = cf.bankAccount
                ? `${cf.bankAccount.bankName} - ${cf.bankAccount.accountNumber}`
                : '';
            const userLabel = cf.user?.name ?? cf.user?.email ?? '';

            return [
                fmtDate(cf.date),
                cf.type === CashflowType.INCOME ? 'Income' : 'Expense',
                cf.category,
                amount,
                cf.note ?? '',
                fmtMethod(cf.paymentMethod),
                bank,
                cf.platformSource ?? '',
                cf.rabPlan?.code ?? '',
                userLabel,
            ].map(escape).join(',');
        });

        // Footer: summary rows
        const footer = [
            '',
            ['', '', 'TOTAL INCOME', totalIncome, '', '', '', '', '', ''].map(escape).join(','),
            ['', '', 'TOTAL EXPENSE', totalExpense, '', '', '', '', '', ''].map(escape).join(','),
            ['', '', 'GROSS PROFIT', totalIncome - totalExpense, '', '', '', '', '', ''].map(escape).join(','),
            ['', '', 'MARGIN %', totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(2) : '0', '', '', '', '', '', ''].map(escape).join(','),
        ];

        // BOM untuk Excel auto-detect UTF-8
        const csv = '﻿' + [headers.join(','), ...rows, ...footer].join('\n');

        const safeCode = (event.code || `event-${eventId}`).replace(/[^A-Za-z0-9_-]/g, '-');
        return {
            csv,
            filename: `Cashflow-${safeCode}.csv`,
        };
    }
}
