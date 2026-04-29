import { Module } from '@nestjs/common';
import { InventoryAcquisitionsController } from './inventory-acquisitions.controller';
import { InventoryAcquisitionsService } from './inventory-acquisitions.service';

@Module({
    controllers: [InventoryAcquisitionsController],
    providers: [InventoryAcquisitionsService],
    exports: [InventoryAcquisitionsService],
})
export class InventoryAcquisitionsModule { }
