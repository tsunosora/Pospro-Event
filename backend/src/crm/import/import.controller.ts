import {
    BadRequestException,
    Controller,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ImportService } from './import.service';

@Controller('crm/import')
@UseGuards(JwtAuthGuard)
export class ImportController {
    constructor(private svc: ImportService) { }

    @Post('xlsx')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: { fileSize: 16 * 1024 * 1024 },
        }),
    )
    async importXlsx(
        @UploadedFile() file: Express.Multer.File | undefined,
        @Query('dryRun') dryRun?: string,
    ) {
        if (!file) throw new BadRequestException('File XLSX wajib');
        const rows = await this.svc.parseBuffer(file.buffer);
        if (dryRun === '1' || dryRun === 'true') {
            return { dryRun: true, parsed: rows.length, preview: rows.slice(0, 50), rows };
        }
        const summary = await this.svc.commit(rows);
        return summary;
    }
}
