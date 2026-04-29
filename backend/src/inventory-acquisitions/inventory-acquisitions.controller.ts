import {
    BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query,
    UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { compressImage } from '../common/utils/compress-image.util';
import { InventoryAcquisitionsService, type StoreAcquisitionInput } from './inventory-acquisitions.service';

const photoStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `inventory-${uniqueSuffix}${extname(file.originalname)}`);
    },
});

const imageFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/)) {
        return cb(new BadRequestException('Hanya gambar yang diijinkan'), false);
    }
    cb(null, true);
};

@Controller('inventory-acquisitions')
@UseGuards(JwtAuthGuard)
export class InventoryAcquisitionsController {
    constructor(private svc: InventoryAcquisitionsService) { }

    @Get()
    list(
        @Query('rabPlanId') rabPlanId?: string,
        @Query('status') status?: string,
    ) {
        return this.svc.list({
            rabPlanId: rabPlanId ? parseInt(rabPlanId, 10) : undefined,
            status: status || undefined,
        });
    }

    @Get(':id')
    getOne(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Post(':id/store')
    store(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: StoreAcquisitionInput,
    ) {
        return this.svc.store(id, body);
    }

    @Post(':id/cancel')
    cancel(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { reason?: string } = {},
    ) {
        return this.svc.cancel(id, body.reason);
    }

    @Post(':id/upload-photo')
    @UseInterceptors(FileInterceptor('image', {
        storage: photoStorage,
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadPhoto(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('File foto wajib');
        await compressImage(file.path);
        return this.svc.setPhoto(id, `/uploads/${file.filename}`);
    }

    @Delete(':id/photo')
    removePhoto(@Param('id', ParseIntPipe) id: number) {
        return this.svc.setPhoto(id, null);
    }
}
