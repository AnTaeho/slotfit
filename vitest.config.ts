// vitest 설정: globals 없이 tests/ 아래 *.test.ts만 실행한다.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['tests/**/*.test.ts'],
  },
});
