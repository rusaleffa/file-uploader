import { runTilerWorker, type Decoder } from './base.worker';
import type { TilerOptions } from '../protocol';

class ImageDecoderDecoder implements Decoder {
    readonly name = 'imagedecoder';

    private bitmap: ImageBitmap | null = null;
    private currentDecoder: ImageDecoder | null = null;

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
        if (typeof ImageDecoder === 'undefined') {
            throw new Error('ImageDecoder (WebCodecs) не поддерживается в этом браузере');
        }

        const buffer = await file.arrayBuffer();

        const decoder = new ImageDecoder({
            data: buffer,
            type: file.type || 'image/jpeg',
        });
        this.currentDecoder = decoder;

        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        if (!track) throw new Error('ImageDecoder не вернул трек');

        const decodeOptions: ImageDecodeOptions = {
            completeFramesOnly: true,
            ...(options.maxWidth !== null ? { desiredWidth: options.maxWidth } : {}),
        };
        const result = await decoder.decode(decodeOptions);

        const frame = result.image;
        const originalWidth = frame.codedWidth;
        const originalHeight = frame.codedHeight;
        const decodedWidth = frame.displayWidth;
        const decodedHeight = frame.displayHeight;

        const canvas = new OffscreenCanvas(decodedWidth, decodedHeight);
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) throw new Error('Не удалось получить 2d-контекст');

        ctx2d.drawImage(frame, 0, 0);
        frame.close();

        const bitmap = await createImageBitmap(canvas);
        this.bitmap = bitmap;

        return {
            bitmap,
            originalWidth,
            originalHeight,
            decodedWidth,
            decodedHeight,
        };
    }

    dispose(): void {
        this.bitmap?.close();
        this.bitmap = null;
        this.currentDecoder?.close();
        this.currentDecoder = null;
    }
}

runTilerWorker(() => new ImageDecoderDecoder());