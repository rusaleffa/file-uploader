/**
 * Метаданные изображения для вьюера.
 *
 * Здесь width/height  ОРИГИНАЛЬНЫЕ размеры, decodedWidth/decodedHeight 
 * размеры, с которыми работал декодер. Они могут отличаться (jpg-stream,
 * imagedecoder с maxWidth).
 */
export interface TileMeta {
    width: number;
    height: number;
    decodedWidth: number;
    decodedHeight: number;
    cols: number;
    rows: number;
    tileSize: number;
}

export interface ViewerOptions {
    viewport: HTMLElement;
    spacer: HTMLElement;
    tilesLayer: HTMLElement;
    getTileName: (col: number, row: number) => string;
}

export interface Viewer {
    setMeta(meta: TileMeta): void;
    refresh(): void;
}