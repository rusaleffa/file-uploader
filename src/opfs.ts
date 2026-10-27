/**
 * Обёртка над Origin Private File System.
 *
 * OPFS позволяет писать и читать большие файлы потоково,
 * не поднимая их целиком в RAM.
 */

const TILES_DIR = 'tiles';

let rootPromise: Promise<FileSystemDirectoryHandle> | null = null;

function getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!rootPromise) {
        rootPromise = navigator.storage.getDirectory();
    }
    return rootPromise;
}

async function getTilesDir(create: boolean): Promise<FileSystemDirectoryHandle> {
    const root = await getRoot();
    return root.getDirectoryHandle(TILES_DIR, { create });
}

export async function writeTile(name: string, blob: Blob): Promise<void> {
    const dir = await getTilesDir(true);
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

export async function readTile(name: string): Promise<File> {
    const dir = await getTilesDir(false);
    const fileHandle = await dir.getFileHandle(name);
    return await fileHandle.getFile();
}

export async function clearTiles(): Promise<void> {
    const root = await getRoot();
    try {
        await root.removeEntry(TILES_DIR, { recursive: true });
    } catch {
    }
}

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
    if (navigator.storage?.estimate) {
        return await navigator.storage.estimate();
    }
    return null;
}