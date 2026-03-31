import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule, NotificationsModule],
    controllers: [WebhookController],
})
export class WebhookModule { }
