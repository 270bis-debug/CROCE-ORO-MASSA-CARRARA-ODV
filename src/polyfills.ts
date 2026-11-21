// Runtime polyfills per piena compatibilità con iPhone iOS Safari 15 / 16 / 17 / 18
// e browser mobili legacy (previene crash all'avvio o durante il rendering PDF).

// 1. Promise.withResolvers (ES2024 — mancante su iOS Safari < 17.4)
if (typeof Promise !== 'undefined' && typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T = unknown>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 2. URL.parse (ES2024 — mancante su iOS Safari < 18.0)
if (typeof URL !== 'undefined' && typeof (URL as any).parse !== 'function') {
  (URL as any).parse = function (url: string | URL, base?: string | URL): URL | null {
    try {
      return base !== undefined ? new URL(url, base) : new URL(url);
    } catch {
      return null;
    }
  };
}

// 3. Map.prototype.getOrInsert / getOrInsertComputed (ES2026 — mancante su iOS Safari 15-18, usato da pdfjs-dist v6)
if (typeof Map !== 'undefined') {
  const mapProto = Map.prototype as any;
  if (typeof mapProto.getOrInsert !== 'function') {
    mapProto.getOrInsert = function (key: unknown, defaultValue: unknown) {
      if (this.has(key)) return this.get(key);
      this.set(key, defaultValue);
      return defaultValue;
    };
  }
  if (typeof mapProto.getOrInsertComputed !== 'function') {
    mapProto.getOrInsertComputed = function (key: unknown, callbackfn: (k: unknown) => unknown) {
      if (this.has(key)) return this.get(key);
      const value = callbackfn(key);
      this.set(key, value);
      return value;
    };
  }
}

// 4. WeakMap.prototype.getOrInsert / getOrInsertComputed (ES2026)
if (typeof WeakMap !== 'undefined') {
  const weakMapProto = WeakMap.prototype as any;
  if (typeof weakMapProto.getOrInsert !== 'function') {
    weakMapProto.getOrInsert = function (key: object, defaultValue: unknown) {
      if (this.has(key)) return this.get(key);
      this.set(key, defaultValue);
      return defaultValue;
    };
  }
  if (typeof weakMapProto.getOrInsertComputed !== 'function') {
    weakMapProto.getOrInsertComputed = function (key: object, callbackfn: (k: object) => unknown) {
      if (this.has(key)) return this.get(key);
      const value = callbackfn(key);
      this.set(key, value);
      return value;
    };
  }
}

// 5. Object.hasOwn (ES2022 — mancante su iOS Safari < 15.4)
if (typeof Object.hasOwn !== 'function') {
  Object.hasOwn = function (obj: object, prop: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  };
}

// 6. Array.prototype.at (ES2022 — mancante su iOS Safari < 15.4)
if (typeof Array.prototype.at !== 'function') {
  Object.defineProperty(Array.prototype, 'at', {
    value: function (n: number) {
      const idx = Math.trunc(n) || 0;
      const k = idx < 0 ? this.length + idx : idx;
      if (k < 0 || k >= this.length) return undefined;
      return this[k];
    },
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

// 7. Array.prototype.findLast (ES2023 — mancante su iOS Safari < 15.4)
if (typeof (Array.prototype as any).findLast !== 'function') {
  Object.defineProperty(Array.prototype, 'findLast', {
    value: function (predicate: (value: unknown, index: number, arr: unknown[]) => unknown, thisArg?: unknown) {
      for (let i = this.length - 1; i >= 0; i--) {
        const val = this[i];
        if (predicate.call(thisArg, val, i, this)) return val;
      }
      return undefined;
    },
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

export {};
