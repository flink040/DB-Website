const states = new Map();

function ensureState(cacheKey) {
  if (!states.has(cacheKey)) {
    states.set(cacheKey, { responseQueue: [], queryLog: [] });
  }

  return states.get(cacheKey);
}

function cloneSteps(steps) {
  return steps.map((step) => step.slice());
}

function createQueryBuilder(cacheKey, table) {
  const steps = [];

  const builder = {
    steps,
    select(columns) {
      steps.push(['select', columns]);
      return builder;
    },
    ilike(column, pattern) {
      steps.push(['ilike', column, pattern]);
      return builder;
    },
    order(column, options) {
      steps.push(['order', column, options]);
      return builder;
    },
    limit(value) {
      steps.push(['limit', value]);
      return builder;
    },
    eq(column, value) {
      steps.push(['eq', column, value]);
      return builder;
    },
    lt(column, value) {
      steps.push(['lt', column, value]);
      return builder;
    },
    or(expression) {
      steps.push(['or', expression]);
      return builder;
    },
    maybeSingle() {
      steps.push(['maybeSingle']);
      return Promise.resolve({ data: null, error: null });
    },
    then(onFulfilled, onRejected) {
      const state = ensureState(cacheKey);
      const response =
        state.responseQueue.length > 0
          ? state.responseQueue.shift()
          : { data: [], error: null };

      state.queryLog.push({ table, steps: cloneSteps(steps) });

      return Promise.resolve(response).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

function createClient(url = '', key = '') {
  const cacheKey = `${url}:${key}`;
  ensureState(cacheKey);

  return {
    from(table) {
      return createQueryBuilder(cacheKey, table);
    },
  };
}

function resetState(cacheKey) {
  if (cacheKey) {
    states.set(cacheKey, { responseQueue: [], queryLog: [] });
    return;
  }

  states.clear();
}

function queueResponse(cacheKey, response = { data: [], error: null }) {
  const state = ensureState(cacheKey);
  state.responseQueue.push(response);
}

function getLastQuery(cacheKey) {
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

function getQueryLog(cacheKey) {
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

module.exports = {
  createClient,
  __queueResponse: queueResponse,
  __resetSupabaseState: resetState,
  __getLastQuery: getLastQuery,
  __getQueryLog: getQueryLog,
};
