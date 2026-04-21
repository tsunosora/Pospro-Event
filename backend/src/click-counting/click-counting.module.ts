import { Module } from '@nestjs/common';
import { ClickCountingService } from './click-counting.service';
import { ClickCountingController } from './click-counting.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClickCountingController],
  providers: [ClickCountingService],
})
export class ClickCountingModule {}
