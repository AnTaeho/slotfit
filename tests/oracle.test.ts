// oracle: 작은 입력에서 hungarian이 전수 탐색(bruteForce)과 같은 최소 totalCost를 내는지 확인한다.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { permutations } from '../bench/golden';
import { buildContext } from '../src/context';
import { bruteForce, bruteForceFits } from '../src/matchers/bruteForce';
import { hungarian, solveAssignment } from '../src/matchers/hungarian';
import { DROP_COST_BY_PRIORITY, EMPTY_COST_BY_ROLE, FORBIDDEN_COST } from '../src/scoring/weights';
import { smallContentArb, smallTemplateArb } from './arbitraries';
import { allFixtureContexts } from './fixtureContexts';

const DIGITS = 6; // totalCost 비교 소수 자릿수(합하는 순서가 달라 생기는 부동소수 오차만 허용)

const sumOf = (matrix: number[][], rowToCol: number[]): number =>
  rowToCol.reduce((sum, col, row) => sum + (matrix[row]?.[col] ?? Number.NaN), 0);

describe('oracle: hungarian = bruteForce', () => {
  it('랜덤 작은 입력(슬롯 ≤ 6, 항목 ≤ 7)에서 totalCost가 같다', () => {
    fc.assert(
      fc.property(smallTemplateArb, smallContentArb, (t, c) => {
        const ctx = buildContext(t, c);
        expect(hungarian.match(ctx).totalCost).toBeCloseTo(bruteForce.match(ctx).totalCost, DIGITS);
      }),
    );
  });

  it('상한 이내인 fixture 쌍 전부에서 totalCost가 같다', () => {
    const contexts = allFixtureContexts().filter(bruteForceFits);
    expect(contexts.length).toBeGreaterThan(0);
    for (const ctx of contexts) {
      expect(hungarian.match(ctx).totalCost, `${ctx.template.id} × ${ctx.content.id}`).toBeCloseTo(
        bruteForce.match(ctx).totalCost,
        DIGITS,
      );
    }
  });
});

describe('oracle: solveAssignment', () => {
  it('빈 행렬이면 빈 배정을 돌려준다', () => {
    expect(solveAssignment([])).toEqual([]);
  });

  it('랜덤 정사각 정수 행렬(1~7)에서 순열을 돌려주고, 합이 모든 순열의 최솟값과 같다', () => {
    const squareMatrix = fc
      .integer({ min: 1, max: 7 })
      .chain((n) =>
        fc.array(fc.array(fc.integer({ min: -50, max: 100 }), { minLength: n, maxLength: n }), {
          minLength: n,
          maxLength: n,
        }),
      );
    fc.assert(
      fc.property(squareMatrix, (matrix) => {
        const n = matrix.length;
        const rowToCol = solveAssignment(matrix);
        expect([...rowToCol].sort((x, y) => x - y)).toEqual([...Array(n).keys()]);
        const best = Math.min(...permutations(n).map((perm) => sumOf(matrix, perm)));
        expect(sumOf(matrix, rowToCol)).toBe(best);
      }),
    );
  });
});

describe('D-15: 금지 칸', () => {
  // 금지 짝 하나를 「항목 버림 + 슬롯 비움」으로 바꾸면 항상 더 싸야 최적해가 금지 칸을 고르지 않는다.
  it('FORBIDDEN_COST > 최대 버림 비용 + 최대 비움 비용', () => {
    const maxDrop = Math.max(...Object.values(DROP_COST_BY_PRIORITY));
    const maxEmpty = Math.max(...Object.values(EMPTY_COST_BY_ROLE));
    expect(FORBIDDEN_COST).toBeGreaterThan(maxDrop + maxEmpty);
  });
});
