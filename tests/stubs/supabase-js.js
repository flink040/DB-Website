function createQueryBuilder() {
  const steps = [];
  const builder = {
    steps,
    responses: { data: [], error: null },
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
      builder.limitValue = value;
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
      const promise = Promise.resolve(builder.responses);
      return promise.then(onFulfilled, onRejected);
    },
  };

  return builder;
}

function createClient() {
  return {
    from() {
      return createQueryBuilder();
    },
  };
}

module.exports = { createClient };
