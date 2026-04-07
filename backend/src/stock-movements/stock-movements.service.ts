import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType } from '@prisma/client';

@Injectable()
export class StockMovementsService {
    constructor(private prisma: PrismaService) { }

    async create(data: { productVariantId: number; type: MovementType; quantity: number; reason?: string }) {
        return this.prisma.$transaction(async (tx) => {
            const variant = await tx.productVariant.findUnique({ where: { id: data.productVariantId } });
            if (!variant) throw new NotFoundException('Product variant not found');

            let newStock = variant.stock;

            if (data.type === 'IN') {
                newStock += data.quantity;
            } else if (data.type === 'OUT') {
                if (variant.stock < data.quantity) {
                    throw new BadRequestException('Insufficient stock for OUT movement');
                }
                newStock -= data.quantity;
            } else if (data.type === 'ADJUST') {
                // Assume quantity is the absolute new stock value for ADJUST
                newStock = data.quantity;
            }

            // Update variant stock
            await tx.productVariant.update({
                where: { id: data.productVariantId },
                data: { stock: newStock }
            });

            // Log movement
            return tx.stockMovement.create({
                data: { ...data, balanceAfter: newStock } as any
            });
        });
    }

    async findAll(params?: { startDate?: string; endDate?: string; type?: MovementType; search?: string }) {
        const where: any = {};

        if (params?.startDate || params?.endDate) {
            where.createdAt = {};
            if (params.startDate) where.createdAt.gte = new Date(params.startDate + 'T00:00:00');
            if (params.endDate)   where.createdAt.lte = new Date(params.endDate   + 'T23:59:59');
        }

        if (params?.type) where.type = params.type;

        if (params?.search) {
            where.productVariant = {
                OR: [
                    { sku: { contains: params.search } },
                    { variantName: { contains: params.search } },
                    { product: { name: { contains: params.search } } },
                ],
            };
        }

        const movements = await this.prisma.stockMovement.findMany({
            where,
            include: { productVariant: { include: { product: true } } },
            orderBy: { createdAt: 'desc' },
            take: 1000,
        });

        const summary = {
            totalIn:     movements.filter(m => m.type === 'IN').reduce((s, m) => s + Number(m.quantity), 0),
            totalOut:    movements.filter(m => m.type === 'OUT').reduce((s, m) => s + Number(m.quantity), 0),
            totalAdjust: movements.filter(m => m.type === 'ADJUST').length,
            count:       movements.length,
        };

        return { movements, summary };
    }

    async findOne(id: number) {
        const movement = await this.prisma.stockMovement.findUnique({
            where: { id },
            include: { productVariant: { include: { product: true } } }
        });
        if (!movement) throw new NotFoundException('Stock movement not found');
        return movement;
    }

    async findWasteByVariantSince(variantId: number, since: Date) {
        return this.prisma.stockMovement.findMany({
            where: {
                productVariantId: variantId,
                type: 'OUT',
                reason: { startsWith: 'Susut:' },
                date: { gte: since },
            },
            orderBy: { date: 'desc' },
            select: { id: true, quantity: true, reason: true, date: true },
        });
    }
}
