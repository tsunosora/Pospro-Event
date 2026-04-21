import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrintQueueController } from './print-queue.controller';
import { PrintQueueService } from './print-queue.service';

@Module({
    imports: [PrismaModule],
    controllers: [PrintQueueController],
    providers: [PrintQueueService],
    exports: [PrintQueueService],
})
export class PrintQueueModule {}
