import { runTilerWorker, type Decoder } from './base.worker';
import type { TilerOptions } from '../protocol';

/**
 * Универсальный декодер через createImageBitmap.
 *
 * Плюсы: работает со всем, что понимает браузер; быстрый.
 * Минусы: декодирует ВЕСЬ битмап в память, scaling at decode не умеет.
 */
class CanvasDecoder implements Decoder {
    readonly name = 'canvas';

    private bitmap: ImageBitmap | null = null;

    async decode(
        file: File,
        _options: TilerOptions,
    ): Promise<{
        bitmap: ImageBitmap;
        originalWidth: number;
        originalHeight: number;
        decodedWidth: number;
        decodedHeight: number;
    }> {
        const bitmap = await createImageBitmap(file);
        this.bitmap = bitmap;

        return {
            bitmap,
            originalWidth: bitmap.width,
            originalHeight: bitmap.height,
            decodedWidth: bitmap.width,
            decodedHeight: bitmap.height,
        };
    }

    dispose(): void {
        this.bitmap?.close();
        this.bitmap = null;
    }
}

runTilerWorker(() => new CanvasDecoder());