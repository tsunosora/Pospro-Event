import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { EventCrewService } from './event-crew.service';

const photoStorage = diskStorage({
    destination: './public/uploads',
    filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname) || '.jpg';
        cb(null, `crew-${unique}${ext}`);
    },
});

const photoFilter = (_req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/)) {
        return cb(new BadRequestException('Hanya file gambar yang diijinkan'), false);
    }
    cb(null, true);
};

@Controller('public/crew')
export class PublicEventCrewController {
    constructor(private svc: EventCrewService) { }

    @Get(':token')
    get(@Param('token') token: string) {
        return this.svc.findByToken(token);
    }

    @Post(':token/check-in')
    @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, fileFilter: photoFilter, limits: { fileSize: 8 * 1024 * 1024 } }))
    checkIn(
        @Param('token') token: string,
        @UploadedFile() file: Express.Multer.File | undefined,
        @Body('note') note?: string,
    ) {
        const photoUrl = file ? `/uploads/${file.filename}` : null;
        return this.svc.checkIn(token, photoUrl, note);
    }

    @Post(':token/check-out')
    @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, fileFilter: photoFilter, limits: { fileSize: 8 * 1024 * 1024 } }))
    checkOut(
        @Param('token') token: string,
        @UploadedFile() file: Express.Multer.File | undefined,
        @Body('note') note?: string,
    ) {
        const photoUrl = file ? `/uploads/${file.filename}` : null;
        return this.svc.checkOut(token, photoUrl, note);
    }
}
