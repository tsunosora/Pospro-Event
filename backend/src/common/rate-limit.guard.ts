import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
    mixin,
    Type,
} from '@nestjs/common';

interface Hit { count: number; resetAt: number; }

/**
 * Rate-limit in-memory sederhana (fixed window) per IP + route.
 * Dipakai untuk endpoint publik sensitif (mis. verifikasi PIN) agar tahan
 * brute-force, tanpa dependency eksternal. Cukup untuk deploy single-instance.
 *
 * Contoh: `@UseGuards(RateLimit(10, 60_000))` → maks 10 request / 60 detik / IP.
 */
export function RateLimit(limit: number, windowMs: number): Type<CanActivate> {
    @Injectable()
    class RateLimitGuardMixin implements CanActivate {
        // Per config (tiap pemanggilan RateLimit) punya map sendiri.
        private static hits = new Map<string, Hit>();

        canActivate(ctx: ExecutionContext): boolean {
            const req = ctx.switchToHttp().getRequest();
            const fwd = req.headers?.['x-forwarded-for'];
            const ip =
                (typeof fwd === 'string' ? fwd.split(',')[0].trim() : undefined) ||
                req.ip ||
                req.socket?.remoteAddress ||
                'unknown';
            const routeKey = `${req.method}:${req.baseUrl || ''}${req.route?.path || req.path || ''}`;
            const key = `${ip}|${routeKey}`;
            const now = Date.now();

            const hit = RateLimitGuardMixin.hits.get(key);
            if (!hit || hit.resetAt <= now) {
                RateLimitGuardMixin.hits.set(key, { count: 1, resetAt: now + windowMs });
                this.maybePrune(now);
                return true;
            }
            if (hit.count >= limit) {
                const retry = Math.ceil((hit.resetAt - now) / 1000);
                throw new HttpException(
                    {
                        statusCode: HttpStatus.TOO_MANY_REQUESTS,
                        error: 'Too Many Requests',
                        message: `Terlalu banyak percobaan. Coba lagi dalam ${retry} detik.`,
                        retryAfter: retry,
                    },
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }
            hit.count++;
            return true;
        }

        // Bersihkan entri kadaluarsa saat map membesar, cegah memory leak.
        private maybePrune(now: number) {
            if (RateLimitGuardMixin.hits.size < 5000) return;
            for (const [k, v] of RateLimitGuardMixin.hits) {
                if (v.resetAt <= now) RateLimitGuardMixin.hits.delete(k);
            }
        }
    }
    return mixin(RateLimitGuardMixin);
}
