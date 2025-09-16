declare module '@supabase/supabase-js' {
  interface QueryResult {
    data: any[] | null;
    error: Error | null;
  }

  interface PostgrestQueryBuilder<T = unknown> extends PromiseLike<QueryResult> {
    select(columns: string): PostgrestQueryBuilder<T>;
    ilike(column: string, pattern: string): PostgrestQueryBuilder<T>;
    order(column: string, options?: { ascending?: boolean }): PostgrestQueryBuilder<T>;
    limit(value: number): PostgrestQueryBuilder<T>;
    eq(column: string, value: unknown): PostgrestQueryBuilder<T>;
    lt(column: string, value: unknown): PostgrestQueryBuilder<T>;
    or(filters: string): PostgrestQueryBuilder<T>;
    maybeSingle<R = T>(): Promise<{ data: R | null; error: Error | null }>;
  }

  export interface SupabaseClient {
    from<T = unknown>(table: string): PostgrestQueryBuilder<T>;
  }

  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>
  ): SupabaseClient;
}
