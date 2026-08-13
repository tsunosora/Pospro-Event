import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RateLimit } from '../common/rate-limit.guard';
import { MenuVoteService } from './vote.service';

@Controller('public/menu-vote')
export class PublicMenuVoteController {
  constructor(private service: MenuVoteService) {}

  @Get(':token')
  @UseGuards(RateLimit(60, 60_000))
  detail(@Param('token') token: string) {
    return this.service.publicDetail(token);
  }

  @Post(':token/vote')
  @UseGuards(RateLimit(20, 60_000))
  vote(@Param('token') token: string, @Body() body: { menuId: number; voterName: string; weight?: number }) {
    return this.service.publicVote(token, Number(body.menuId), body.voterName, Number(body.weight) || 1);
  }
}
