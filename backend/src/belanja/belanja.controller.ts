import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BelanjaService } from './belanja.service';
import type { CreateBelanjaDto, CreateBelanjaBatchDto } from './belanja.service';
import { BelanjaPdfService } from './belanja-pdf.service';

interface JwtRequest extends Request {
  user?: { userId?: number; id?: number };
}
const uid = (r: JwtRequest) => r.user?.userId ?? r.user?.id ?? null;

const notaStorage = diskStorage({
  destination: './public/uploads/belanja',
  filename: (_r, file, cb) => cb(null, `nota-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
});
const notaFilter = (_r: any, file: any, cb: any) => {
  if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|webp|pdf)$/))
    return cb(new BadRequestException('Hanya gambar/PDF yang diizinkan'), false);
  cb(null, true);
};

@Controller('belanja')
@UseGuards(JwtAuthGuard)
export class BelanjaController {
  constructor(
    private service: BelanjaService,
    private pdfService: BelanjaPdfService,
  ) {}

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('eventId') eventId?: string,
    @Query('rabPlanId') rabPlanId?: string,
    @Query('rabItemId') rabItemId?: string,
    @Query('menuPlanId') menuPlanId?: string,
    @Query('untagged') untagged?: string,
  ) {
    return this.service.list({
      from,
      to,
      eventId: eventId ? Number(eventId) : undefined,
      rabPlanId: rabPlanId ? Number(rabPlanId) : undefined,
      rabItemId: rabItemId ? Number(rabItemId) : undefined,
      menuPlanId: menuPlanId ? Number(menuPlanId) : undefined,
      untagged: untagged === 'true',
    });
  }

  @Get('rekap-harian')
  rekap(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.rekapHarian({ from, to });
  }

  @Get('realisasi-rab/:rabPlanId')
  realisasi(@Param('rabPlanId', ParseIntPipe) rabPlanId: number) {
    return this.service.realisasiRab(rabPlanId);
  }

  @Get('export/pdf')
  @Header('Content-Type', 'application/pdf')
  async exportPdf(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('eventId') eventId?: string,
    @Query('rabPlanId') rabPlanId?: string,
  ) {
    const { buffer, filename } = await this.pdfService.render({
      from,
      to,
      eventId: eventId ? Number(eventId) : undefined,
      rabPlanId: rabPlanId ? Number(rabPlanId) : undefined,
    });
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  }

  @Post()
  create(@Body() body: CreateBelanjaDto, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new Error('User context missing');
    return this.service.create(body, u);
  }

  @Post('batch')
  createBatch(@Body() body: CreateBelanjaBatchDto, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new Error('User context missing');
    return this.service.createBatch(body, u);
  }

  @Post('group/:groupId/nota')
  @UseInterceptors(
    FileInterceptor('file', { storage: notaStorage, fileFilter: notaFilter, limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadNotaGroup(@Param('groupId') groupId: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File nota wajib diupload');
    return this.service.attachNotaGroup(groupId, file.filename);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: CreateBelanjaDto, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new Error('User context missing');
    return this.service.update(id, body, u);
  }

  @Post(':id/nota')
  @UseInterceptors(
    FileInterceptor('file', { storage: notaStorage, fileFilter: notaFilter, limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadNota(@Param('id', ParseIntPipe) id: number, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File nota wajib diupload');
    return this.service.attachNota(id, file.filename);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
