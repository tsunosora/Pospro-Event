import { Module } from '@nestjs/common';
import { LeadsController } from './leads/leads.controller';
import { LeadsService } from './leads/leads.service';
import { StagesController } from './stages/stages.controller';
import { StagesService } from './stages/stages.service';
import { LabelsController } from './labels/labels.controller';
import { LabelsService } from './labels/labels.service';
import { ImportController } from './import/import.controller';
import { ImportService } from './import/import.service';

@Module({
    controllers: [LeadsController, StagesController, LabelsController, ImportController],
    providers: [LeadsService, StagesService, LabelsService, ImportService],
    exports: [LeadsService],
})
export class CrmModule { }
