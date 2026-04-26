import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: { name: string; phone?: string; email?: string; address?: string; companyName?: string; companyPIC?: string }) {
        return this.prisma.customer.create({ data });
    }

    async findAll() {
        return this.prisma.customer.findMany({ orderBy: { name: 'asc' } });
    }

    async findOne(id: number) {
        const c = await this.prisma.customer.findUnique({ where: { id } });
        if (!c) throw new NotFoundException('Customer not found');
        return c;
    }

    async findAllWithStats() {
        const customers = await this.prisma.customer.findMany({ orderBy: { name: 'asc' } });

        const phones = customers.filter(c => c.phone).map(c => c.phone!);
        const noPhoneNames = customers.filter(c => !c.phone).map(c => c.name);

        const orClause: any[] = [];
        if (phones.length > 0) orClause.push({ customerPhone: { in: phones } });
        if (noPhoneNames.length > 0) orClause.push({ customerName: { in: noPhoneNames }, customerPhone: null });

        const transactions = orClause.length > 0
            ? await this.prisma.transaction.findMany({
                where: { status: { in: ['PAID', 'PARTIAL'] }, OR: orClause },
                select: { customerPhone: true, customerName: true, downPayment: true, createdAt: true },
            })
            : [];

        return customers.map(c => {
            const matching = transactions.filter(t =>
                (c.phone && t.customerPhone === c.phone) ||
                (!c.phone && t.customerName === c.name)
            );
            const sorted = matching.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
            return {
                ...c,
                totalOrders: matching.length,
                totalRevenue: matching.reduce((sum, t) => sum + Number(t.downPayment), 0),
                lastOrderDate: sorted[0]?.createdAt ?? null,
            };
        });
    }

    async getAnalytics(id: number) {
        const customer = await this.prisma.customer.findUnique({ where: { id } });
        if (!customer) throw new NotFoundException('Customer not found');

        const where: any = { status: { in: ['PAID', 'PARTIAL'] } };
        if (customer.phone) where.customerPhone = customer.phone;
        else where.customerName = customer.name;

        const transactions = await this.prisma.transaction.findMany({
            where,
            include: {
                items: { include: { productVariant: { include: { product: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.downPayment), 0);
        const totalOrders = transactions.length;
        const lastOrderDate = transactions[0]?.createdAt ?? null;

        // Top products by order frequency
        const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
        for (const t of transactions) {
            for (const item of t.items) {
                const name = item.productVariant.product.name;
                if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
                productMap[name].qty += item.quantity;
                productMap[name].revenue += Number(item.priceAtTime);
            }
        }
        const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 8);

        // Monthly spend last 6 months
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
        const now = new Date();
        const monthlySpend = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            const total = transactions
                .filter(t => t.createdAt && t.createdAt >= monthStart && t.createdAt <= monthEnd)
                .reduce((sum, t) => sum + Number(t.downPayment), 0);
            return { month: monthNames[d.getMonth()], total };
        });

        const recentTransactions = transactions.slice(0, 10).map(t => ({
            id: t.id,
            invoiceNumber: t.invoiceNumber,
            grandTotal: Number(t.grandTotal),
            downPayment: Number(t.downPayment),
            status: t.status,
            paymentMethod: t.paymentMethod,
            createdAt: t.createdAt,
            itemCount: t.items.length,
            items: t.items.map(i => i.productVariant.product.name),
        }));

        // ── EVENT/PROJECT ANALYTICS (vendor booth-aware) ──
        // Invoice (Penawaran ACCEPTED + Invoice PAID)
        const invoices = await this.prisma.invoice.findMany({
            where: {
                customerId: id,
                OR: [
                    { type: 'INVOICE', status: 'PAID' },
                    { type: 'QUOTATION', status: { in: ['ACCEPTED', 'SENT'] } },
                ],
            },
            select: {
                id: true,
                invoiceNumber: true,
                type: true,
                status: true,
                quotationVariant: true,
                projectName: true,
                eventDateStart: true,
                total: true,
                date: true,
            },
            orderBy: { date: 'desc' },
        });

        const acceptedQuotations = invoices.filter(i => i.type === 'QUOTATION' && i.status === 'ACCEPTED');
        const paidInvoices = invoices.filter(i => i.type === 'INVOICE' && i.status === 'PAID');

        const totalQuotationValue = acceptedQuotations.reduce((s, i) => s + Number(i.total), 0);
        const totalInvoicePaid = paidInvoices.reduce((s, i) => s + Number(i.total), 0);

        // RAB Plans
        const rabPlans = await this.prisma.rabPlan.findMany({
            where: { customerId: id },
            select: {
                id: true,
                code: true,
                title: true,
                projectName: true,
                periodStart: true,
                items: { select: { quantity: true, priceRab: true, quantityCost: true, priceCost: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        let totalRabValue = 0;
        let totalRabCost = 0;
        for (const r of rabPlans) {
            for (const it of r.items) {
                totalRabValue += Number(it.priceRab) * Number(it.quantity);
                totalRabCost += Number(it.priceCost) * Number(it.quantityCost);
            }
        }

        // Events terkait
        const events = await this.prisma.event.findMany({
            where: { customerId: id },
            select: {
                id: true,
                code: true,
                name: true,
                status: true,
                eventStart: true,
                venue: true,
            },
            orderBy: { eventStart: 'desc' },
        });
        const eventIds = events.map(e => e.id);

        // Cashflow ter-tag ke event milik customer ini
        let totalEventIncome = 0;
        let totalEventExpense = 0;
        if (eventIds.length > 0) {
            const cashflows = await this.prisma.cashflow.findMany({
                where: { eventId: { in: eventIds } },
                select: { type: true, amount: true },
            });
            for (const cf of cashflows) {
                const amount = Number(cf.amount);
                if (cf.type === 'INCOME') totalEventIncome += amount;
                else totalEventExpense += amount;
            }
        }
        const eventGrossProfit = totalEventIncome - totalEventExpense;
        const eventMarginPct = totalEventIncome > 0 ? (eventGrossProfit / totalEventIncome) * 100 : 0;

        const eventAnalytics = {
            invoiceCount: paidInvoices.length,
            quotationCount: acceptedQuotations.length,
            totalQuotationValue,
            totalInvoicePaid,
            rabCount: rabPlans.length,
            totalRabValue,
            totalRabCost,
            rabMarginPct: totalRabValue > 0 ? ((totalRabValue - totalRabCost) / totalRabValue) * 100 : 0,
            eventCount: events.length,
            totalEventIncome,
            totalEventExpense,
            eventGrossProfit,
            eventMarginPct,
            recentInvoices: invoices.slice(0, 10),
            recentEvents: events.slice(0, 10),
            recentRabPlans: rabPlans.slice(0, 10).map(r => ({
                id: r.id,
                code: r.code,
                title: r.title,
                projectName: r.projectName,
                periodStart: r.periodStart,
                itemCount: r.items.length,
            })),
        };

        return {
            customer,
            // POS metrics (lini Printing 5%)
            totalRevenue,
            totalOrders,
            lastOrderDate,
            topProducts,
            monthlySpend,
            recentTransactions,
            // Event metrics (lini Booth 95%) — NEW
            eventAnalytics,
        };
    }

    async findAllForExport() {
        const customers = await this.prisma.customer.findMany({ orderBy: { name: 'asc' } });

        const phones = customers.filter(c => c.phone).map(c => c.phone!);
        const noPhoneNames = customers.filter(c => !c.phone).map(c => c.name);

        const orClause: any[] = [];
        if (phones.length > 0) orClause.push({ customerPhone: { in: phones } });
        if (noPhoneNames.length > 0) orClause.push({ customerName: { in: noPhoneNames }, customerPhone: null });

        const transactions = orClause.length > 0
            ? await this.prisma.transaction.findMany({
                where: { status: { in: ['PAID', 'PARTIAL'] }, OR: orClause },
                include: { items: { include: { productVariant: { include: { product: true } } } } },
                orderBy: { createdAt: 'desc' },
            })
            : [];

        return customers.map(c => {
            const matching = transactions.filter(t =>
                (c.phone && t.customerPhone === c.phone) ||
                (!c.phone && t.customerName === c.name)
            );

            const totalRevenue = matching.reduce((sum, t) => sum + Number(t.downPayment), 0);
            const totalOrders = matching.length;
            const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
            const lastOrderDate = matching[0]?.createdAt ?? null;

            // Top products
            const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
            for (const t of matching) {
                for (const item of t.items) {
                    const name = item.productVariant.product.name;
                    if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
                    productMap[name].qty += item.quantity;
                    productMap[name].revenue += Number(item.priceAtTime);
                }
            }
            const topProducts = Object.values(productMap)
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5);

            // Payment method preference
            const methodCount: Record<string, number> = {};
            for (const t of matching) {
                methodCount[t.paymentMethod] = (methodCount[t.paymentMethod] ?? 0) + 1;
            }
            const preferredPayment = Object.entries(methodCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

            return {
                ...c,
                totalOrders,
                totalRevenue,
                avgOrder,
                lastOrderDate,
                topProducts,
                preferredPayment,
            };
        });
    }

    async update(id: number, data: { name?: string; phone?: string | null; email?: string | null; address?: string | null; companyName?: string | null; companyPIC?: string | null }) {
        return this.prisma.customer.update({ where: { id }, data });
    }

    async remove(id: number) {
        return this.prisma.customer.delete({ where: { id } });
    }
}
