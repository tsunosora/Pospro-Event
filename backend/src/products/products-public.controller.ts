import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products/public')
export class ProductsPublicController {
    constructor(private readonly productsService: ProductsService) { }

    @Get(':id')
    findOnePublic(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.findOnePublic(id);
    }
}
