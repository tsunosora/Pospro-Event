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
import { QuotationVariantsService, type UpsertVariantInput } from './quotation-variants.service';

@Controller('quotation-variants')
@UseGuards(JwtAuthGuard)
export class QuotationVariantsController {
    constructor(private svc: QuotationVariantsService) { }

    @Get()
    list(@Query('includeInactive') includeInactive?: string) {
        return this.svc.findAll(includeInactive === 'true' || includeInactive === '1');
    }

    @Get(':code')
    getOne(@Param('code') code: string) {
        return this.svc.findByCode(code);
    }

    @Post()
    create(@Body() body: UpsertVariantInput) {
        return this.svc.create(body);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<UpsertVariantInput>) {
        return this.svc.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
