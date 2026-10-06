// hungarian이 푸는 정사각 cost 행렬을 만들고, 풀이(행→열 배정)를 짝·버림으로 읽어 MatchResult로 묶는다.
//
// 크기 N = 항목 수 + 슬롯 수. 행 = [실제 항목들, dummy 항목들(슬롯 수만큼)],
// 열 = [실제 슬롯들, dummy 슬롯들(항목 수만큼)].
//   실제 항목 × 실제 슬롯   = cost(항목, 슬롯)
//   실제 항목 × dummy 슬롯  = DUMMY_SLOT_COST(항목)  → 이 칸을 고르면 「버림」
//   dummy 항목 × 실제 슬롯  = DUMMY_ITEM_COST(슬롯)  → 이 칸을 고르면 「비움」
//   dummy 항목 × dummy 슬롯 = 0                      → 아무 일도 없음
//
// 예: 항목 a(priority 2), b(priority 3), 슬롯 S(body) 하나 → 3×3
//            S        dummy슬롯  dummy슬롯
//   a     cost(a,S)      30         30
//   b     cost(b,S)      10         10
//   dummy    10           0          0
// a→S, b→dummy, dummy→dummy 이면 「a를 S에 넣고 b는 버림」, 합 = cost(a,S) + 10.
// dummy 항목이 S를 고르면 S는 비고, 그때 a·b는 둘 다 버려진다.
import type { MatchContext } from '../context';
import type { Assignment, ContentItem, MatchResult, Slot } from '../schema';
import { cost, DUMMY_ITEM_COST, DUMMY_SLOT_COST } from '../scoring/cost';
import { FORBIDDEN_COST } from '../scoring/weights';

// 하위 문제 하나의 답. cost = 실제 짝 cost + 버림 비용 + 비움 비용(MatchResult.totalCost와 같은 정의).
export type SubproblemResult = {
  pairs: { itemId: string; slotId: string }[];
  dropped: string[]; // 넘겨받은 items 순서
  cost: number;
};

// 항목 목록 × 슬롯 목록으로 위 모양의 행렬을 만든다. 행·열 순서는 넘겨받은 배열 순서를 따른다.
// hierarchical은 부분집합을 넘긴다. cost()는 전체 ctx 기준이므로 순서 항의 상대 위치도
// 부분집합이 아니라 전체 항목·슬롯 안의 위치로 잰다.
export function buildCostMatrix(
  ctx: MatchContext,
  items: readonly ContentItem[],
  slots: readonly Slot[],
): number[][] {
  // 실제 항목 행: [실제 슬롯 열들, dummy 슬롯 열들]
  const itemRows = items.map((item) => [
    ...slots.map((slot) => cost(item, slot, ctx)),
    ...items.map(() => DUMMY_SLOT_COST(item, ctx.weights)),
  ]);
  // dummy 항목 행: [실제 슬롯 열들, dummy 슬롯 열들(= 0)]
  const dummyRows = slots.map(() => [...slots.map((slot) => DUMMY_ITEM_COST(slot, ctx.weights)), ...items.map(() => 0)]);
  return [...itemRows, ...dummyRows];
}

// buildCostMatrix(ctx, items, slots)로 만든 행렬의 풀이 rowToCol[행] = 열을 짝·버림·비용으로 읽는다.
// 비운 슬롯은 따로 적지 않는다: pairs에 없는 슬롯이 빈 슬롯이다.
export function readSolution(
  matrix: number[][],
  rowToCol: number[],
  items: readonly ContentItem[],
  slots: readonly Slot[],
): SubproblemResult {
  const pairs: SubproblemResult['pairs'] = [];
  const droppedRows = new Set<number>();
  let total = 0;
  rowToCol.forEach((col, row) => {
    const value = matrix[row]?.[col];
    if (value === undefined) throw new Error(`readSolution: 범위 밖 칸 (${row}, ${col})`);
    total += value;
    if (row >= items.length) return; // dummy 항목 행: 비움(실제 열)이거나 아무 일도 없음(dummy 열)
    if (col >= slots.length) {
      droppedRows.add(row);
      return;
    }
    // D-15: 금지 칸은 버림+비움보다 항상 비싸서 최적해에 나올 수 없다. 나오면 버그다.
    if (value >= FORBIDDEN_COST) throw new Error(`readSolution: 금지 칸이 배정됐다 (항목 ${row}, 슬롯 ${col})`);
    const item = items[row];
    const slot = slots[col];
    if (item === undefined || slot === undefined) throw new Error(`readSolution: 범위 밖 짝 (${row}, ${col})`);
    pairs.push({ itemId: item.id, slotId: slot.id });
  });

  return {
    pairs,
    dropped: items.filter((_item, row) => droppedRows.has(row)).map((item) => item.id),
    cost: total,
  };
}

// 항목·슬롯을 겹치지 않게 나눠 푼 하위 문제들의 답을 MatchResult 하나로 합친다.
// 다른 matcher와 모양을 맞춘다: assignment는 DFS 순서로 모든 슬롯 1번, dropped는 입력 순서.
// 하위 문제끼리 겹치지 않으므로 totalCost = 각 하위 문제 cost의 합 = 실제 짝 + 버림 + 비움 그대로다.
export function toMatchResult(ctx: MatchContext, parts: readonly SubproblemResult[]): MatchResult {
  const itemBySlot = new Map<string, string>();
  const dropped = new Set<string>();
  for (const part of parts) {
    for (const { itemId, slotId } of part.pairs) itemBySlot.set(slotId, itemId);
    for (const itemId of part.dropped) dropped.add(itemId);
  }
  const assignment: Assignment = ctx.slots.map((slot) => ({ slotId: slot.id, contentId: itemBySlot.get(slot.id) ?? null }));
  return {
    assignment,
    dropped: ctx.content.items.filter((item) => dropped.has(item.id)).map((item) => item.id),
    totalCost: parts.reduce((sum, part) => sum + part.cost, 0),
  };
}
