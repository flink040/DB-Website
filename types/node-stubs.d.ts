declare var process: {
  env: Record<string, string | undefined>;
};

declare module 'node:test' {
  type TestContext = {
    diagnostic(message: string): void;
    skip(message?: string): void;
    plan(count: number): void;
    end(): void;
  };

  type TestFn = (t: TestContext) => unknown | Promise<unknown>;

  interface Test {
    (name: string, fn: TestFn): Promise<void>;
    (fn: TestFn): Promise<void>;
  }

  const test: Test;
  export { test };
  export default test;
}

declare module 'node:assert/strict' {
  interface Assert {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  }

  const assert: Assert;
  export = assert;
}
