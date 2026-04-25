import { Module } from '@nestjs/common';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { ExportersModule } from '../exporters/exporters.module';
import { RabLooseItemsModule } from '../rab-loose-items/rab-loose-items.module';
import { RabController } from './rab.controller';
import { RabService } from './rab.service';

@Module({
    imports: [DocumentNumbersModule, ExportersModule, RabLooseItemsModule],
    controllers: [RabController],
    providers: [RabService],
    exports: [RabService],
})
export class RabModule { }
