import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';

@Module({
    imports: [ScheduleModule.forRoot(), DocumentNumbersModule],
    controllers: [WithdrawalsController],
    providers: [WithdrawalsService],
    exports: [WithdrawalsService],
})
export class WithdrawalsModule { }
