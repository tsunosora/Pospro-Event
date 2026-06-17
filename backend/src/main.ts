import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Public read-only endpoints: allow any origin, no credentials needed
  app.use((req: any, res: any, next: any) => {
    const isPublic =
      req.path.startsWith('/products/public') ||
      req.path === '/settings/public';
    if (isPublic) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  // Enable CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];
  const isDev = process.env.NODE_ENV !== 'production';
  // Dev: izinkan localhost/127.0.0.1 di port apa pun (Next sering ganti port saat 3000 dipakai).
  const localhostRe = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // Tanpa origin (curl, same-origin, server-to-server) → izinkan
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (isDev && localhostRe.test(origin)) return cb(null, true);
      return cb(new Error(`Origin tidak diizinkan oleh CORS: ${origin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    // Content-Disposition harus di-expose supaya frontend bisa baca filename dari header
    // (default browser CORS sembunyikan header response selain whitelist).
    exposedHeaders: ['Content-Disposition'],
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
