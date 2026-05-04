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
import { WageRatesService, type WageRateInput } from './wage-rates.service';

@Controller('wage-rates')
@UseGuards(JwtAuthGuard)
export class WageRatesController {
    constructor(private svc: WageRatesService) { }

    @Get()
    list(@Query('includeInactive') includeInactive?: string) {
        return this.svc.list(includeInactive !== 'false');
    }

    @Get('distinct')
    distinct() {
        return this.svc.listDistinct();
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Post()
    create(@Body() body: WageRateInput) {
        return this.svc.create(body);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<WageRateInput>) {
        return this.svc.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
