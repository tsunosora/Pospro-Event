import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RabCategoriesService } from './rab-categories.service';
import type {
    CreateRabCategoryInput,
    UpdateRabCategoryInput,
} from './rab-categories.service';

@Controller('rab-categories')
@UseGuards(JwtAuthGuard)
export class RabCategoriesController {
    constructor(private svc: RabCategoriesService) { }

    @Get()
    list(@Query('includeInactive') includeInactive?: string) {
        return this.svc.findAll(includeInactive === 'true' || includeInactive === '1');
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Post()
    create(@Body() body: CreateRabCategoryInput) {
        return this.svc.create(body);
    }

    @Patch('reorder')
    reorder(@Body() body: { orderedIds: number[] }) {
        return this.svc.reorder(body.orderedIds);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateRabCategoryInput,
    ) {
        return this.svc.update(id, body);
    }

    @Patch(':id/restore')
    restore(@Param('id', ParseIntPipe) id: number) {
        return this.svc.restore(id);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
