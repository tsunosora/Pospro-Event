import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { WarehousePinService } from './warehouse-pin.service';

@Injectable()
export class WarehousePinGuard implements CanActivate {
    constructor(private pinService: WarehousePinService) { }

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const pin = req.headers?.['x-warehouse-pin'] || req.headers?.['X-Warehouse-Pin'];
        if (!pin || typeof pin !== 'string') {
            throw new UnauthorizedException('PIN gudang tidak tersedia');
        }
        const ok = await this.pinService.verify(pin);
        if (!ok) throw new UnauthorizedException('PIN gudang salah');
        return true;
    }
}
