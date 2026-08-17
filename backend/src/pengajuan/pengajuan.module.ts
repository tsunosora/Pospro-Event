import { Module } from '@nestjs/common';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { PengajuanController } from './pengajuan.controller';
import { PengajuanService } from './pengajuan.service';
import { ManagerGuard } from '../auth/manager.guard';

@Module({
  imports: [DocumentNumbersModule],
  controllers: [PengajuanController],
  providers: [PengajuanService, ManagerGuard],
  exports: [PengajuanService],
})
export class PengajuanModule {}
