import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';

@Module({
  imports: [DocumentNumbersModule],
  controllers: [InvoiceController],
  providers: [InvoiceService]
})
export class InvoiceModule {}
