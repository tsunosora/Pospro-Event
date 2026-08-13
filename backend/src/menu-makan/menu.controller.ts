import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { compressImage } from '../common/utils/compress-image.util';
import { MenuService } from './menu.service';
import type { CreateMenuDto } from './menu.service';

interface JwtRequest extends Request {
  user?: { userId?: number; id?: number };
}
const uid = (r: JwtRequest) => r.user?.userId ?? r.user?.id ?? null;

const photoStorage = diskStorage({
  destination: './public/uploads',
  filename: (_r, file, cb) => cb(null, `menu-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
});
const photoFilter = (_r: any, file: any, cb: any) => {
  if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/))
    return cb(new BadRequestException('Hanya file gambar yang diizinkan'), false);
  cb(null, true);
};

@Controller('menu')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private service: MenuService) {}

  @Get()
  list(@Query('active') active?: string, @Query('q') q?: string) {
    return this.service.list({
      active: active === undefined ? undefined : active === 'true',
      q: q || undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: CreateMenuDto, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new BadRequestException('User context missing');
    return this.service.create(body, u);
  }

  // Upload foto menu (bisa banyak). Return path; frontend menyertakannya di payload create/update.
  @Post('upload-photos')
  @UseInterceptors(FilesInterceptor('images', 8, { storage: photoStorage, fileFilter: photoFilter, limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadPhotos(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('Minimal 1 foto');
    await Promise.all(files.map((f) => compressImage(f.path).catch(() => {})));
    return { urls: files.map((f) => `/uploads/${f.filename}`) };
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: CreateMenuDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
