declare module '@cloudflare/workers-types' {
  export interface PagesFunction<Env = unknown, Data = unknown> {
    (context: {
      request: Request;
      env: Env;
      params: Record<string, string>;
      data: Data;
      waitUntil(promise: Promise<unknown>): void;
      next(): Promise<Response>;
    }): Response | Promise<Response>;
  }

  export interface KVNamespace {
    get(key: string, options?: { type: 'json' | 'text' | 'arrayBuffer' }): Promise<unknown>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  }
}
