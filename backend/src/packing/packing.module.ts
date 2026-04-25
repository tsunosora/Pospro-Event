import { Module } from '@nestjs/common';
import { PackingController } from './packing.controller';
import { PackingService } from './packing.service';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';

@Module({
    imports: [DocumentNumbersModule],
    controllers: [PackingController],
    providers: [PackingService],
    exports: [PackingService],
})
export class PackingModule { }
