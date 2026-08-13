import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuPlanController } from './plan.controller';
import { MenuVoteController } from './vote.controller';
import { PublicMenuVoteController } from './public-vote.controller';
import { MenuSettingController } from './setting.controller';
import { MenuService } from './menu.service';
import { MenuPlanService } from './plan.service';
import { MenuVoteService } from './vote.service';
import { MenuSettingService } from './setting.service';
import { ManagerGuard } from '../auth/manager.guard';

@Module({
  controllers: [MenuController, MenuPlanController, MenuVoteController, PublicMenuVoteController, MenuSettingController],
  providers: [MenuService, MenuPlanService, MenuVoteService, MenuSettingService, ManagerGuard],
  exports: [MenuService, MenuPlanService],
})
export class MenuMakanModule {}
