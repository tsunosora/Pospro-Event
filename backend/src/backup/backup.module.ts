import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { RcloneService } from './rclone.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule, ScheduleModule.forRoot()],
    controllers: [BackupController],
    providers: [BackupService, RcloneService],
    exports: [BackupService, RcloneService],
})
export class BackupModule {}
