import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { SchedulePinService } from './schedule-pin.service';

@Controller('schedule-pin')
export class SchedulePinController {
    constructor(private svc: SchedulePinService) { }

    @Get('status')
    status() {
        return this.svc.getStatus();
    }

    // Batasi brute-force PIN: maks 10 percobaan / 60 detik / IP.
    @Post('verify')
    @UseGuards(RateLimit(10, 60_000))
    async verify(@Body() body: { pin?: string }) {
        const ok = await this.svc.verify(body?.pin || '');
        return { ok };
    }

    @Patch()
    @UseGuards(JwtAuthGuard)
    setPin(@Body() body: { pin: string }) {
        return this.svc.setPin(body?.pin || '');
    }
}
