import { Module } from '@nestjs/common';
import { DocumentNumberService } from './document-number.service';

@Module({
    providers: [DocumentNumberService],
    exports: [DocumentNumberService],
})
export class DocumentNumbersModule { }
