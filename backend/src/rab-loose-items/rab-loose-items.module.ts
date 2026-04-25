import { Module } from '@nestjs/common';
import { RabLooseItemsController } from './rab-loose-items.controller';
import { RabLooseItemsService } from './rab-loose-items.service';

@Module({
    controllers: [RabLooseItemsController],
    providers: [RabLooseItemsService],
    exports: [RabLooseItemsService],
})
export class RabLooseItemsModule { }
