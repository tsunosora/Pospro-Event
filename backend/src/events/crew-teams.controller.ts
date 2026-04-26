import {
    Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CrewTeamsService } from './crew-teams.service';
import type { CreateTeamInput, UpdateTeamInput } from './crew-teams.service';

@Controller('crew-teams')
@UseGuards(JwtAuthGuard)
export class CrewTeamsController {
    constructor(private svc: CrewTeamsService) { }

    @Get()
    list(@Query('includeInactive') includeInactive?: string) {
        return this.svc.list(includeInactive === 'true' || includeInactive === '1');
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Post()
    create(@Body() input: CreateTeamInput) {
        return this.svc.create(input);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() input: UpdateTeamInput) {
        return this.svc.update(id, input);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
