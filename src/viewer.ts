import { readTile } from './opfs';
import type { TileMeta, Viewer, ViewerOptions } from './types';

interface TileRange {
    firstRow: number;
    lastRow: number;
    firstCol: number;
    lastCol: number;
}

export function createViewer(options: ViewerOptions): Viewer {
    const { viewport, spacer, tilesLayer, getTileName } = options;

    let meta: TileMeta | null = null;
    const mounted = new Map<string, HTMLImageElement>();

    let scaleX = 1;
    let scaleY = 1;

    function setMeta(next: TileMeta): void {
        meta = next;
        scaleX = next.decodedWidth > 0 ? next.width / next.decodedWidth : 1;
        scaleY = next.decodedHeight > 0 ? next.height / next.decodedHeight : 1;

        spacer.style.height = `${next.height}px`;
        spacer.style.width = `${next.width}px`;
        tilesLayer.style.width = `${next.width}px`;
        tilesLayer.style.height = `${next.height}px`;
    }

    function visibleTileRange(): TileRange | null {
        if (!meta) return null;

        const scrollTop = viewport.scrollTop;
        const scrollLeft = viewport.scrollLeft;
        const vh = viewport.clientHeight;
        const vw = viewport.clientWidth;

        const tileDispW = meta.tileSize * scaleX;
        const tileDispH = meta.tileSize * scaleY;

        const firstRow = Math.max(0, Math.floor(scrollTop / tileDispH) - 1);
        const lastRow = Math.min(meta.rows - 1, Math.ceil((scrollTop + vh) / tileDispH) + 1);
        const firstCol = Math.max(0, Math.floor(scrollLeft / tileDispW) - 1);
        const lastCol = Math.min(meta.cols - 1, Math.ceil((scrollLeft + vw) / tileDispW) + 1);

        return { firstRow, lastRow, firstCol, lastCol };
    }

    async function mountTile(col: number, row: number): Promise<void> {
        if (!meta) return;

        const key = `${col}_${row}`;
        if (mounted.has(key)) return;

        let file: File;
        try {
            file = await readTile(getTileName(col, row));
        } catch {
            return;
        }

        if (mounted.has(key)) return;

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.decoding = 'async';
        img.src = url;

        const sw = Math.min(meta.tileSize, meta.decodedWidth - col * meta.tileSize);
        const sh = Math.min(meta.tileSize, meta.decodedHeight - row * meta.tileSize);

        const dw = sw * scaleX;
        const dh = sh * scaleY;
        const dx = col * meta.tileSize * scaleX;
        const dy = row * meta.tileSize * scaleY;

        img.style.width = `${dw}px`;
        img.style.height = `${dh}px`;
        img.style.transform = `translate(${dx}px, ${dy}px)`;

        img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });

        tilesLayer.appendChild(img);
        mounted.set(key, img);
    }

    function unmountTile(key: string): void {
        const img = mounted.get(key);
        if (!img) return;
        img.remove();
        mounted.delete(key);
    }

    function refresh(): void {
        if (!meta) return;

        const range = visibleTileRange();
        if (!range) return;

        const { firstRow, lastRow, firstCol, lastCol } = range;

        for (const key of [...mounted.keys()]) {
            const [colStr, rowStr] = key.split('_');
            const col = Number(colStr);
            const row = Number(rowStr);
            if (col < firstCol || col > lastCol || row < firstRow || row > lastRow) {
                unmountTile(key);
            }
        }

        for (let r = firstRow; r <= lastRow; r++) {
            for (let c = firstCol; c <= lastCol; c++) {
                void mountTile(c, r);
            }
        }
    }

    let ticking = false;
    viewport.addEventListener(
        'scroll',
        () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                refresh();
            });
        },
        { passive: true },
    );

    window.addEventListener('resize', refresh);

    return { setMeta, refresh };
}