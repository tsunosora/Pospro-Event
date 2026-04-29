import {
    Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentNumberService } from './document-number.service';

@Controller('document-numbers')
@UseGuards(JwtAuthGuard)
export class DocumentNumbersController {
    constructor(private svc: DocumentNumberService) { }

    @Get('counters')
    listCounters(
        @Query('docType') docType?: string,
        @Query('year') year?: string,
    ) {
        return this.svc.listCounters({
            docType: docType || undefined,
            year: year ? parseInt(year, 10) : undefined,
        });
    }

    @Post('counters/set')
    setCounter(@Body() body: { docType: string; kode: string; year: number; lastSeq: number }) {
        return this.svc.setCounter(body.docType, body.kode, body.year, body.lastSeq);
    }
}
