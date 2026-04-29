import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Request,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RabService } from './rab.service';
import { XlsxExportService } from '../exporters/xlsx-export.service';
import { compressImage } from '../common/utils/compress-image.util';
import type { CreateRabDto, UpdateRabDto } from './dto/create-rab.dto';

const imageStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `rab-product-${uniqueSuffix}${ext}`);
    },
});

const imageFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
    }
    cb(null, true);
};

function safeFilename(s: string): string {
    return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

@UseGuards(JwtAuthGuard)
@Controller('rab')
export class RabController {
    constructor(
        private readonly service: RabService,
        private readonly xlsxExport: XlsxExportService,
    ) { }

    @Post()
    create(@Body() dto: CreateRabDto) {
        return this.service.create(dto);
    }

    @Get('tags')
    listTags() {
        return this.service.getAllTags();
    }

    /** Hapus tag dari semua RAB (cleanup typo / tag tidak terpakai) */
    @Delete('tags/:tag')
    deleteTag(@Param('tag') tag: string) {
        return this.service.deleteTagGlobally(decodeURIComponent(tag));
    }

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Get(':id/summary')
    summary(@Param('id', ParseIntPipe) id: number) {
        return this.service.summary(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRabDto) {
        return this.service.update(id, dto);
    }

    /**
     * Toggle status "Laporan Lengkap" — admin tandai RAB yang laporannya sudah selesai/lengkap.
     * Body: { complete: boolean } — true untuk tandai lengkap, false untuk batalkan.
     */
    @Patch(':id/report-status')
    markReportStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { complete: boolean },
        @Request() req: any,
    ) {
        const userId = req?.user?.sub ?? req?.user?.id ?? null;
        return this.service.markReportStatus(id, !!body?.complete, userId);
    }

    @Post(':id/duplicate')
    duplicate(
        @Param('id', ParseIntPipe) id: number,
        @Body() overrides: { title?: string; location?: string; periodStart?: string; periodEnd?: string } = {},
    ) {
        return this.service.duplicate(id, overrides);
    }

    @Post(':id/generate-quotation')
    generateQuotation(
        @Param('id', ParseIntPipe) id: number,
        @Body()
        body: {
            quotationVariant: 'SEWA' | 'PENGADAAN_BOOTH';
            clientName?: string;
            clientCompany?: string;
            clientAddress?: string;
            clientPhone?: string;
            clientEmail?: string;
            dpPercent?: number;
        },
    ) {
        return this.service.generateQuotation(id, body);
    }

    @Get(':id/export/xlsx')
    async exportXlsx(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
        const rab = await this.service.findOne(id);
        const buf = await this.xlsxExport.renderRabXlsx(id);
        const fileName = safeFilename(`${rab.code}_${rab.title}.xlsx`);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buf.length.toString());
        res.end(buf);
    }

    @Post(':id/upload-image')
    @UseInterceptors(FileInterceptor('image', {
        storage: imageStorage,
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadImage(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('File gambar wajib diupload');
        }
        await compressImage(file.path);
        const imageUrl = `/uploads/${file.filename}`;
        return this.service.setImage(id, imageUrl);
    }

    @Delete(':id/image')
    async removeImage(@Param('id', ParseIntPipe) id: number) {
        return this.service.setImage(id, null);
    }

    @Post(':id/save-as-product')
    @UseInterceptors(FileInterceptor('image', {
        storage: imageStorage,
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async saveAsProduct(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        let imageUrl: string | undefined;
        if (file) {
            await compressImage(file.path);
            imageUrl = `/uploads/${file.filename}`;
        }
        const parsed = {
            name: body.name,
            categoryId: Number(body.categoryId),
            unitId: Number(body.unitId),
            boothProductType: body.boothProductType,
            defaultRentalUnit: body.defaultRentalUnit,
            sku: body.sku,
            description: body.description,
            priceOverride: body.priceOverride !== undefined && body.priceOverride !== ''
                ? Number(body.priceOverride) : undefined,
            hppOverride: body.hppOverride !== undefined && body.hppOverride !== ''
                ? Number(body.hppOverride) : undefined,
            imageUrl,
        };
        return this.service.saveAsProduct(id, parsed);
    }

    /** Backfill cashflow untuk SEMUA RAB existing (one-time migration helper) */
    @Post('sync-all-cashflow')
    async syncAllCashflow(@Request() req: any) {
        return this.service.syncAllCashflow(req.user?.userId ?? null);
    }

    @Post(':id/generate-cashflow')
    async generateCashflow(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { mode?: 'detail' | 'category'; eventId?: number | null; skipExisting?: boolean },
        @Request() req: any,
    ) {
        return this.service.generateCashflowFromRab(id, {
            mode: body.mode,
            eventId: body.eventId,
            skipExisting: body.skipExisting,
            userId: req.user?.userId,
        });
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
