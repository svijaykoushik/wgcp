import { calculateChecksum } from "./checksum.js";

let defaultStorageProvider: StorageProvider | null = null;

export function setDefaultStorageProvider(provider: StorageProvider) {
  defaultStorageProvider = provider;
}

export function getDefaultStorageProvider(): StorageProvider {
  if (defaultStorageProvider) return defaultStorageProvider;
  if (typeof window !== "undefined" && (window as any).WGCP?.storage) {
    return (window as any).WGCP.storage;
  }
  throw new Error("[WGCP WASM] No storage provider configured. Provide options.storage or initialize WGCP SDK.");
}

export interface WasmFileEntry {
  data: string; // Base64-encoded binary file content
  mode?: number; // POSIX file permissions/mode
  timestamp?: number; // File modification timestamp in epoch ms
}

export type WasmFileTree = Record<string, WasmFileEntry>;

export interface WasmStoragePayload {
  version: 1;
  mountPath: string;
  files: WasmFileTree;
  savedAt: number;
}

export interface StorageProvider {
  save(slot: string, data: any, onSync?: (err?: any) => void): Promise<void>;
  load(slot: string): Promise<any>;
}

export interface WasmStorageOptions {
  mountPath: string; // e.g. '/home/web_user/.local/share/supertux2'
  slot?: string; // WGCP slot, defaults to 'gameState'
  fs?: any; // Emscripten FS object
  idbfs?: any; // Emscripten IDBFS object
  storage?: StorageProvider; // Storage provider, defaults to storageAPI
  autoSync?: boolean; // Automatically push to cloud on syncfs(false), default true
  debounceMs?: number; // Debounce delay in ms to throttle cloud saves, default 500ms
  onSyncSuccess?: () => void;
  onSyncError?: (err: any) => void;
}

export interface WasmStorageBridge {
  readonly options: Readonly<Required<WasmStorageOptions>>;
  attach(fs?: any, idbfs?: any): void;
  detach(): void;
  saveNow(): Promise<void>;
  restoreFromCloud(): Promise<boolean>;
  flush(): Promise<void>;
  extractFiles(): WasmFileTree;
  restoreFiles(files: WasmFileTree): void;
}

/**
 * Isomorphic base64 encoder for Uint8Array buffers
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Isomorphic base64 decoder to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pathExists(fs: any, path: string): boolean {
  if (typeof fs.analyzePath === "function") {
    const res = fs.analyzePath(path);
    return Boolean(res && res.exists);
  }
  try {
    fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(fs: any, path: string, stat?: any): boolean {
  const s = stat || fs.stat(path);
  if (typeof fs.isDir === "function") {
    return fs.isDir(s.mode);
  }
  return (s.mode & 0o170000) === 0o040000;
}

function isFile(fs: any, path: string, stat?: any): boolean {
  const s = stat || fs.stat(path);
  if (typeof fs.isFile === "function") {
    return fs.isFile(s.mode);
  }
  return (s.mode & 0o170000) === 0o100000;
}

function ensureDirectory(fs: any, path: string) {
  if (typeof fs.mkdirTree === "function") {
    try {
      fs.mkdirTree(path);
      return;
    } catch {
      // Fall through to manual creation
    }
  }
  const normalized = path.replace(/\/+/g, "/").replace(/\/$/, "");
  const parts = normalized.split("/").filter(Boolean);
  let current = path.startsWith("/") ? "" : ".";

  for (const part of parts) {
    current = `${current}/${part}`;
    if (!pathExists(fs, current)) {
      try {
        fs.mkdir(current);
      } catch {
        // Ignored if created concurrently
      }
    }
  }
}

function walkDirectory(fs: any, currentPath: string, rootPath: string, result: WasmFileTree) {
  if (!pathExists(fs, currentPath)) return;
  const stat = fs.stat(currentPath);

  if (isDirectory(fs, currentPath, stat)) {
    const entries: string[] = fs.readdir(currentPath);
    for (const entry of entries) {
      if (entry === "." || entry === "..") continue;
      const child = `${currentPath}/${entry}`.replace(/\/+/g, "/");
      walkDirectory(fs, child, rootPath, result);
    }
  } else if (isFile(fs, currentPath, stat)) {
    let relPath = currentPath.slice(rootPath.length);
    if (relPath.startsWith("/")) relPath = relPath.slice(1);
    
    const content = fs.readFile(currentPath, { encoding: "binary" });
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);

    result[relPath] = {
      data: uint8ArrayToBase64(bytes),
      mode: stat.mode,
      timestamp: stat.mtime ? new Date(stat.mtime).getTime() : Date.now()
    };
  }
}

/**
 * Creates an Emscripten IDBFS / FS storage synchronization bridge.
 */
export function createWasmStorageBridge(options: WasmStorageOptions): WasmStorageBridge {
  const resolvedOptions: Required<WasmStorageOptions> = {
    mountPath: options.mountPath.replace(/\/+$/, ""),
    slot: options.slot || "gameState",
    fs: options.fs || null,
    idbfs: options.idbfs || null,
    storage: (options.storage || defaultStorageProvider || (typeof window !== "undefined" ? (window as any).WGCP?.storage : null)) as any,
    autoSync: options.autoSync !== false,
    debounceMs: options.debounceMs !== undefined ? options.debounceMs : 500,
    onSyncSuccess: options.onSyncSuccess || (() => {}),
    onSyncError: options.onSyncError || (() => {})
  };

  let targetFS: any = null;
  let targetIDBFS: any = null;
  let originalFSSyncfs: any = null;
  let originalIDBFSSync: any = null;

  let saveTimer: any = null;
  let inFlightSave: Promise<void> | null = null;
  let lastSavedFilesChecksum: string | null = null;

  function extractFiles(): WasmFileTree {
    const result: WasmFileTree = {};
    if (!targetFS || !pathExists(targetFS, resolvedOptions.mountPath)) {
      return result;
    }
    walkDirectory(targetFS, resolvedOptions.mountPath, resolvedOptions.mountPath, result);
    return result;
  }

  function restoreFiles(files: WasmFileTree) {
    if (!targetFS) return;
    ensureDirectory(targetFS, resolvedOptions.mountPath);

    for (const [relPath, fileEntry] of Object.entries(files)) {
      const fullPath = `${resolvedOptions.mountPath}/${relPath}`.replace(/\/+/g, "/");
      const lastSlash = fullPath.lastIndexOf("/");
      if (lastSlash > 0) {
        const parentDir = fullPath.slice(0, lastSlash);
        ensureDirectory(targetFS, parentDir);
      }
      const bytes = base64ToUint8Array(fileEntry.data);
      targetFS.writeFile(fullPath, bytes, { encoding: "binary" });
    }
  }

  function getStorage(): StorageProvider {
    return resolvedOptions.storage || getDefaultStorageProvider();
  }

  async function restoreFromCloud(): Promise<boolean> {
    const cloudData = await getStorage().load(resolvedOptions.slot);
    if (!cloudData) return false;

    let payload: WasmStoragePayload | null = null;
    if (typeof cloudData === "string") {
      try {
        payload = JSON.parse(cloudData);
      } catch {
        return false;
      }
    } else if (typeof cloudData === "object" && cloudData !== null) {
      payload = cloudData as WasmStoragePayload;
    }

    if (!payload || !payload.files) {
      return false;
    }

    restoreFiles(payload.files);
    
    // Seed lastSavedFilesChecksum so identical state is not immediately re-uploaded
    lastSavedFilesChecksum = await calculateChecksum(JSON.stringify(payload.files));
    return true;
  }

  async function saveNow(): Promise<void> {
    if (inFlightSave) {
      await inFlightSave;
    }

    const doSave = async () => {
      const files = extractFiles();
      if (Object.keys(files).length === 0) {
        return;
      }

      const filesChecksum = await calculateChecksum(JSON.stringify(files));
      if (filesChecksum === lastSavedFilesChecksum) {
        return;
      }

      const payload: WasmStoragePayload = {
        version: 1,
        mountPath: resolvedOptions.mountPath,
        files,
        savedAt: Date.now()
      };

      const serialized = JSON.stringify(payload);
      await getStorage().save(resolvedOptions.slot, serialized);
      lastSavedFilesChecksum = filesChecksum;
      resolvedOptions.onSyncSuccess();
    };

    inFlightSave = doSave()
      .catch((err) => {
        resolvedOptions.onSyncError(err);
        throw err;
      })
      .finally(() => {
        inFlightSave = null;
      });

    return inFlightSave;
  }

  function queueDebouncedSave(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (resolvedOptions.debounceMs <= 0) {
      return saveNow().catch(() => {});
    }

    return new Promise((resolve) => {
      saveTimer = setTimeout(() => {
        saveTimer = null;
        saveNow().then(resolve).catch(() => resolve());
      }, resolvedOptions.debounceMs);
    });
  }

  function attach(fsInstance?: any, idbfsInstance?: any) {
    // Resolve FS instance
    targetFS = fsInstance || resolvedOptions.fs;
    if (!targetFS && typeof window !== "undefined") {
      targetFS = (window as any).FS || (window as any).Module?.FS;
    }

    // Resolve IDBFS instance
    targetIDBFS = idbfsInstance || resolvedOptions.idbfs;
    if (!targetIDBFS) {
      if (targetFS?.filesystems?.IDBFS) {
        targetIDBFS = targetFS.filesystems.IDBFS;
      } else if (typeof window !== "undefined") {
        targetIDBFS = (window as any).IDBFS || (window as any).Module?.IDBFS;
      }
    }

    // Intercept FS.syncfs
    if (targetFS && typeof targetFS.syncfs === "function" && !targetFS.__wgcp_intercepted) {
      const original = targetFS.syncfs;
      originalFSSyncfs = original;

      targetFS.syncfs = function(populate: boolean | ((err?: any) => void), callback?: (err?: any) => void) {
        let isPopulate = false;
        let cb: ((err?: any) => void) | undefined = callback;

        if (typeof populate === "function") {
          cb = populate;
          isPopulate = false;
        } else {
          isPopulate = Boolean(populate);
        }

        if (isPopulate) {
          // Loading from physical to VFS
          original.call(targetFS, true, async (err: any) => {
            if (err) {
              if (cb) cb(err);
              return;
            }
            try {
              const currentFiles = extractFiles();
              if (Object.keys(currentFiles).length === 0) {
                await restoreFromCloud();
              }
            } catch (restoreErr) {
              console.warn("[WGCP WASM Bridge] Cloud hydration warning:", restoreErr);
            }
            if (cb) cb(null);
          });
        } else {
          // Saving from VFS to physical
          original.call(targetFS, false, (err: any) => {
            if (!err && resolvedOptions.autoSync) {
              queueDebouncedSave();
            }
            if (cb) cb(err);
          });
        }
      };
      targetFS.__wgcp_intercepted = true;
    }

    // Intercept IDBFS.syncfs
    if (targetIDBFS && typeof targetIDBFS.syncfs === "function" && !targetIDBFS.__wgcp_intercepted) {
      const originalIDB = targetIDBFS.syncfs;
      originalIDBFSSync = originalIDB;

      targetIDBFS.syncfs = function(mount: any, populate: boolean, callback: (err?: any) => void) {
        if (populate) {
          originalIDB.call(targetIDBFS, mount, populate, async (err: any) => {
            if (err) {
              if (callback) callback(err);
              return;
            }
            try {
              const currentFiles = extractFiles();
              if (Object.keys(currentFiles).length === 0) {
                await restoreFromCloud();
              }
            } catch (restoreErr) {
              console.warn("[WGCP WASM Bridge] IDBFS Cloud hydration warning:", restoreErr);
            }
            if (callback) callback(null);
          });
        } else {
          originalIDB.call(targetIDBFS, mount, populate, (err: any) => {
            if (!err && resolvedOptions.autoSync) {
              queueDebouncedSave();
            }
            if (callback) callback(err);
          });
        }
      };
      targetIDBFS.__wgcp_intercepted = true;
    }
  }

  function detach() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (targetFS && originalFSSyncfs) {
      targetFS.syncfs = originalFSSyncfs;
      delete targetFS.__wgcp_intercepted;
      originalFSSyncfs = null;
    }
    if (targetIDBFS && originalIDBFSSync) {
      targetIDBFS.syncfs = originalIDBFSSync;
      delete targetIDBFS.__wgcp_intercepted;
      originalIDBFSSync = null;
    }
  }

  async function flush(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      await saveNow();
    } else if (inFlightSave) {
      await inFlightSave;
    }
  }

  const bridge: WasmStorageBridge = {
    get options() {
      return resolvedOptions;
    },
    attach,
    detach,
    saveNow,
    restoreFromCloud,
    flush,
    extractFiles,
    restoreFiles
  };

  // Auto-attach if FS or IDBFS was provided
  if (resolvedOptions.fs || resolvedOptions.idbfs) {
    attach();
  }

  return bridge;
}

/**
 * Convenient helper to instantiate and immediately attach a WASM storage bridge.
 */
export function installWasmBridge(options: WasmStorageOptions): WasmStorageBridge {
  const bridge = createWasmStorageBridge(options);
  bridge.attach();
  return bridge;
}

export const wasmAPI = {
  createBridge: createWasmStorageBridge,
  install: installWasmBridge
};
