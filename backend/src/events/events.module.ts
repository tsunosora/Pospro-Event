import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { PublicEventsController } from './public-events.controller';
import { PublicPackingController } from './public-packing.controller';
import { EventCrewController } from './event-crew.controller';
import { PublicEventCrewController } from './public-event-crew.controller';
import { CrewTeamsController } from './crew-teams.controller';
import { EventsService } from './events.service';
import { EventCrewService } from './event-crew.service';
import { CrewTeamsService } from './crew-teams.service';
import { ExportersModule } from '../exporters/exporters.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { WarehousePinModule } from '../warehouse-pin/warehouse-pin.module';
import { PackingModule } from '../packing/packing.module';
import { CashflowModule } from '../cashflow/cashflow.module';
import { ProjectReportPdfService } from '../exporters/project-report-pdf.service';

@Module({
    imports: [ExportersModule, WhatsappModule, WarehousePinModule, PackingModule, CashflowModule],
    controllers: [
        EventsController,
        PublicEventsController,
        PublicPackingController,
        EventCrewController,
        PublicEventCrewController,
        CrewTeamsController,
    ],
    providers: [EventsService, EventCrewService, CrewTeamsService, ProjectReportPdfService],
    exports: [EventsService, EventCrewService, CrewTeamsService],
})
export class EventsModule { }
