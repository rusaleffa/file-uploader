import type { DecoderName, TilerCommand, TilerEvent, TilerOptions } from './protocol';

export class WorkerClient {
    private worker: Worker | null = null;
    private listeners = new Set<(event: TilerEvent) => void>();
    private errorListeners = new Set<(err: ErrorEvent) => void>();

    constructor(private decoderName: DecoderName) {}

    start(file: File, options: TilerOptions): Promise<{ written: number }> {
        this.terminate();

        const workerUrl = this.resolveWorkerUrl(this.decoderName);
        this.worker = new Worker(workerUrl, { type: 'module' });

        return new Promise((resolve, reject) => {
            this.worker!.onmessage = (e: MessageEvent<TilerEvent>) => {
                const event = e.data;

                for (const listener of this.listeners) {
                    listener(event);
                }

                if (event.type === 'done') {
                    resolve({ written: event.written });
                } else if (event.type === 'error') {
                    reject(new Error(event.message));
                }
            };

            this.worker!.onerror = (err) => {
                for (const listener of this.errorListeners) {
                    listener(err);
                }
                reject(new Error(err.message));
            };

            const cmd: TilerCommand = { type: 'start', file, options };
            this.worker!.postMessage(cmd);
        });
    }

    onEvent(listener: (event: TilerEvent) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    onError(listener: (err: ErrorEvent) => void): () => void {
        this.errorListeners.add(listener);
        return () => this.errorListeners.delete(listener);
    }

    cancel(): void {
        this.worker?.postMessage({ type: 'cancel' } satisfies TilerCommand);
    }

    terminate(): void {
        this.worker?.terminate();
        this.worker = null;
    }

    private resolveWorkerUrl(name: DecoderName): URL {
        switch (name) {
            case 'canvas':
                return new URL('./workers/canvas.worker.ts', import.meta.url);
            case 'jpg-stream':
                return new URL('./workers/jpg-stream.worker.ts', import.meta.url);
            case 'imagedecoder':
                return new URL('./workers/imagedecoder.worker.ts', import.meta.url);
        }
    }
}