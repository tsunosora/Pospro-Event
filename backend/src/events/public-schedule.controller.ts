import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { SchedulePinGuard } from '../schedule-pin/schedule-pin.guard';
import { RateLimit } from '../common/rate-limit.guard';

// Jadwal event publik — akses hanya dengan PIN jadwal (header x-schedule-pin).
// RateLimit lebih dulu (batasi juga percobaan PIN salah), lalu cek PIN.
@Controller('public/schedule')
@UseGuards(RateLimit(60, 60_000), SchedulePinGuard)
export class PublicScheduleController {
    constructor(private svc: EventsService) { }

    @Get()
    async list(
        @Query('year') year?: string,
        @Query('month') month?: string,
        @Query('months') months?: string,
    ) {
        return this.svc.findAllPublic({
            year: year ? Number(year) : undefined,
            month: month ? Number(month) : undefined,
            months: months ? Number(months) : undefined,
        });
    }
}
