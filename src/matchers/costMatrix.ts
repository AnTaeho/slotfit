// hungarian이 푸는 정사각 cost 행렬을 만들고, 행→열 배정을 MatchResult로 되돌린다.
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

export type CostMatrix = { matrix: number[][]; nItems: number; nSlots: number };

export function buildCostMatrix(ctx: MatchContext): CostMatrix {
  return buildSubsetCostMatrix(ctx, ctx.content.items, ctx.slots);
}

// 항목 부분집합 × 슬롯 부분집합으로 같은 모양의 행렬을 만든다(hierarchical의 하위 문제용).
// 행·열 순서는 넘겨받은 배열 순서를 따른다. cost()는 전체 ctx 기준이므로
// 순서 항의 상대 위치도 부분집합이 아니라 전체 항목·슬롯 안의 위치로 잰다.
export function buildSubsetCostMatrix(
  ctx: MatchContext,
  items: readonly ContentItem[],
  slots: readonly Slot[],
): CostMatrix {
  const nItems = items.length;
  const nSlots = slots.length;

  // 실제 항목 행: [실제 슬롯 열들, dummy 슬롯 열들]
  const itemRows = items.map((item) => [
    ...slots.map((slot) => cost(item, slot, ctx)),
    ...items.map(() => DUMMY_SLOT_COST(item)),
  ]);
  // dummy 항목 행: [실제 슬롯 열들, dummy 슬롯 열들(= 0)]
  const dummyRows = slots.map(() => [...slots.map((slot) => DUMMY_ITEM_COST(slot)), ...items.map(() => 0)]);

  return { matrix: [...itemRows, ...dummyRows], nItems, nSlots };
}

// 행→열 배정(rowToCol[행] = 열)을 MatchResult로 바꾼다.
// assignment는 ctx.slots(DFS) 순서, dropped는 content.items 순서, totalCost는 고른 칸 값의 합.
export function resultFromPermutation(ctx: MatchContext, rowToCol: number[]): MatchResult {
  const { matrix, nItems, nSlots } = buildCostMatrix(ctx);
  if (rowToCol.length !== matrix.length) {
    throw new Error(`resultFromPermutation: 배정 길이 ${rowToCol.length} ≠ 행렬 크기 ${matrix.length}`);
  }
  if (new Set(rowToCol).size !== rowToCol.length) {
    throw new Error('resultFromPermutation: 한 열이 두 번 배정됐다(순열이 아니다)');
  }

  const slotToItem = new Map<number, number>(); // 실제 슬롯 열 → 실제 항목 행
  const droppedRows = new Set<number>();
  let totalCost = 0;

  rowToCol.forEach((col, row) => {
    const value = matrix[row]?.[col];
    if (value === undefined) throw new Error(`resultFromPermutation: 범위 밖 칸 (${row}, ${col})`);
    totalCost += value;
    if (row >= nItems) return; // dummy 항목 행: 슬롯을 비우거나(실제 열) 아무 일도 없음(dummy 열)
    if (col >= nSlots) {
      droppedRows.add(row);
      return;
    }
    // 금지 칸은 버림+비움보다 항상 비싸므로(D-15) 최적해에 나올 수 없다. 나오면 버그다.
    if (value >= FORBIDDEN_COST) {
      throw new Error(`resultFromPermutation: 금지 칸이 배정됐다 (항목 ${row}, 슬롯 ${col})`);
    }
    slotToItem.set(col, row);
  });

  const items = ctx.content.items;
  const assignment: Assignment = ctx.slots.map((slot, col) => {
    const row = slotToItem.get(col);
    return { slotId: slot.id, contentId: row === undefined ? null : (items[row]?.id ?? null) };
  });
  const dropped = items.filter((_item, row) => droppedRows.has(row)).map((item) => item.id);
  return { assignment, dropped, totalCost };
}
