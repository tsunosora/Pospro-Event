import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SchedulePinService } from './schedule-pin.service';

@Injectable()
export class SchedulePinGuard implements CanActivate {
    constructor(private pinService: SchedulePinService) { }

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const pin = req.headers?.['x-schedule-pin'] || req.headers?.['X-Schedule-Pin'];
        if (!pin || typeof pin !== 'string') {
            throw new UnauthorizedException('PIN jadwal tidak tersedia');
        }
        const ok = await this.pinService.verify(pin);
        if (!ok) throw new UnauthorizedException('PIN jadwal salah');
        return true;
    }
}
