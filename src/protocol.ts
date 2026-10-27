/**
 * Единый протокол общения main <-> воркер-декодер.
 *
 * Все воркеры принимают одни и те же команды и отдают одни и те же события.
 * Main не знает, какой именно воркер под капотом.
 */


export interface TilerOptions {
    /** Размер тайла в пикселях. */
    tileSize: number;
    /** Формат выходных тайлов. */
    format: 'image/webp' | 'image/jpeg' | 'image/png';
    /** Качество сжатия 0..1. Для PNG игнорируется. */
    quality: number;
    /**
     * Максимальная ширина, до которой разрешено уменьшить исходник.
     * null  не уменьшать.
     *
     * canvas-декодер игнорирует (createImageBitmap не умеет scaling at decode).
     * jpg-stream и imagedecoder используют для экономии памяти.
     */
    maxWidth: number | null;
}

export type TilerCommand =
    | { type: 'start'; file: File; options: TilerOptions }
    | { type: 'cancel' };

// ────────────────────────────────────────────────────────────
// События (worker → main)
// ────────────────────────────────────────────────────────────

export interface MetaEvent {
    type: 'meta';
    /** Оригинальная ширина исходника. */
    width: number;
    /** Оригинальная высота исходника. */
    height: number;
    /** Ширина, с которой реально работал декодер. */
    decodedWidth: number;
    /** Высота, с которой реально работал декодер. */
    decodedHeight: number;
    /** Кол-во колонок тайлов. */
    cols: number;
    /** Кол-во строк тайлов. */
    rows: number;
    /** Размер одного тайла. */
    tileSize: number;
    /** Имя декодера  для отладки и UI. */
    decoder: string;
}

export interface ProgressEvent {
    type: 'progress';
    done: number;
    total: number;
}

export interface DoneEvent {
    type: 'done';
    /** Сколько тайлов реально записано. */
    written: number;
}

export interface ErrorEvent {
    type: 'error';
    message: string;
    details?: string;
}

export type TilerEvent = MetaEvent | ProgressEvent | DoneEvent | ErrorEvent;

// ────────────────────────────────────────────────────────────
// Реестр декодеров
// ────────────────────────────────────────────────────────────

export type DecoderName = 'canvas' | 'jpg-stream' | 'imagedecoder';

export interface DecoderInfo {
    name: DecoderName;
    label: string;
    description: string;
    supportsScaling: boolean;
    safeMegapixels: number;
}

export const DECODERS: Record<DecoderName, DecoderInfo> = {
    canvas: {
        name: 'canvas',
        label: 'Canvas (createImageBitmap)',
        description: 'Универсальный, но декодирует целиком в память.',
        supportsScaling: false,
        safeMegapixels: 40,
    },
    'jpg-stream': {
        name: 'jpg-stream',
        label: 'jpg-stream (libjpeg)',
        description: 'JPEG-only. Умеет уменьшать при декодировании. Медленнее.',
        supportsScaling: true,
        safeMegapixels: 500,
    },
    imagedecoder: {
        name: 'imagedecoder',
        label: 'ImageDecoder (WebCodecs)',
        description: 'Прогрессивное декодирование. Требует HTTPS.',
        supportsScaling: true,
        safeMegapixels: 200,
    },
};