// Polyfill Promise.try for third-party libraries (e.g., pdf-parse, pdfjs-dist)
if (typeof (Promise as any).try === 'undefined') {
  (Promise as any).try = function <T>(fn: (...args: any[]) => T | PromiseLike<T>, ...args: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        resolve(fn(...args));
      } catch (error) {
        reject(error);
      }
    });
  };
}

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

import { adminAuth } from '../src/lib/firebase-admin.js';

export default async function handler(req: any, res: any) {
  try {
    const { path } = req.query;
    const action = req.query.action || req.body?.action;

    console.log("=== API INDEX ENTRY ===");
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    console.log("Path query:", req.query?.path);

    // --- Authentication ---
    const urlStr = req.url || '';
    
    const isPublic = 
      urlStr.includes('/api/public') || 
      urlStr.includes('/api/public-candidate-resume') ||
      urlStr.includes('/api/workspace/gmail/webhook') || 
      path === 'public-candidate-resume' ||
      path?.startsWith('public');
      
    if (isPublic) {
      console.log("PUBLIC ROUTE BYPASS ACTIVATED");
    }

    if (path !== 'audit' && !urlStr.includes('/oauth/callback') && !urlStr.includes('/oauth/url') && !urlStr.includes('/api/oauth/url') && !isPublic) {
      const token = req.headers.authorization?.split('Bearer ')[1];
      if (!token) {
        console.log("AUTH MIDDLEWARE REJECTING - No token provided", { url: req.url, path });
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }
      if (adminAuth) {
         try {
            const decoded = await adminAuth.verifyIdToken(token);
            req.user = decoded;
         } catch (err: any) {
            console.error('Auth Error:', err); return res.status(401).json({ error: 'Unauthorized: Invalid token', details: err.message });
         }
      } else {
         req.user = { uid: 'dev-mode' };
      }
    }

    console.log({
        originalUrl: req.originalUrl,
        url: req.url,
        path,
        action
    });
    console.log("Matched API path:", path);

    let targetHandler: any;

    if (path === 'admin')            targetHandler = (await import('../src/api-lib/handlers/admin.js')).default;
    else if (path === 'client-candidate') targetHandler = (await import('../src/api-lib/handlers/client-candidate.js')).default;
    else if (path === 'client-submissions') targetHandler = (await import('../src/api-lib/handlers/client-submissions.js')).default;
    else if (path === 'repair-candidates') targetHandler = (await import('../src/api-lib/handlers/repair-candidates.js')).default;
    else if (path === 'validate-submission') targetHandler = (await import('../src/api-lib/handlers/validate-submission.js')).default;
    else if (path === 'parse-jd')          targetHandler = (await import('../src/api-lib/handlers/parse-jd.js')).default;
    else if (path === 'extract-text')      targetHandler = (await import('../src/api-lib/handlers/extract-text.js')).default;
    else if (path === 'public-candidate-resume' || path === 'public/candidate-resume') targetHandler = (await import('../src/api-lib/handlers/public-candidate-resume.js')).default;
    else if (path === 'match-detailed')    targetHandler = (await import('../src/api-lib/handlers/match-candidates-detailed.js')).default;
    else if (path === 'bulk-parse' || path === 'bulk-parse-resumes')        targetHandler = (await import('../src/api-lib/handlers/bulk-parse-resumes.js')).default;
    else if (path === 'interviews')        targetHandler = (await import('../src/api-lib/handlers/interviews.js')).default;
    else if (path === 'intel')             targetHandler = (await import('../src/api-lib/handlers/intel.js')).default;
    else if (path === 'analytics')         targetHandler = (await import('../src/api-lib/handlers/analytics.js')).default;
    else if (path === 'user')              targetHandler = (await import('../src/api-lib/handlers/user.js')).default;
    else if (path === 'workflows')         targetHandler = (await import('../src/api-lib/handlers/workflows.js')).default;
    else if (path?.startsWith('oauth'))    targetHandler = (await import('../src/api-lib/handlers/oauth.js')).default;
    else if (path?.startsWith('google'))   targetHandler = (await import('../src/api-lib/handlers/google-proxy.js')).default;
    else if (path?.startsWith('workspace')) targetHandler = (await import('../src/api-lib/handlers/workspace.js')).default;
    else if (path?.startsWith('cron'))      targetHandler = (await import('../src/api-lib/handlers/cron.js')).default;
    else if (path?.startsWith('public'))    targetHandler = (await import('../src/api-lib/handlers/public.js')).default;
    else {
      // Provide fallback based on `action` parameter if `path` is not exactly one of the above.
      switch (action) {
        case 'candidate': targetHandler = (await import('../src/api-lib/handlers/client-candidate.js')).default; break;
        case 'submissions': targetHandler = (await import('../src/api-lib/handlers/client-submissions.js')).default; break;
        case 'repair': targetHandler = (await import('../src/api-lib/handlers/repair-candidates.js')).default; break;
        case 'validate-submission': targetHandler = (await import('../src/api-lib/handlers/validate-submission.js')).default; break;
        case 'parse-jd': targetHandler = (await import('../src/api-lib/handlers/parse-jd.js')).default; break;
        case 'extract-text': targetHandler = (await import('../src/api-lib/handlers/extract-text.js')).default; break;
        case 'public-candidate-resume': targetHandler = (await import('../src/api-lib/handlers/public-candidate-resume.js')).default; break;
        case 'match-detailed': targetHandler = (await import('../src/api-lib/handlers/match-candidates-detailed.js')).default; break;
        case 'bulk-parse':
        case 'bulk-parse-resumes': targetHandler = (await import('../src/api-lib/handlers/bulk-parse-resumes.js')).default; break;
        default: targetHandler = (await import('../src/api-lib/handlers/admin.js')).default; break;
      }
    }

    if (targetHandler) {
      const expressRouters = ['oauth', 'google', 'workspace', 'cron'];
      const matchedRouter = expressRouters.find(r => path?.startsWith(r));
      if (matchedRouter) {
        // Rewrite req.url so the Express Router matches it
        const originalUrl = req.originalUrl || req.url;
        let subPath = path.replace(new RegExp(`^${matchedRouter}`), "");
        if (!subPath.startsWith('/')) {
            subPath = '/' + subPath;
        }
        if (subPath === '/' && action) {
           subPath = '/' + action; // Fallback if action is provided but path was just the router name
        }
        
        const qsIndex = originalUrl.indexOf('?');
        const qs = qsIndex > -1 ? originalUrl.slice(qsIndex) : '';
        req.url = subPath + (subPath.includes('?') ? '' : qs);
        
        return new Promise((resolve, reject) => {
          let completed = false;
          const finish = (val?: any) => {
             if (completed) return;
             completed = true;
             resolve(val);
          };
          const fail = (err: any) => {
             if (completed) return;
             completed = true;
             reject(err);
          };

          const originalEnd = res.end;
          res.end = function (...args: any[]) {
            finish(undefined);
            return originalEnd.apply(this, args);
          };

          targetHandler(req, res, (err: any) => {
            req.url = originalUrl; // Restore just in case
            if (err) return fail(err);
            finish(res.status(404).json({ error: "Route not found in Express Router" }));
          });
        });
      }
      return await targetHandler(req, res);
    }

    return res.status(200).json({ success: true, message: "api/index alive but no handler matched" });
  } catch (err: any) {
    console.error("VERCEL_API_ERROR_CAUGHT:", err);
    return res.status(500).json({ success: false, error: String(err.message || err.toString()), stack: err.stack });
  }
}

