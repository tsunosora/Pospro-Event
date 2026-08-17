import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CategoriesModule } from './categories/categories.module';
import { UnitsModule } from './units/units.module';
import { ProductsModule } from './products/products.module';
import { BatchesModule } from './batches/batches.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CashflowModule } from './cashflow/cashflow.module';
import { InvoiceModule } from './invoice/invoice.module';
import { BranchesModule } from './branches/branches.module';
import { SettingsModule } from './settings/settings.module';
import { BrandsModule } from './brands/brands.module';
import { QuotationVariantsModule } from './quotation-variants/quotation-variants.module';
import { InventoryAcquisitionsModule } from './inventory-acquisitions/inventory-acquisitions.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { CustomersModule } from './customers/customers.module';
import { HppModule } from './hpp/hpp.module';
import { ReportsModule } from './reports/reports.module';
import { CompetitorsModule } from './competitors/competitors.module';
import { StockOpnameModule } from './stock-opname/stock-opname.module';
import { ProductionModule } from './production/production.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { BackupModule } from './backup/backup.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WebhookModule } from './webhook/webhook.module';
import { CashflowRequestsModule } from './cashflow-requests/cashflow-requests.module';
import { StockPurchasesModule } from './stock-purchases/stock-purchases.module';
import { DocumentNumbersModule } from './document-numbers/document-numbers.module';
import { QuotationsModule } from './quotations/quotations.module';
import { RabModule } from './rab/rab.module';
import { RabCategoriesModule } from './rab-categories/rab-categories.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { WorkersModule } from './workers/workers.module';
import { PayrollModule } from './payroll/payroll.module';
import { WageRatesModule } from './wage-rates/wage-rates.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { WarehousePinModule } from './warehouse-pin/warehouse-pin.module';
import { SchedulePinModule } from './schedule-pin/schedule-pin.module';
import { PublicGudangModule } from './public-gudang/public-gudang.module';
import { EventsModule } from './events/events.module';
import { StorageLocationsModule } from './storage-locations/storage-locations.module';
import { PackingModule } from './packing/packing.module';
import { RabLooseItemsModule } from './rab-loose-items/rab-loose-items.module';
import { CrmModule } from './crm/crm.module';
import { BelanjaModule } from './belanja/belanja.module';
import { MenuMakanModule } from './menu-makan/menu-makan.module';
import { BoronganModule } from './borongan/borongan.module';
import { PengajuanModule } from './pengajuan/pengajuan.module';
import { AiAgentModule } from './ai-agent/ai-agent.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'), // Serve local uploads
    }),
    PrismaModule, UsersModule, AuthModule, CategoriesModule, UnitsModule, ProductsModule, BatchesModule, StockMovementsModule, TransactionsModule, CashflowModule, InvoiceModule, BranchesModule, SettingsModule, BankAccountsModule, CustomersModule, HppModule, ReportsModule, CompetitorsModule, StockOpnameModule, ProductionModule, SuppliersModule, BackupModule, NotificationsModule, WebhookModule, CashflowRequestsModule, StockPurchasesModule, DocumentNumbersModule, QuotationsModule, RabModule, RabCategoriesModule, WarehousesModule, WorkersModule, PayrollModule, WageRatesModule, WithdrawalsModule, WarehousePinModule, SchedulePinModule, PublicGudangModule, EventsModule, StorageLocationsModule, PackingModule, RabLooseItemsModule, CrmModule, BrandsModule, QuotationVariantsModule, InventoryAcquisitionsModule, BelanjaModule, MenuMakanModule, BoronganModule, PengajuanModule, AiAgentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
