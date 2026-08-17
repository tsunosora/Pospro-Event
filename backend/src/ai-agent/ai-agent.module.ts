import { Module } from '@nestjs/common';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiConfigService } from './ai-config.service';
import { AiProviderService } from './ai-provider.service';
import { AiRetrievalService } from './ai-retrieval.service';
import { ManagerGuard } from '../auth/manager.guard';
import { CashflowModule } from '../cashflow/cashflow.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [CashflowModule, CrmModule],
  controllers: [AiAgentController],
  providers: [
    AiAgentService,
    AiConfigService,
    AiProviderService,
    AiRetrievalService,
    ManagerGuard,
  ],
})
export class AiAgentModule {}
