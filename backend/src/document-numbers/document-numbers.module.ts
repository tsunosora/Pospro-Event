import { Module } from '@nestjs/common';
import { DocumentNumberService } from './document-number.service';
import { DocumentNumbersController } from './document-numbers.controller';

@Module({
    controllers: [DocumentNumbersController],
    providers: [DocumentNumberService],
    exports: [DocumentNumberService],
})
export class DocumentNumbersModule { }
