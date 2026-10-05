// hungarian matcher: dummy로 정사각을 만든 cost 행렬에서 합이 최소인 배치를 O(N^3)에 찾는다.
//
// 비유(회식 자리 배치): 사람(콘텐츠)마다 자리(슬롯)별 불편 점수가 있고, 전체 불편 합이 최소인 자리표를 찾는다.
// 자리가 모자라면 「집에 가기」(dummy 슬롯 = 버림) 자리를, 사람이 모자라면 「빈 의자」(dummy 항목 = 비움)를
// 더해 표를 정사각으로 만든다. 집에 가기의 불편은 그 사람이 얼마나 중요한지(priority), 빈 의자의 불편은
// 그 자리가 얼마나 중요한지(role)로 정한다. 그러면 「누구를 어디에, 누구를 보내고, 어디를 비울지」가
// 한 번의 자리표 계산으로 함께 정해진다.
import type { MatchContext } from '../context';
import type { MatchResult } from '../schema';
import { buildCostMatrix, resultFromPermutation } from './costMatrix';
import type { Matcher } from './types';

// N×N 행렬의 최소 비용 완전 배정. 반환값 rowToCol[행] = 열(0부터).
// 흔히 쓰는 1-indexed 「e-maxx」 형태다. 내부 배열은 0번 칸을 「가상 열/행」으로 쓰려고 N+1 크기다.
//
// 잠재값(potential) u[행], v[열]: 「행 i를 열 j에 놓을 때의 줄인 비용」 a[i][j] − u[i] − v[j]가
//   항상 0 이상이 되게 유지하는 보정값이다. 줄인 비용이 0인 칸만 「지금 공짜로 쓸 수 있는 칸」으로 본다.
//   모든 행이 줄인 비용 0인 칸에 배정되면, 합 = Σu + Σv 이고 이것이 최솟값이다(어떤 배정도 Σu + Σv 아래로 못 간다).
// p[j]: 열 j를 차지한 행(0이면 빈 열). p[0]은 지금 새로 넣으려는 행을 잠시 담는 자리.
// 행을 하나씩 추가한다. 새 행 i를 넣을 때:
//   1) 가상 열 0에 행 i를 앉히고, 거기서 시작해 「열 → 그 열의 주인 행 → 다른 열」로 뻗는 트리를 키운다.
//   2) minv[j]: 지금까지 트리에 든 행들에서 열 j로 가는 줄인 비용의 최솟값. way[j]: 그 최솟값을 준 직전 열.
//   3) 트리 밖 열 중 minv가 가장 작은 열 j1을 고르고, 그 값 delta만큼 잠재값을 옮긴다.
//      (트리 안 행은 u += delta, 트리 안 열은 v −= delta → 트리 안 칸은 그대로, j1로 가는 칸이 0이 된다.)
//   4) j1이 빈 열이면 증가 경로를 찾은 것: way를 거꾸로 따라가며 한 칸씩 자리를 밀어 행 i까지 앉힌다.
//      j1에 주인이 있으면 그 주인 행을 트리에 넣고 2)부터 반복한다.
// 행마다 열을 최대 N번 트리에 넣고 매번 N개 열을 보므로 전체 O(N^3).
export function solveAssignment(matrix: number[][]): number[] {
  const n = matrix.length;
  if (n === 0) return [];
  for (const row of matrix) {
    if (row.length !== n) throw new Error(`solveAssignment: 정사각 행렬이 아니다 (${n}행, 한 행 ${row.length}열)`);
  }
  // 1-indexed 접근. 범위 밖이면 버그이므로 숨기지 않는다.
  const a = (i: number, j: number): number => {
    const value = matrix[i - 1]?.[j - 1];
    if (value === undefined) throw new Error(`solveAssignment: 범위 밖 칸 (${i}, ${j})`);
    return value;
  };
  const at = (arr: number[], k: number): number => {
    const value = arr[k];
    if (value === undefined) throw new Error(`solveAssignment: 범위 밖 인덱스 ${k}`);
    return value;
  };

  const u = new Array<number>(n + 1).fill(0); // 행 잠재값
  const v = new Array<number>(n + 1).fill(0); // 열 잠재값
  const p = new Array<number>(n + 1).fill(0); // p[j] = 열 j에 앉은 행 (0 = 비었음)
  const way = new Array<number>(n + 1).fill(0); // way[j] = 열 j에 이르는 증가 경로의 직전 열

  for (let i = 1; i <= n; i++) {
    // 새 행 i를 가상 열 0에 앉히고 시작한다.
    p[0] = i;
    let j0 = 0; // 지금 트리에 막 들어온 열
    const minv = new Array<number>(n + 1).fill(Infinity); // 트리에서 각 열까지의 최소 줄인 비용
    const used = new Array<boolean>(n + 1).fill(false); // 열이 트리에 들어왔는가

    do {
      used[j0] = true;
      const i0 = at(p, j0); // 막 들어온 열의 주인 행. 이 행에서 뻗는 칸을 새로 본다.
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const reduced = a(i0, j) - at(u, i0) - at(v, j); // 줄인 비용
        if (reduced < at(minv, j)) {
          minv[j] = reduced;
          way[j] = j0;
        }
        if (at(minv, j) < delta) {
          delta = at(minv, j);
          j1 = j;
        }
      }
      // 잠재값을 delta만큼 옮긴다. 트리 안 칸의 줄인 비용은 그대로, 트리 밖 열까지의 minv는 delta만큼 준다.
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          const owner = at(p, j);
          u[owner] = at(u, owner) + delta;
          v[j] = at(v, j) - delta;
        } else {
          minv[j] = at(minv, j) - delta;
        }
      }
      j0 = j1;
    } while (at(p, j0) !== 0); // 빈 열에 닿으면 증가 경로 완성

    // 증가 경로를 거꾸로 따라가며 자리를 한 칸씩 민다. 마지막에 행 i가 경로의 첫 열에 앉는다.
    do {
      const j1 = at(way, j0);
      p[j0] = at(p, j1);
      j0 = j1;
    } while (j0 !== 0);
  }

  // p(열 → 행)를 행 → 열로 뒤집고 0-indexed로 바꾼다.
  const rowToCol = new Array<number>(n).fill(0);
  for (let j = 1; j <= n; j++) rowToCol[at(p, j) - 1] = j - 1;
  return rowToCol;
}

function match(ctx: MatchContext): MatchResult {
  const { matrix } = buildCostMatrix(ctx);
  return resultFromPermutation(ctx, solveAssignment(matrix));
}

export const hungarian: Matcher = { name: 'hungarian', match };
