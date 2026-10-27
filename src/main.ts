import { createViewer } from './viewer';
import { WorkerClient } from './worker-client';
import { DECODERS, type DecoderName, type TilerEvent, type TilerOptions } from './protocol';

function mustQuery<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) throw new Error(`Элемент не найден: ${selector}`);
    return el;
}

const fileInput = mustQuery<HTMLInputElement>('#file');
const decoderSelect = mustQuery<HTMLSelectElement>('#decoder');
const cancelBtn = mustQuery<HTMLButtonElement>('#cancel');
const statusEl = mustQuery<HTMLDivElement>('#status');
const progressEl = mustQuery<HTMLProgressElement>('#progress');
const viewport = mustQuery<HTMLElement>('#viewport');
const spacer = mustQuery<HTMLElement>('#spacer');
const tilesLayer = mustQuery<HTMLElement>('#tiles');
const decoderInfoEl = mustQuery<HTMLDivElement>('#decoder-info');

for (const info of Object.values(DECODERS)) {
    const option = document.createElement('option');
    option.value = info.name;
    option.textContent = info.label;
    option.title = info.description;
    decoderSelect.appendChild(option);
}

function updateDecoderInfo(): void {
    const name = decoderSelect.value as DecoderName;
    const info = DECODERS[name];
    decoderInfoEl.textContent = `${info.description} (безопасно до ~${info.safeMegapixels} МП)`;
}

decoderSelect.addEventListener('change', updateDecoderInfo);
updateDecoderInfo();

const TILE_FORMAT: TilerOptions['format'] = 'image/webp';

function extFromFormat(format: TilerOptions['format']): string {
    if (format === 'image/jpeg') return 'jpg';
    if (format === 'image/png') return 'png';
    return 'webp';
}

const TILE_EXT = extFromFormat(TILE_FORMAT);

const viewer = createViewer({
    viewport,
    spacer,
    tilesLayer,
    getTileName: (col, row) => `t_${col}_${row}.${TILE_EXT}`,
});

function setStatus(text: string): void {
    statusEl.textContent = text;
}

function buildOptions(decoderName: DecoderName): TilerOptions {
    const info = DECODERS[decoderName];
    return {
        tileSize: 1024,
        format: TILE_FORMAT,
        quality: 0.82,
        maxWidth: info.supportsScaling ? 4000 : null,
    };
}

let client: WorkerClient | null = null;
let unsubscribeEvent: (() => void) | null = null;
let unsubscribeError: (() => void) | null = null;

fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const decoderName = decoderSelect.value as DecoderName;

    unsubscribeEvent?.();
    unsubscribeError?.();
    client?.terminate();

    client = new WorkerClient(decoderName);

    const sizeGb = (file.size / 1024 / 1024 / 1024).toFixed(2);
    setStatus(`Файл: ${file.name}  ${sizeGb} ГБ. Декодер: ${decoderName}`);

    progressEl.hidden = false;
    progressEl.value = 0;
    cancelBtn.disabled = false;

    unsubscribeEvent = client.onEvent((event: TilerEvent) => {
        switch (event.type) {
            case 'meta':
                viewer.setMeta({
                    width: event.width,
                    height: event.height,
                    decodedWidth: event.decodedWidth,
                    decodedHeight: event.decodedHeight,
                    cols: event.cols,
                    rows: event.rows,
                    tileSize: event.tileSize,
                });
                setStatus(
                    `Декодер: ${event.decoder}. ${event.width}×${event.height} ` +
                    `(декодировано ${event.decodedWidth}×${event.decodedHeight}), ` +
                    `тайлов: ${event.cols * event.rows}`,
                );
                viewer.refresh();
                break;

            case 'progress':
                progressEl.value = (event.done / event.total) * 100;
                setStatus(`Нарезка: ${event.done} / ${event.total}`);
                break;

            case 'done':
                setStatus(`Готово. Записано тайлов: ${event.written}. Скролльте.`);
                progressEl.hidden = true;
                cancelBtn.disabled = true;
                viewer.refresh();
                break;
        }
    });

    unsubscribeError = client.onError((err) => {
        setStatus(`Ошибка воркера: ${err.message}`);
        progressEl.hidden = true;
        cancelBtn.disabled = true;
    });

    const options = buildOptions(decoderName);

    client.start(file, options).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(`Ошибка: ${message}`);
        progressEl.hidden = true;
        cancelBtn.disabled = true;
    });
});

cancelBtn.addEventListener('click', () => {
    client?.cancel();
    client?.terminate();
    client = null;
    unsubscribeEvent = null;
    unsubscribeError = null;
    setStatus('Отменено');
    progressEl.hidden = true;
    cancelBtn.disabled = true;
});