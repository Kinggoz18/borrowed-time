/** Key-value storage behind one interface. Every call is safe: storage problems never throw. */
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  del(key: string): Promise<void>;
  readonly kind: string;
}

export class MemoryKV implements KV {
  readonly kind = "memory";
  private m = new Map<string, string>();
  async get(k: string) {
    return this.m.get(k) ?? null;
  }
  async set(k: string, v: string) {
    this.m.set(k, v);
    return true;
  }
  async del(k: string) {
    this.m.delete(k);
  }
}

export class LocalKV implements KV {
  readonly kind = "local";
  constructor(private ls: Storage) {}
  async get(k: string) {
    try {
      return this.ls.getItem(k);
    } catch {
      return null;
    }
  }
  async set(k: string, v: string) {
    try {
      this.ls.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  }
  async del(k: string) {
    try {
      this.ls.removeItem(k);
    } catch {
      /* blocked storage: nothing to delete */
    }
  }
}

/** Capacitor Preferences on device (survives WebView storage clears), localStorage on the web, memory as the last resort. */
export async function createStorage(): Promise<KV> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import("@capacitor/preferences");
      return {
        kind: "preferences",
        async get(key) {
          try {
            return (await Preferences.get({ key })).value;
          } catch {
            return null;
          }
        },
        async set(key, value) {
          try {
            await Preferences.set({ key, value });
            return true;
          } catch {
            return false;
          }
        },
        async del(key) {
          try {
            await Preferences.remove({ key });
          } catch {
            /* ignore */
          }
        },
      };
    }
  } catch {
    /* not native */
  }
  try {
    const ls = window.localStorage;
    const probe = "bt.probe";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return new LocalKV(ls);
  } catch {
    return new MemoryKV();
  }
}
