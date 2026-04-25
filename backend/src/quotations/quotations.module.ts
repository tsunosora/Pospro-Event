import { Module } from '@nestjs/common';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { ExportersModule } from '../exporters/exporters.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';

@Module({
    imports: [DocumentNumbersModule, ExportersModule],
    controllers: [QuotationsController],
    providers: [QuotationsService],
    exports: [QuotationsService],
})
export class QuotationsModule { }
