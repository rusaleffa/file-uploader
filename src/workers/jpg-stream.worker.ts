import { runTilerWorker, type Decoder } from './base.worker';
import type { TilerOptions } from '../protocol';
import JPEGDecoder from '@stealthybox/jpg-stream/decoder';

class JpgStreamDecoder implements Decoder {
    readonly name = 'jpg-stream';

    private bitmap: ImageBitmap | null = null;

    async decode(
        file: File,
        options: TilerOptions,
    ): Promise<{
        bitmap: ImageBitmap;
        originalWidth: number;
        originalHeight: number;
        decodedWidth: number;
        decodedHeight: number;
    }> {
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        const decoder = new JPEGDecoder(
            options.maxWidth !== null ? { width: options.maxWidth } : {}
        );

        let originalWidth = 0;
        let originalHeight = 0;

        const result = await new Promise<{
            width: number;
            height: number;
            pixels: Uint8Array;
        }>((resolve, reject) => {
            let lastFrame: { width: number; height: number; pixels: Uint8Array } | null = null;

            decoder.on('meta', (meta: { width: number; height: number }) => {
                originalWidth = meta.width;
                originalHeight = meta.height;
            });

            decoder.on('data', (frame: { width: number; height: number; pixels: Uint8Array }) => {
                lastFrame = frame;
            });

            decoder.on('end', () => {
                if (!lastFrame) {
                    reject(new Error('jpg-stream не вернул ни одного кадра'));
                    return;
                }
                resolve(lastFrame);
            });

            decoder.on('error', (err: Error) => reject(err));

            decoder.end(uint8);
        });

        const clamped = new Uint8ClampedArray(result.pixels.byteLength);
        clamped.set(result.pixels);

        const imageData = new ImageData(clamped, result.width, result.height);

        const bitmap = await createImageBitmap(imageData);
        this.bitmap = bitmap;

        return {
            bitmap,
            originalWidth: originalWidth || result.width,
            originalHeight: originalHeight || result.height,
            decodedWidth: result.width,
            decodedHeight: result.height,
        };
    }

    dispose(): void {
        this.bitmap?.close();
        this.bitmap = null;
    }
}

runTilerWorker(() => new JpgStreamDecoder());