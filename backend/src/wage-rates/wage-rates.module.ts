import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WageRatesService } from './wage-rates.service';
import { WageRatesController } from './wage-rates.controller';
import { CustomWagePresetsService } from './custom-wage-presets.service';
import { CustomWagePresetsController } from './custom-wage-presets.controller';

@Module({
    imports: [PrismaModule],
    controllers: [WageRatesController, CustomWagePresetsController],
    providers: [WageRatesService, CustomWagePresetsService],
    exports: [WageRatesService, CustomWagePresetsService],
})
export class WageRatesModule { }
