import { Module } from '@nestjs/common';
import { SchedulePinController } from './schedule-pin.controller';
import { SchedulePinService } from './schedule-pin.service';
import { SchedulePinGuard } from './schedule-pin.guard';

@Module({
    controllers: [SchedulePinController],
    providers: [SchedulePinService, SchedulePinGuard],
    exports: [SchedulePinService, SchedulePinGuard],
})
export class SchedulePinModule { }
