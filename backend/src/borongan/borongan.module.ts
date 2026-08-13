import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BoronganService } from './borongan.service';
import { BoronganController } from './borongan.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BoronganController],
  providers: [BoronganService],
})
export class BoronganModule {}
