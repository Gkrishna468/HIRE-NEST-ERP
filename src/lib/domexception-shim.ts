// Browser shim for node-domexception to avoid worker_threads imports in browser bundle
const NativeDOMException = typeof globalThis !== 'undefined' && globalThis.DOMException 
  ? globalThis.DOMException 
  : class DOMException extends Error {
      constructor(message?: string, name?: string) {
        super(message);
        this.name = name || 'DOMException';
      }
    };

export default NativeDOMException;
