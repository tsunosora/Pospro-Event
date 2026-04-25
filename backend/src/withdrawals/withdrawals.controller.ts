import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WithdrawalsService } from './withdrawals.service';
import type { CheckoutInput, ReturnInput } from './withdrawals.service';

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

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
    constructor(private svc: WithdrawalsService) { }

    @Get()
    list(
        @Query('status') status?: string,
        @Query('type') type?: string,
        @Query('workerId') workerId?: string,
        @Query('warehouseId') warehouseId?: string,
        @Query('eventId') eventId?: string,
        @Query('overdue') overdue?: string,
    ) {
        return this.svc.findAll({
            status,
            type,
            workerId: workerId ? Number(workerId) : undefined,
            warehouseId: warehouseId ? Number(warehouseId) : undefined,
            eventId: eventId ? Number(eventId) : undefined,
            overdue: overdue === 'true' || overdue === '1',
        });
    }

    @Get('overdue/count')
    overdueCount() {
        return this.svc.getOverdueCount().then((count) => ({ count }));
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Post()
    @UseInterceptors(FileInterceptor('photo', {
        storage: photoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 8 * 1024 * 1024 },
    }))
    async checkout(
        @Body() body: any,
        @UploadedFile() file: Express.Multer.File | undefined,
        @Req() req: any,
    ) {
        // FormData serializes items as JSON string
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

        return this.svc.checkout(input, req.user?.userId || req.user?.id);
    }

    @Post(':id/return')
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
            try {
                items = JSON.parse(body.items);
            } catch {
                throw new BadRequestException('items tidak valid (harus JSON array)');
            }
        } else if (Array.isArray(body.items)) {
            items = body.items;
        }

        const input: ReturnInput = {
            items,
            notes: body.notes,
            returnPhotoUrl: file ? `/uploads/${file.filename}` : undefined,
        };
        return this.svc.returnItems(id, input);
    }

    @Delete(':id')
    cancel(@Param('id', ParseIntPipe) id: number) {
        return this.svc.cancel(id);
    }
}
