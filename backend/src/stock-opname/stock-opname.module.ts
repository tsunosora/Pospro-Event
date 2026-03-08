import { Module } from '@nestjs/common';
import { StockOpnameAdminController, StockOpnamePublicController } from './stock-opname.controller';
import { StockOpnameService } from './stock-opname.service';

@Module({
    controllers: [StockOpnameAdminController, StockOpnamePublicController],
    providers: [StockOpnameService],
})
export class StockOpnameModule {}
