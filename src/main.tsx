import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { auth } from './lib/firebase';
import { initializeWorkflows } from './workflows';
import { initializeEventBus } from './events';
import { onAuthStateChanged } from 'firebase/auth';

// Polyfill Uint8Array.prototype.toHex for newer versions of pdfjs-dist
if (typeof (Uint8Array.prototype as any).toHex !== 'function') {
  (Uint8Array.prototype as any).toHex = function (this: Uint8Array): string {
    let hex = '';
    for (let i = 0; i < this.length; i++) {
      hex += this[i].toString(16).padStart(2, '0');
    }
    return hex;
  };
}

// Polyfill Map and WeakMap getOrInsertComputed and getOrInsert for pdfjs-dist and modern ECMAScript specifications
if (typeof (Map.prototype as any).getOrInsertComputed !== 'function') {
  (Map.prototype as any).getOrInsertComputed = function (key: any, callback: (key: any) => any): any {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callback(key);
    this.set(key, value);
    return value;
  };
}

if (typeof (Map.prototype as any).getOrInsert !== 'function') {
  (Map.prototype as any).getOrInsert = function (key: any, value: any): any {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, value);
    return value;
  };
}

if (typeof (WeakMap.prototype as any).getOrInsertComputed !== 'function') {
  (WeakMap.prototype as any).getOrInsertComputed = function (key: any, callback: (key: any) => any): any {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callback(key);
    this.set(key, value);
    return value;
  };
}

if (typeof (WeakMap.prototype as any).getOrInsert !== 'function') {
  (WeakMap.prototype as any).getOrInsert = function (key: any, value: any): any {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, value);
    return value;
  };
}

// Polyfill Math.sumPrecise for modern ECMAScript specifications
if (typeof (Math as any).sumPrecise !== 'function') {
  (Math as any).sumPrecise = function (iterable: any): number {
    if (iterable === null || iterable === undefined || typeof iterable[Symbol.iterator] !== 'function') {
      throw new TypeError('Math.sumPrecise: Argument must be an iterable');
    }

    let hasElements = false;
    let hasNaN = false;
    let hasPositiveInfinity = false;
    let hasNegativeInfinity = false;
    
    const values: number[] = [];
    for (const item of iterable) {
      if (typeof item !== 'number') {
        throw new TypeError('Math.sumPrecise: All elements must be numbers');
      }
      hasElements = true;
      if (Number.isNaN(item)) {
        hasNaN = true;
      } else if (item === Infinity) {
        hasPositiveInfinity = true;
      } else if (item === -Infinity) {
        hasNegativeInfinity = true;
      } else {
        values.push(item);
      }
    }

    if (!hasElements) {
      return -0;
    }

    if (hasNaN || (hasPositiveInfinity && hasNegativeInfinity)) {
      return NaN;
    }
    if (hasPositiveInfinity) {
      return Infinity;
    }
    if (hasNegativeInfinity) {
      return -Infinity;
    }

    let sum = -0;
    let c = 0;
    for (let i = 0; i < values.length; i++) {
      const x = values[i];
      if (i === 0) {
        sum = x;
        continue;
      }
      const t = sum + x;
      if (Math.abs(sum) >= Math.abs(x)) {
        c += (sum - t) + x;
      } else {
        c += (x - t) + sum;
      }
      sum = t;
    }

    return sum + c;
  };
}

let isInitialized = false;

onAuthStateChanged(auth, (user) => {
  if (user && !isInitialized) {
    console.log("[Runtime] User authenticated, initializing AI & workflows...");
    initializeWorkflows();
    initializeEventBus();
    isInitialized = true;
  }
});

const originalFetch = window.fetch;
Object.defineProperty(window, 'fetch', {
  configurable: true,
  writable: true,
  value: async (...args: any[]) => {
    const [resource] = args;
    if (typeof resource === 'string' && resource.startsWith('/api/')) {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        if (args[1]) {
          args[1].headers = {
            ...args[1].headers,
            Authorization: `Bearer ${token}`
          };
        } else {
          args[1] = { headers: { Authorization: `Bearer ${token}` } };
        }
      }
    }
    return originalFetch(args[0], args[1]);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
