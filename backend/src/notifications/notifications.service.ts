import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface NotifEvent {
    type: 'transaction' | 'stock' | 'shift' | 'update' | 'system';
    title: string;
    message: string;
}

@Injectable()
export class NotificationsService {
    private subject = new Subject<NotifEvent>();

    emit(event: NotifEvent) {
        this.subject.next(event);
    }

    getObservable(): Observable<MessageEvent> {
        return this.subject.pipe(
            map(event => ({ data: event } as MessageEvent))
        );
    }

    async sendToDiscord(webhookUrl: string, content: string) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
        } catch {
            // Jangan crash jika Discord down
        }
    }
}
