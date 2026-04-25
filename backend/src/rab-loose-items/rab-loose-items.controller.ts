import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RabLooseItemsService } from './rab-loose-items.service';
import type { PromoteInput, UpsertLooseItemInput } from './rab-loose-items.service';

@Controller('rab-loose-items')
@UseGuards(JwtAuthGuard)
export class RabLooseItemsController {
    constructor(private svc: RabLooseItemsService) { }

    @Get()
    list(@Query('search') search?: string, @Query('limit') limit?: string) {
        return this.svc.findAll(search, limit ? Number(limit) : 20);
    }

    @Get('suggestions')
    suggestions(@Query('q') q?: string) {
        return this.svc.suggestions(q ?? '');
    }

    @Post()
    create(@Body() body: UpsertLooseItemInput) {
        return this.svc.upsert(body);
    }

    @Post('bulk')
    bulk(@Body() body: { items: UpsertLooseItemInput[] }) {
        return this.svc.bulkUpsert(body?.items ?? []);
    }

    @Post(':id/promote')
    promote(@Param('id', ParseIntPipe) id: number, @Body() body: PromoteInput) {
        return this.svc.promote(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
