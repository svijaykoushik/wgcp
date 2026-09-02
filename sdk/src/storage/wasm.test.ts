import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createWasmStorageBridge,
  installWasmBridge,
  uint8ArrayToBase64,
  base64ToUint8Array,
  WasmFileTree,
  StorageProvider
} from "./wasm.js";

// Helper to create a mock Emscripten FS
function createMockFS() {
  interface Node {
    isDir: boolean;
    data?: Uint8Array;
    mode: number;
    mtime: Date;
    children?: Map<string, Node>;
  }

  const root: Node = {
    isDir: true,
    mode: 0o040755,
    mtime: new Date(),
    children: new Map()
  };

  function getNode(path: string): Node | null {
    const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
    let current = root;
    for (const part of parts) {
      if (!current.isDir || !current.children) return null;
      const next = current.children.get(part);
      if (!next) return null;
      current = next;
    }
    return current;
  }

  function getOrCreateDir(path: string): Node {
    const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
    let current = root;
    for (const part of parts) {
      if (!current.children) current.children = new Map();
      let next = current.children.get(part);
      if (!next) {
        next = { isDir: true, mode: 0o040755, mtime: new Date(), children: new Map() };
        current.children.set(part, next);
      }
      current = next;
    }
    return current;
  }

  const fs = {
    syncfsCalls: [] as { populate: boolean }[],
    stat(path: string) {
      const node = getNode(path);
      if (!node) throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
      return {
        mode: node.mode,
        size: node.data ? node.data.byteLength : 4096,
        mtime: node.mtime
      };
    },
    isDir(mode: number) {
      return (mode & 0o170000) === 0o040000;
    },
    isFile(mode: number) {
      return (mode & 0o170000) === 0o100000;
    },
    analyzePath(path: string) {
      const node = getNode(path);
      return {
        exists: node !== null,
        isRoot: path === "/",
        error: node ? 0 : 2,
        name: path.split("/").pop() || "",
        path,
        object: node
      };
    },
    mkdir(path: string) {
      const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
      const dirName = parts.pop();
      if (!dirName) return;
      const parentPath = "/" + parts.join("/");
      const parent = getNode(parentPath);
      if (!parent || !parent.isDir || !parent.children) {
        throw new Error(`ENOENT: cannot create directory '${path}'`);
      }
      if (parent.children.has(dirName)) {
        throw new Error(`EEXIST: directory already exists '${path}'`);
      }
      parent.children.set(dirName, { isDir: true, mode: 0o040755, mtime: new Date(), children: new Map() });
    },
    mkdirTree(path: string) {
      getOrCreateDir(path);
    },
    readdir(path: string): string[] {
      const node = getNode(path);
      if (!node || !node.isDir || !node.children) throw new Error(`ENOTDIR: not a directory '${path}'`);
      return [".", "..", ...Array.from(node.children.keys())];
    },
    readFile(path: string, options?: { encoding?: string }) {
      const node = getNode(path);
      if (!node || node.isDir || !node.data) throw new Error(`ENOENT: no such file '${path}'`);
      if (options?.encoding === "utf8") {
        return new TextDecoder().decode(node.data);
      }
      return new Uint8Array(node.data);
    },
    writeFile(path: string, data: Uint8Array | string) {
      const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
      const filename = parts.pop();
      if (!filename) throw new Error("Invalid path");
      const parentPath = "/" + parts.join("/");
      const parent = getOrCreateDir(parentPath);
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
      parent.children!.set(filename, {
        isDir: false,
        mode: 0o100644,
        mtime: new Date(),
        data: new Uint8Array(bytes)
      });
    },
    syncfs(populate: boolean | ((err?: any) => void), callback?: (err?: any) => void) {
      let isPopulate = false;
      let cb: ((err?: any) => void) | undefined = callback;
      if (typeof populate === "function") {
        cb = populate;
        isPopulate = false;
      } else {
        isPopulate = Boolean(populate);
      }
      fs.syncfsCalls.push({ populate: isPopulate });
      if (cb) cb(null);
    }
  };

  return fs;
}

function createMockStorage(): StorageProvider & { saves: Map<string, string> } {
  const saves = new Map<string, string>();
  return {
    saves,
    save: vi.fn(async (slot: string, data: any) => {
      saves.set(slot, typeof data === "string" ? data : JSON.stringify(data));
    }),
    load: vi.fn(async (slot: string) => {
      return saves.get(slot) || null;
    })
  };
}

describe("WASM & Emscripten Storage Bridge", () => {
  describe("Base64 & Binary Encodings", () => {
    it("should round-trip binary Uint8Array buffers accurately", () => {
      const original = new Uint8Array([0, 1, 2, 255, 128, 42, 99, 13, 10]);
      const base64 = uint8ArrayToBase64(original);
      const restored = base64ToUint8Array(base64);
      expect(restored).toEqual(original);
    });

    it("should handle empty buffers", () => {
      const empty = new Uint8Array(0);
      const base64 = uint8ArrayToBase64(empty);
      expect(base64).toBe("");
      expect(base64ToUint8Array(base64)).toEqual(empty);
    });
  });

  describe("VFS Extraction and Restoration", () => {
    it("should extract recursive files into a WasmFileTree", () => {
      const fs = createMockFS();
      const mount = "/home/web_user/.local/share/supertux2";
      fs.writeFile(`${mount}/config`, '(supertux-config (sound #t))');
      fs.writeFile(`${mount}/profile1/slot1.stsg`, new Uint8Array([10, 20, 30, 40]));

      const storage = createMockStorage();
      const bridge = createWasmStorageBridge({
        mountPath: mount,
        fs,
        storage
      });

      const extracted = bridge.extractFiles();
      expect(Object.keys(extracted)).toContain("config");
      expect(Object.keys(extracted)).toContain("profile1/slot1.stsg");

      const configBytes = base64ToUint8Array(extracted["config"].data);
      expect(new TextDecoder().decode(configBytes)).toBe('(supertux-config (sound #t))');

      const saveBytes = base64ToUint8Array(extracted["profile1/slot1.stsg"].data);
      expect(saveBytes).toEqual(new Uint8Array([10, 20, 30, 40]));
    });

    it("should restore files into a fresh VFS", () => {
      const fs = createMockFS();
      const mount = "/home/web_user/.local/share/supertux2";
      const storage = createMockStorage();
      const bridge = createWasmStorageBridge({
        mountPath: mount,
        fs,
        storage
      });

      const files: WasmFileTree = {
        "config": {
          data: uint8ArrayToBase64(new TextEncoder().encode("volume 0.8")),
          mode: 0o100644,
          timestamp: 123456789
        },
        "profiles/save1.dat": {
          data: uint8ArrayToBase64(new Uint8Array([1, 2, 3])),
          mode: 0o100644,
          timestamp: 123456789
        }
      };

      bridge.restoreFiles(files);

      expect(fs.analyzePath(`${mount}/config`).exists).toBe(true);
      expect(fs.readFile(`${mount}/config`, { encoding: "utf8" })).toBe("volume 0.8");

      expect(fs.analyzePath(`${mount}/profiles/save1.dat`).exists).toBe(true);
      expect(fs.readFile(`${mount}/profiles/save1.dat`)).toEqual(new Uint8Array([1, 2, 3]));
    });
  });

  describe("FS.syncfs Interception & Cloud Synchronization", () => {
    let fs: ReturnType<typeof createMockFS>;
    let storage: ReturnType<typeof createMockStorage>;
    const mount = "/home/web_user/.local/share/supertux2";

    beforeEach(() => {
      fs = createMockFS();
      storage = createMockStorage();
    });

    it("should intercept FS.syncfs(false) and save changed state to storage", async () => {
      const onSyncSuccess = vi.fn();
      const bridge = installWasmBridge({
        mountPath: mount,
        fs,
        storage,
        debounceMs: 0,
        onSyncSuccess
      });

      fs.writeFile(`${mount}/config`, "test config");

      await new Promise<void>((resolve, reject) => {
        fs.syncfs(false, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Allow microtasks to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(storage.save).toHaveBeenCalledTimes(1);
      expect(onSyncSuccess).toHaveBeenCalledTimes(1);

      const savedJson = storage.saves.get("gameState");
      expect(savedJson).toBeDefined();
      const parsed = JSON.parse(savedJson!);
      expect(parsed.version).toBe(1);
      expect(parsed.mountPath).toBe(mount);
      expect(parsed.files["config"]).toBeDefined();
    });

    it("should gate redundant cloud writes if files have not changed", async () => {
      const bridge = installWasmBridge({
        mountPath: mount,
        fs,
        storage,
        debounceMs: 0
      });

      fs.writeFile(`${mount}/config`, "constant config");

      // First syncfs call
      await new Promise<void>((resolve) => fs.syncfs(false, () => resolve()));
      await new Promise((r) => setTimeout(r, 10));
      expect(storage.save).toHaveBeenCalledTimes(1);

      // Second syncfs call with NO changes
      await new Promise<void>((resolve) => fs.syncfs(false, () => resolve()));
      await new Promise((r) => setTimeout(r, 10));

      // Should still be 1 call!
      expect(storage.save).toHaveBeenCalledTimes(1);

      // Third syncfs call after updating a file
      fs.writeFile(`${mount}/config`, "new config modification");
      await new Promise<void>((resolve) => fs.syncfs(false, () => resolve()));
      await new Promise((r) => setTimeout(r, 10));

      expect(storage.save).toHaveBeenCalledTimes(2);
    });

    it("should hydrate empty local VFS from cloud on FS.syncfs(true)", async () => {
      // Preload storage with cloud state
      const preloadedPayload = {
        version: 1,
        mountPath: mount,
        files: {
          "level1.sav": {
            data: uint8ArrayToBase64(new Uint8Array([42, 99])),
            mode: 0o100644,
            timestamp: Date.now()
          }
        },
        savedAt: Date.now()
      };
      storage.saves.set("gameState", JSON.stringify(preloadedPayload));

      installWasmBridge({
        mountPath: mount,
        fs,
        storage,
        debounceMs: 0
      });

      // Initially VFS is empty
      expect(fs.analyzePath(`${mount}/level1.sav`).exists).toBe(false);

      // Trigger syncfs(true) (populate from storage)
      await new Promise<void>((resolve, reject) => {
        fs.syncfs(true, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // VFS should now have level1.sav hydrated from cloud
      expect(fs.analyzePath(`${mount}/level1.sav`).exists).toBe(true);
      expect(fs.readFile(`${mount}/level1.sav`)).toEqual(new Uint8Array([42, 99]));
    });

    it("should debounce rapid syncfs calls", async () => {
      const bridge = installWasmBridge({
        mountPath: mount,
        fs,
        storage,
        debounceMs: 50
      });

      fs.writeFile(`${mount}/data`, "version 1");
      fs.syncfs(false, () => {});

      fs.writeFile(`${mount}/data`, "version 2");
      fs.syncfs(false, () => {});

      fs.writeFile(`${mount}/data`, "version 3");
      fs.syncfs(false, () => {});

      expect(storage.save).toHaveBeenCalledTimes(0);

      // Wait for debounce window
      await new Promise((r) => setTimeout(r, 100));

      expect(storage.save).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(storage.saves.get("gameState")!);
      const fileBytes = base64ToUint8Array(parsed.files["data"].data);
      expect(new TextDecoder().decode(fileBytes)).toBe("version 3");
    });

    it("should restore original FS.syncfs upon detach()", () => {
      const originalSync = fs.syncfs;
      const bridge = installWasmBridge({
        mountPath: mount,
        fs,
        storage
      });

      expect(fs.syncfs).not.toBe(originalSync);
      bridge.detach();
      expect(fs.syncfs).toBe(originalSync);
    });
  });

  describe("IDBFS Interception", () => {
    it("should intercept IDBFS.syncfs if provided", async () => {
      const fs = createMockFS();
      const storage = createMockStorage();
      const mount = "/home/web_user/.local/share/supertux2";

      let idbfsCalled = false;
      const idbfs = {
        syncfs: vi.fn((mountObj: any, populate: boolean, cb: (err?: any) => void) => {
          idbfsCalled = true;
          cb(null);
        })
      };

      const bridge = installWasmBridge({
        mountPath: mount,
        fs,
        idbfs,
        storage,
        debounceMs: 0
      });

      fs.writeFile(`${mount}/idbfs_test`, "hello idbfs");

      await new Promise<void>((resolve) => {
        idbfs.syncfs({ mountpoint: mount }, false, () => resolve());
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(idbfsCalled).toBe(true);
      expect(storage.save).toHaveBeenCalledTimes(1);
    });
  });
});
