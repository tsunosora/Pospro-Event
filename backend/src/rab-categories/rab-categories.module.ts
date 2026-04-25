import { Module } from '@nestjs/common';
import { RabCategoriesController } from './rab-categories.controller';
import { RabCategoriesService } from './rab-categories.service';

@Module({
    controllers: [RabCategoriesController],
    providers: [RabCategoriesService],
    exports: [RabCategoriesService],
})
export class RabCategoriesModule { }
