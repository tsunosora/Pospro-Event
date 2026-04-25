import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import type { CheckoutInput, ReturnInput } from '../withdrawals/withdrawals.service';
import { WarehousePinGuard } from '../warehouse-pin/warehouse-pin.guard';

const photoStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname) || '.jpg';
        cb(null, `withdrawal-${uniqueSuffix}${ext}`);
    },
});

const photoFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/)) {
        return cb(new BadRequestException('Hanya file gambar yang diijinkan'), false);
    }
    cb(null, true);
};

@Controller('public/gudang')
@UseGuards(WarehousePinGuard)
export class PublicGudangController {
    constructor(
        private prisma: PrismaService,
        private withdrawals: WithdrawalsService,
    ) { }

    @Get('bootstrap')
    async bootstrap() {
        const [workers, warehouses, products, events] = await Promise.all([
            this.prisma.worker.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, position: true, photoUrl: true },
            }),
            this.prisma.warehouse.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, address: true },
            }),
            this.prisma.product.findMany({
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                    unit: { select: { name: true } },
                    category: { select: { id: true, name: true } },
                    variants: {
                        select: {
                            id: true,
                            sku: true,
                            variantName: true,
                            stock: true,
                            variantImageUrl: true,
                        },
                    },
                },
            }),
            this.prisma.event.findMany({
                where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
                orderBy: [{ eventStart: 'asc' }, { createdAt: 'desc' }],
                select: {
                    id: true, code: true, name: true, brand: true, venue: true,
                    eventStart: true, eventEnd: true, status: true,
                },
            }),
        ]);
        return { workers, warehouses, products, events };
    }

    @Get('active-borrows')
    activeBorrows(@Query('workerId') workerIdStr?: string) {
        const workerId = workerIdStr ? Number(workerIdStr) : undefined;
        return this.prisma.withdrawal.findMany({
            where: {
                type: 'BORROW',
                status: { in: ['CHECKED_OUT', 'PARTIAL_RETURNED', 'OVERDUE'] },
                ...(workerId ? { workerId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            include: {
                worker: { select: { id: true, name: true, photoUrl: true, position: true } },
                warehouse: { select: { id: true, name: true } },
                items: {
                    include: {
                        productVariant: {
                            select: {
                                id: true, sku: true, variantName: true, variantImageUrl: true,
                                product: { select: { id: true, name: true, imageUrl: true } },
                            },
                        },
                    },
                },
            },
        });
    }

    @Post('return/:id')
    @UseInterceptors(FileInterceptor('photo', {
        storage: photoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 8 * 1024 * 1024 },
    }))
    async returnItems(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        let items: any[] = [];
        if (typeof body.items === 'string') {
            try { items = JSON.parse(body.items); }
            catch { throw new BadRequestException('items tidak valid (harus JSON array)'); }
        } else if (Array.isArray(body.items)) {
            items = body.items;
        }

        const input: ReturnInput = {
            items,
            notes: body.notes,
            returnPhotoUrl: file ? `/uploads/${file.filename}` : undefined,
        };
        return this.withdrawals.returnItems(id, input);
    }

    @Post('checkout')
    @UseInterceptors(FileInterceptor('photo', {
        storage: photoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 8 * 1024 * 1024 },
    }))
    async checkout(
        @Body() body: any,
        @UploadedFile() file: Express.Multer.File | undefined,
    ) {
        let items: any[] = [];
        if (typeof body.items === 'string') {
            try {
                items = JSON.parse(body.items);
            } catch {
                throw new BadRequestException('items tidak valid (harus JSON array)');
            }
        } else if (Array.isArray(body.items)) {
            items = body.items;
        }

        const input: CheckoutInput = {
            workerId: Number(body.workerId),
            warehouseId: Number(body.warehouseId),
            eventId: body.eventId ? Number(body.eventId) : null,
            type: body.type,
            purpose: body.purpose,
            scheduledReturnAt: body.scheduledReturnAt || null,
            notes: body.notes,
            items,
            checkoutPhotoUrl: file ? `/uploads/${file.filename}` : undefined,
        };

        return this.withdrawals.checkout(input);
    }
}
