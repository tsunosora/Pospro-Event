import { Module } from '@nestjs/common';
import { QuotationVariantsController } from './quotation-variants.controller';
import { QuotationVariantsService } from './quotation-variants.service';

@Module({
    controllers: [QuotationVariantsController],
    providers: [QuotationVariantsService],
    exports: [QuotationVariantsService],
})
export class QuotationVariantsModule { }
