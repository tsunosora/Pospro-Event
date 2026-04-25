import { Controller, Get, Param } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('public/events')
export class PublicEventsController {
    constructor(private svc: EventsService) { }

    @Get(':token')
    async getByToken(@Param('token') token: string) {
        return this.svc.findByToken(token);
    }
}
