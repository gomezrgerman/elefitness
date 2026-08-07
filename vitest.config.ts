import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    testTimeout: 15000,
    fileParallelism: false,
    // Sin aislamiento los ficheros comparten el modulo helpers.ts, y con el la
    // cache de sesiones de signInAs: sin esto la suite agota el limite de
    // inicios de sesion de Supabase Auth.
    isolate: false,
  },
});
