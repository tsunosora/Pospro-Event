import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifEvent {
    type: 'transaction' | 'stock' | 'shift' | 'update' | 'system';
    title: string;
    message: string;
}

// Batas aman panjang 1 pesan Discord (limit resmi 2000 char).
const DISCORD_MAX = 1990;

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private subject = new Subject<NotifEvent>();

    constructor(private readonly prisma: PrismaService) { }

    emit(event: NotifEvent) {
        this.subject.next(event);
    }

    /** Ambil URL webhook Discord aktif dari StoreSettings (null jika belum diatur). */
    private async getDiscordUrl(): Promise<string | null> {
        const settings = await this.prisma.storeSettings.findFirst();
        return (settings as any)?.discordWebhookUrl || null;
    }

    /**
     * Helper ringkas: kirim teks ke webhook Discord toko (otomatis ambil URL).
     * No-op diam jika webhook belum diatur. Aman dipanggil "fire-and-forget".
     */
    async notifyDiscord(content: string) {
        const url = await this.getDiscordUrl();
        if (!url) return;
        await this.sendToDiscord(url, content);
    }

    /** Helper ringkas: kirim teks + lampiran gambar ke webhook Discord toko. */
    async notifyDiscordWithImages(content: string, imagePaths: string[] = []) {
        const url = await this.getDiscordUrl();
        if (!url) return;
        await this.sendToDiscordWithImages(url, content, imagePaths);
    }

    getObservable(): Observable<MessageEvent> {
        const events$ = this.subject.pipe(
            map(event => ({ data: event } as MessageEvent))
        );
        const heartbeat$ = interval(25000).pipe(
            map(() => ({ data: { type: 'ping' } } as unknown as MessageEvent))
        );
        return merge(events$, heartbeat$);
    }

    /**
     * Kirim pesan teks ke Discord webhook.
     * Otomatis dipecah jika melebihi limit 2000 char (mis. laporan shift lengkap).
     */
    async sendToDiscord(webhookUrl: string, content: string) {
        if (!webhookUrl || !content) return;
        for (const part of this.chunk(content, DISCORD_MAX)) {
            try {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: part }),
                });
            } catch {
                // Jangan crash jika Discord down — hentikan sisa chunk
                break;
            }
        }
    }

    /**
     * Kirim pesan + lampiran gambar (maks 10) ke Discord via multipart.
     * imagePaths: path relatif terhadap cwd backend
     * (mis. `public/uploads/so-proofs/xxx.jpg` atau `uploads/proofs/xxx.jpg`).
     */
    async sendToDiscordWithImages(webhookUrl: string, content: string, imagePaths: string[] = []) {
        if (!webhookUrl) return;
        const paths = (imagePaths || []).filter(Boolean).slice(0, 10);
        if (paths.length === 0) {
            return this.sendToDiscord(webhookUrl, content);
        }

        const parts = this.chunk(content || '', DISCORD_MAX);
        const first = parts.shift() || '';
        try {
            const form = new FormData();
            form.append('payload_json', JSON.stringify({ content: first }));
            let attached = 0;
            for (const rel of paths) {
                try {
                    const buf = await readFile(join(process.cwd(), rel));
                    form.append(`files[${attached}]`, new Blob([buf]), basename(rel));
                    attached++;
                } catch {
                    // File hilang → skip, jangan gagalkan seluruh pesan
                }
            }
            await fetch(webhookUrl, { method: 'POST', body: form });
            // Sisa teks (jika pesan panjang) dikirim menyusul sebagai teks biasa
            for (const part of parts) {
                await this.sendToDiscord(webhookUrl, part);
            }
        } catch (err) {
            this.logger.warn(`Gagal kirim gambar ke Discord, fallback teks: ${err}`);
            await this.sendToDiscord(webhookUrl, content);
        }
    }

    /** Pecah teks menjadi beberapa bagian <= max, menjaga batas baris bila memungkinkan. */
    private chunk(text: string, max: number): string[] {
        if (text.length <= max) return [text];
        const out: string[] = [];
        let cur = '';
        for (const line of text.split('\n')) {
            if (line.length > max) {
                // Baris tunggal super panjang → potong keras
                if (cur) { out.push(cur); cur = ''; }
                for (let i = 0; i < line.length; i += max) out.push(line.slice(i, i + max));
                continue;
            }
            if (cur && (cur.length + 1 + line.length) > max) {
                out.push(cur);
                cur = line;
            } else {
                cur = cur ? cur + '\n' + line : line;
            }
        }
        if (cur) out.push(cur);
        return out;
    }
}
