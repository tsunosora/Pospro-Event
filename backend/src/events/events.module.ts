import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { PublicEventsController } from './public-events.controller';
import { PublicPackingController } from './public-packing.controller';
import { EventsService } from './events.service';
import { ExportersModule } from '../exporters/exporters.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { WarehousePinModule } from '../warehouse-pin/warehouse-pin.module';
import { PackingModule } from '../packing/packing.module';

@Module({
    imports: [ExportersModule, WhatsappModule, WarehousePinModule, PackingModule],
    controllers: [EventsController, PublicEventsController, PublicPackingController],
    providers: [EventsService],
    exports: [EventsService],
})
export class EventsModule { }
