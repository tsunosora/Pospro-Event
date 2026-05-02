import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LeadsService } from './leads.service';
import { compressImage } from '../../common/utils/compress-image.util';

const leadImageStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `lead-${uniqueSuffix}${ext}`);
    },
});

const leadImageFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
    }
    cb(null, true);
};
import type {
    ActivityInput,
    ConvertInput,
    CreateLeadInput,
    ReorderInput,
    UpdateLeadInput,
} from './leads.service';
import type { LeadLevel, EventBrand } from '@prisma/client';

@Controller('crm')
@UseGuards(JwtAuthGuard)
export class LeadsController {
    constructor(private svc: LeadsService) { }

    @Get('board')
    board() { return this.svc.board(); }

    @Get('stats')
    stats() { return this.svc.stats(); }

    @Get('leads')
    list(
        @Query('stageId') stageId?: string,
        @Query('level') level?: LeadLevel,
        @Query('assignedWorkerId') assignedWorkerId?: string,
        @Query('brand') brand?: EventBrand,
        @Query('city') city?: string,
        @Query('productCategory') productCategory?: string,
        @Query('search') search?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.svc.list({
            stageId: stageId ? Number(stageId) : undefined,
            level,
            assignedWorkerId: assignedWorkerId ? Number(assignedWorkerId) : undefined,
            brand: brand || undefined,
            city: city || undefined,
            productCategory: productCategory || undefined,
            search,
            from,
            to,
            limit: limit ? Number(limit) : undefined,
            offset: offset ? Number(offset) : undefined,
        });
    }

    @Get('distinct/:field')
    distinct(@Param('field') field: string) {
        if (field !== 'city' && field !== 'productCategory') {
            return [];
        }
        return this.svc.distinctValues(field);
    }

    @Get('performance/by-marketer')
    performanceByMarketer(
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('brand') brand?: EventBrand,
    ) {
        return this.svc.performanceByMarketer({ from, to, brand });
    }

    @Get('dashboard/summary')
    dashboardSummary(
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('brand') brand?: EventBrand,
    ) {
        return this.svc.dashboardSummary({ from, to, brand });
    }

    @Get('leads/:id')
    getOne(@Param('id', ParseIntPipe) id: number) { return this.svc.getOne(id); }

    @Post('leads')
    create(@Body() body: CreateLeadInput) { return this.svc.create(body); }

    @Patch('leads/:id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateLeadInput) {
        return this.svc.update(id, body);
    }

    @Delete('leads/:id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }

    /** Upload foto referensi/sketsa untuk sebuah lead. Max 5 MB. */
    @Post('leads/:id/upload-image')
    @UseInterceptors(FileInterceptor('image', {
        storage: leadImageStorage,
        fileFilter: leadImageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadImage(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('File gambar wajib diupload');
        await compressImage(file.path);
        const imageUrl = `/uploads/${file.filename}`;
        return this.svc.setImage(id, imageUrl);
    }

    /** Hapus foto lead. */
    @Delete('leads/:id/image')
    async removeImage(@Param('id', ParseIntPipe) id: number) {
        return this.svc.setImage(id, null);
    }

    @Post('leads/reorder')
    reorder(@Body() body: ReorderInput) { return this.svc.reorder(body); }

    @Get('leads/:id/activities')
    listActivities(@Param('id', ParseIntPipe) id: number) { return this.svc.listActivities(id); }

    @Post('leads/:id/activities')
    addActivity(@Param('id', ParseIntPipe) id: number, @Body() body: ActivityInput) {
        return this.svc.addActivity(id, body);
    }

    @Post('leads/:id/convert')
    convert(@Param('id', ParseIntPipe) id: number, @Body() body: ConvertInput) {
        return this.svc.convert(id, body || {});
    }
}
