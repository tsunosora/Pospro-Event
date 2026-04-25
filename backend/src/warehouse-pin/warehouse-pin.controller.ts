import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WarehousePinService } from './warehouse-pin.service';

@Controller('warehouse-pin')
export class WarehousePinController {
    constructor(private svc: WarehousePinService) { }

    @Get('status')
    status() {
        return this.svc.getStatus();
    }

    @Post('verify')
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
