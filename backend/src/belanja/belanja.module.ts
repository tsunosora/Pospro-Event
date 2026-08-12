import { Module } from '@nestjs/common';
import { BelanjaController } from './belanja.controller';
import { KasController } from './kas.controller';
import { BelanjaService } from './belanja.service';
import { KasService } from './kas.service';

@Module({
  controllers: [BelanjaController, KasController],
  providers: [BelanjaService, KasService],
  exports: [BelanjaService, KasService],
})
export class BelanjaModule {}
