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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkersService } from './workers.service';
import type { CreateWorkerInput, UpdateWorkerInput } from './workers.service';

const photoStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `worker-${uniqueSuffix}${ext}`);
    },
});

const photoFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/)) {
        return cb(new BadRequestException('Hanya file gambar yang diijinkan'), false);
    }
    cb(null, true);
};

@Controller('workers')
@UseGuards(JwtAuthGuard)
export class WorkersController {
    constructor(private svc: WorkersService) { }

    @Get()
    list(
        @Query('includeInactive') includeInactive?: string,
        @Query('position') position?: string,
        @Query('positions') positions?: string,
    ) {
        return this.svc.findAll(
            includeInactive === 'true' || includeInactive === '1',
            {
                position: position || undefined,
                positions: positions ? positions.split(',').map((p) => p.trim()).filter(Boolean) : undefined,
            },
        );
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Post()
    @UseInterceptors(FileInterceptor('photo', {
        storage: photoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async create(
        @Body() body: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const input: CreateWorkerInput = {
            name: body.name,
            position: body.position,
            phone: body.phone,
            notes: body.notes,
            isActive: body.isActive === 'false' ? false : (body.isActive === 'true' ? true : undefined),
            photoUrl: file ? `/uploads/${file.filename}` : undefined,
            // Payroll
            dailyWageRate: body.dailyWageRate ?? undefined,
            overtimeRatePerHour: body.overtimeRatePerHour ?? undefined,
            isPic: body.isPic === 'true' || body.isPic === true ? true : (body.isPic === 'false' || body.isPic === false ? false : undefined),
            picPin: body.picPin ?? undefined,
            teamId: body.teamId === '' || body.teamId == null ? null : Number(body.teamId),
            defaultCityKey: body.defaultCityKey ?? undefined,
            defaultDivisionKey: body.defaultDivisionKey ?? undefined,
        };
        return this.svc.create(input);
    }

    @Patch(':id')
    @UseInterceptors(FileInterceptor('photo', {
        storage: photoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const input: UpdateWorkerInput = {};
        if (body.name !== undefined) input.name = body.name;
        if (body.position !== undefined) input.position = body.position;
        if (body.phone !== undefined) input.phone = body.phone;
        if (body.notes !== undefined) input.notes = body.notes;
        if (body.signatureDisplayName !== undefined) input.signatureDisplayName = body.signatureDisplayName || null;
        if (body.isActive !== undefined) {
            input.isActive = body.isActive === 'false' ? false : body.isActive === 'true' ? true : body.isActive;
        }
        if (file) input.photoUrl = `/uploads/${file.filename}`;
        // Payroll fields
        if (body.dailyWageRate !== undefined) input.dailyWageRate = body.dailyWageRate;
        if (body.overtimeRatePerHour !== undefined) input.overtimeRatePerHour = body.overtimeRatePerHour;
        if (body.isPic !== undefined) {
            input.isPic = body.isPic === 'true' || body.isPic === true ? true : false;
        }
        if (body.picPin !== undefined) input.picPin = body.picPin || null;
        if (body.teamId !== undefined) {
            input.teamId = body.teamId === '' || body.teamId === null || body.teamId === 'null' ? null : Number(body.teamId);
        }
        if (body.defaultCityKey !== undefined) input.defaultCityKey = body.defaultCityKey || null;
        if (body.defaultDivisionKey !== undefined) input.defaultDivisionKey = body.defaultDivisionKey || null;
        return this.svc.update(id, input);
    }

    /** Generate ulang token PIC (kalau bocor / mau invalidate link lama) */
    @Post(':id/regenerate-pic-token')
    regeneratePicToken(@Param('id', ParseIntPipe) id: number) {
        return this.svc.regeneratePicToken(id);
    }

    @Patch(':id/restore')
    restore(@Param('id', ParseIntPipe) id: number) {
        return this.svc.restore(id);
    }

    @Post(':id/upload-signature')
    @UseInterceptors(FileInterceptor('image', {
        storage: photoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadSignature(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('File tanda tangan wajib diupload');
        return this.svc.update(id, { signatureImageUrl: `/uploads/${file.filename}` });
    }

    @Delete(':id/signature')
    removeSignature(@Param('id', ParseIntPipe) id: number) {
        return this.svc.update(id, { signatureImageUrl: null });
    }

    @Post(':id/upload-stamp')
    @UseInterceptors(FileInterceptor('image', {
        storage: photoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadStamp(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('File stempel wajib diupload');
        return this.svc.update(id, { stampImageUrl: `/uploads/${file.filename}` });
    }

    @Delete(':id/stamp')
    removeStamp(@Param('id', ParseIntPipe) id: number) {
        return this.svc.update(id, { stampImageUrl: null });
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
