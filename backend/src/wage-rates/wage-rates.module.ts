import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WageRatesService } from './wage-rates.service';
import { WageRatesController } from './wage-rates.controller';

@Module({
    imports: [PrismaModule],
    controllers: [WageRatesController],
    providers: [WageRatesService],
    exports: [WageRatesService],
})
export class WageRatesModule { }
