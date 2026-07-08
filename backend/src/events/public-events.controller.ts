import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('public/events')
export class PublicEventsController {
    constructor(private svc: EventsService) { }

    // Timeline publik untuk tukang — dibatasi token rahasia (tanpa login).
    @Get('timeline/:token')
    async timeline(
        @Param('token') token: string,
        @Query('year') year?: string,
        @Query('month') month?: string,
    ) {
        return this.svc.findTimelineByToken(token, {
            year: year ? Number(year) : undefined,
            month: month ? Number(month) : undefined,
        });
    }

    @Get(':token')
    async getByToken(@Param('token') token: string) {
        return this.svc.findByToken(token);
    }
}
