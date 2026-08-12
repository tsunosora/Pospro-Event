import { Module } from '@nestjs/common';
import { BelanjaController } from './belanja.controller';
import { KasController } from './kas.controller';
import { BelanjaService } from './belanja.service';
import { KasService } from './kas.service';
import { BelanjaPdfService } from './belanja-pdf.service';

@Module({
  controllers: [BelanjaController, KasController],
  providers: [BelanjaService, KasService, BelanjaPdfService],
  exports: [BelanjaService, KasService],
})
export class BelanjaModule {}
