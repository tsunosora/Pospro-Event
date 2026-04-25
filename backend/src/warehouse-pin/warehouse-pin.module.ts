import { Module } from '@nestjs/common';
import { WarehousePinController } from './warehouse-pin.controller';
import { WarehousePinService } from './warehouse-pin.service';
import { WarehousePinGuard } from './warehouse-pin.guard';

@Module({
    controllers: [WarehousePinController],
    providers: [WarehousePinService, WarehousePinGuard],
    exports: [WarehousePinService, WarehousePinGuard],
})
export class WarehousePinModule { }
