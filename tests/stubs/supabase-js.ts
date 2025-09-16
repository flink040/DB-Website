import type { SupabaseClient } from '@supabase/supabase-js';

type QueryStep = unknown[];

interface SupabaseResponse {
  data: unknown;
  error?: unknown;
}

interface AuthResponse {
  data: { user: Record<string, unknown> | null };
  error: unknown;
}

interface QueryLogEntry {
  table: string;
  steps: QueryStep[];
}

interface SupabaseStubState {
  responseQueue: SupabaseResponse[];
  queryLog: QueryLogEntry[];
  authQueue: AuthResponse[];
  lastAuthToken: string | null;
}

const states = new Map<string, SupabaseStubState>();

function ensureState(cacheKey: string): SupabaseStubState {
  if (!states.has(cacheKey)) {
    states.set(cacheKey, {
      responseQueue: [],
      queryLog: [],
      authQueue: [],
      lastAuthToken: null,
    });
  }

  return states.get(cacheKey)!;
}

function cloneSteps(steps: QueryStep[]): QueryStep[] {
  return steps.map((step) => step.slice());
}

function dequeueResponse(
  cacheKey: string,
  table: string,
  steps: QueryStep[],
  defaultResponse: SupabaseResponse
): SupabaseResponse {
  const state = ensureState(cacheKey);
  const response =
    state.responseQueue.length > 0 ? state.responseQueue.shift()! : defaultResponse;

  state.queryLog.push({ table, steps: cloneSteps(steps) });

  return response;
}

function dequeueAuthResponse(cacheKey: string): AuthResponse {
  const state = ensureState(cacheKey);
  if (state.authQueue.length > 0) {
    return state.authQueue.shift()!;
  }

  return { data: { user: null }, error: null };
}

function createQueryBuilder(cacheKey: string, table: string) {
  const steps: QueryStep[] = [];

  const builder: any = {
    steps,
    select(columns: string) {
      steps.push(['select', columns]);
      return builder;
    },
    ilike(column: string, pattern: string) {
      steps.push(['ilike', column, pattern]);
      return builder;
    },
    order(column: string, options?: { ascending?: boolean }) {
      steps.push(['order', column, options]);
      return builder;
    },
    limit(value: number) {
      steps.push(['limit', value]);
      return builder;
    },
    eq(column: string, value: unknown) {
      steps.push(['eq', column, value]);
      return builder;
    },
    lt(column: string, value: unknown) {
      steps.push(['lt', column, value]);
      return builder;
    },
    or(expression: string) {
      steps.push(['or', expression]);
      return builder;
    },
    insert(values: unknown, options?: Record<string, unknown>) {
      steps.push(['insert', values, options]);
      return builder;
    },
    maybeSingle() {
      steps.push(['maybeSingle']);
      const response = dequeueResponse(cacheKey, table, steps, {
        data: null,
        error: null,
      });

      return Promise.resolve(response);
    },
    then(onFulfilled?: (value: SupabaseResponse) => unknown, onRejected?: (reason: unknown) => unknown) {
      const response = dequeueResponse(cacheKey, table, steps, {
        data: [],
        error: null,
      });
      return Promise.resolve(response).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

export function createClient(
  url = '',
  key = '',
  _options: Record<string, unknown> = {}
): SupabaseClient {
  const cacheKey = `${url}:${key}`;
  ensureState(cacheKey);

  const client: SupabaseClient = {
    from(table: string) {
      return createQueryBuilder(cacheKey, table) as any;
    },
    auth: {
      getUser(accessToken: string) {
        const state = ensureState(cacheKey);
        state.lastAuthToken = accessToken ?? null;
        return Promise.resolve(dequeueAuthResponse(cacheKey));
      },
    },
  } as unknown as SupabaseClient;

  return client;
}

export function __resetSupabaseState(cacheKey?: string): void {
  if (cacheKey) {
    states.set(cacheKey, {
      responseQueue: [],
      queryLog: [],
      authQueue: [],
      lastAuthToken: null,
    });
    return;
  }

  states.clear();
}

export function __queueResponse(cacheKey: string, response: SupabaseResponse = { data: [], error: null }): void {
  const state = ensureState(cacheKey);
  state.responseQueue.push(response);
}

export function __queueAuthResponse(
  cacheKey: string,
  response: AuthResponse = { data: { user: null }, error: null }
): void {
  const state = ensureState(cacheKey);
  state.authQueue.push(response);
}

export function __getLastQuery(cacheKey: string): (QueryLogEntry & { steps: QueryStep[] }) | null {
  const state = ensureState(cacheKey);
  const entry = state.queryLog[state.queryLog.length - 1];
  if (!entry) {
    return null;
  }

  return {
    table: entry.table,
    steps: cloneSteps(entry.steps),
  };
}

export function __getLastAuthToken(cacheKey: string): string | null {
  const state = ensureState(cacheKey);
  return state.lastAuthToken;
}

export function __getQueryLog(cacheKey: string): QueryLogEntry[];
export function __getQueryLog(cacheKey?: string): Array<QueryLogEntry & { cacheKey: string }>;
export function __getQueryLog(cacheKey?: string): QueryLogEntry[] | Array<QueryLogEntry & { cacheKey: string }> {
  if (cacheKey) {
    const state = ensureState(cacheKey);
    return state.queryLog.map((entry) => ({
      table: entry.table,
      steps: cloneSteps(entry.steps),
    }));
  }

  return Array.from(states.entries()).flatMap(([key, state]) =>
    state.queryLog.map((entry) => ({
      cacheKey: key,
      table: entry.table,
      steps: cloneSteps(entry.steps),
    }))
  );
}
