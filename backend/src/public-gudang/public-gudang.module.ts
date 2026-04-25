import { Module } from '@nestjs/common';
import { PublicGudangController } from './public-gudang.controller';
import { WarehousePinModule } from '../warehouse-pin/warehouse-pin.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';

@Module({
    imports: [WarehousePinModule, WithdrawalsModule],
    controllers: [PublicGudangController],
})
export class PublicGudangModule { }
