import { writeTile, clearTiles } from '../opfs';
import type { TilerCommand, TilerEvent, TilerOptions } from '../protocol';

export interface Decoder {
    readonly name: string;

    decode(
        file: File,
        options: TilerOptions,
    ): Promise<{
        bitmap: ImageBitmap;
        originalWidth: number;
        originalHeight: number;
        decodedWidth: number;
        decodedHeight: number;
    }>;

    dispose(): void;
}

export type DecoderFactory = () => Decoder;

function extFromFormat(format: TilerOptions['format']): string {
    if (format === 'image/jpeg') return 'jpg';
    if (format === 'image/png') return 'png';
    return 'webp';
}

export function runTilerWorker(factory: DecoderFactory): void {
    const ctx = self as unknown as DedicatedWorkerGlobalScope;

    let cancelled = false;

    function post(event: TilerEvent): void {
        ctx.postMessage(event);
    }

    function toError(err: unknown): Error {
        return err instanceof Error ? err : new Error(String(err));
    }

    ctx.onmessage = async (e: MessageEvent<TilerCommand>): Promise<void> => {
        const cmd = e.data;

        if (cmd.type === 'cancel') {
            cancelled = true;
            return;
        }

        if (cmd.type !== 'start') return;

        cancelled = false;

        const { file, options } = cmd;
        const decoder = factory();
        const ext = extFromFormat(options.format);

        try {
            await clearTiles();

            const {
                bitmap,
                originalWidth,
                originalHeight,
                decodedWidth,
                decodedHeight,
            } = await decoder.decode(file, options);

            const { tileSize } = options;
            const cols = Math.ceil(decodedWidth / tileSize);
            const rows = Math.ceil(decodedHeight / tileSize);
            const total = cols * rows;

            post({
                type: 'meta',
                width: originalWidth,
                height: originalHeight,
                decodedWidth,
                decodedHeight,
                cols,
                rows,
                tileSize,
                decoder: decoder.name,
            });

            let done = 0;
            let written = 0;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (cancelled) {
                        bitmap.close();
                        decoder.dispose();
                        return;
                    }

                    const sx = c * tileSize;
                    const sy = r * tileSize;
                    const sw = Math.min(tileSize, decodedWidth - sx);
                    const sh = Math.min(tileSize, decodedHeight - sy);

                    const canvas = new OffscreenCanvas(sw, sh);
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('Не удалось получить 2d-контекст');

                    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

                    const blob = await canvas.convertToBlob({
                        type: options.format,
                        quality: options.quality,
                    });

                    await writeTile(`t_${c}_${r}.${ext}`, blob);
                    written++;
                    done++;

                    if (done % 4 === 0 || done === total) {
                        post({ type: 'progress', done, total });
                    }
                }
            }

            bitmap.close();
            decoder.dispose();

            post({ type: 'done', written });
        } catch (err) {
            const error = toError(err);
            try {
                decoder.dispose();
            } catch {
            }
            post({
                type: 'error',
                message: error.message,
                ...(error.stack !== undefined ? { details: error.stack } : {}),
            });
        }
    };
}