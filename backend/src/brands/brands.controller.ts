import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { EventBrand } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { compressImage } from '../common/utils/compress-image.util';
import { BrandsService, type UpsertBrandInput } from './brands.service';

const logoStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `brand-${uniqueSuffix}${extname(file.originalname)}`);
    },
});

const imageFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp|svg)$/)) {
        return cb(new BadRequestException('Hanya file gambar yang diijinkan'), false);
    }
    cb(null, true);
};

const VALID_BRANDS: EventBrand[] = ['EXINDO', 'XPOSER', 'OTHER'];
function parseBrand(s: string): EventBrand {
    const upper = s.toUpperCase();
    if (!VALID_BRANDS.includes(upper as EventBrand)) {
        throw new BadRequestException(`Brand tidak valid: ${s}`);
    }
    return upper as EventBrand;
}

@Controller('brands')
@UseGuards(JwtAuthGuard)
export class BrandsController {
    constructor(private svc: BrandsService) { }

    @Get()
    list() {
        return this.svc.findAll();
    }

    @Get(':brand')
    getOne(@Param('brand') brand: string) {
        return this.svc.findByBrand(parseBrand(brand));
    }

    @Get(':brand/stats')
    stats(@Param('brand') brand: string) {
        return this.svc.stats(parseBrand(brand));
    }

    @Patch(':brand')
    upsert(@Param('brand') brand: string, @Body() body: Omit<UpsertBrandInput, 'brand'>) {
        return this.svc.upsert({ ...body, brand: parseBrand(brand) });
    }

    @Post(':brand/upload-logo')
    @UseInterceptors(FileInterceptor('image', {
        storage: logoStorage,
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadLogo(
        @Param('brand') brand: string,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('File logo wajib diupload');
        await compressImage(file.path);
        const logoImageUrl = `/uploads/${file.filename}`;
        return this.svc.setLogo(parseBrand(brand), logoImageUrl);
    }

    @Delete(':brand/logo')
    removeLogo(@Param('brand') brand: string) {
        return this.svc.setLogo(parseBrand(brand), null);
    }

    @Post(':brand/upload-letterhead')
    @UseInterceptors(FileInterceptor('image', {
        storage: logoStorage,
        fileFilter: imageFilter,
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — kop surat full-page bisa lebih besar
    }))
    async uploadLetterhead(
        @Param('brand') brand: string,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('File kop surat wajib diupload');
        await compressImage(file.path);
        const letterheadImageUrl = `/uploads/${file.filename}`;
        return this.svc.setLetterhead(parseBrand(brand), letterheadImageUrl);
    }

    @Delete(':brand/letterhead')
    removeLetterhead(@Param('brand') brand: string) {
        return this.svc.setLetterhead(parseBrand(brand), null);
    }

    @Post(':brand/upload-stamp')
    @UseInterceptors(FileInterceptor('image', {
        storage: logoStorage,
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadStamp(
        @Param('brand') brand: string,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('File stempel wajib diupload');
        await compressImage(file.path);
        const stampImageUrl = `/uploads/${file.filename}`;
        return this.svc.setStamp(parseBrand(brand), stampImageUrl);
    }

    @Delete(':brand/stamp')
    removeStamp(@Param('brand') brand: string) {
        return this.svc.setStamp(parseBrand(brand), null);
    }
}
