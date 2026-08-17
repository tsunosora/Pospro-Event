import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/manager.guard';
import { AiAgentService } from './ai-agent.service';
import { AiConfigService } from './ai-config.service';
import { ChatDto } from './dto/chat.dto';
import { TranslateDto } from './dto/translate.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import type { AiPublicStatus } from './ai-agent.types';

@Controller('ai-agent')
@UseGuards(JwtAuthGuard)
export class AiAgentController {
  constructor(
    private svc: AiAgentService,
    private cfgSvc: AiConfigService,
  ) {}

  @Get('status')
  status(): AiPublicStatus {
    const c = this.cfgSvc.getConfig();
    return {
      enabled: c.enabled,
      chatEnabled: c.chatEnabled,
      name: c.name,
      greeting: c.greeting,
      avatar: c.avatar,
    };
  }

  @Post('chat')
  chat(@Req() req: any, @Body() dto: ChatDto) {
    return this.svc.chat(req.user.userId, dto.message, dto.history ?? []);
  }

  @Post('translate')
  translate(@Body() dto: TranslateDto) {
    return this.svc.translate(dto.texts, dto.to ?? 'en');
  }

  // ----- Owner only -----
  @Get('config')
  @UseGuards(ManagerGuard)
  getConfig() {
    return this.cfgSvc.maskConfig(this.cfgSvc.getConfig());
  }

  @Put('config')
  @UseGuards(ManagerGuard)
  updateConfig(@Body() dto: UpdateConfigDto) {
    const next = this.cfgSvc.applyUpdate(this.cfgSvc.getConfig(), dto);
    this.cfgSvc.saveConfig(next);
    return this.cfgSvc.maskConfig(next);
  }

  @Post('test')
  @UseGuards(ManagerGuard)
  test() {
    return this.svc.testConnection();
  }
}
