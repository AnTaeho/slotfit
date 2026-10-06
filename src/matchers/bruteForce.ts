// bruteForce matcher: 가능한 배치를 전부 돌아보는 oracle(느리지만 확실한 정답). 작은 입력 전용(D-17).
// 항목을 입력 순서대로 하나씩 보며 「아직 안 쓴 실제 슬롯 하나」 또는 「버림」을 고른다.
// 끝까지 고르면 남은 슬롯은 비움. 배치 비용 = 실제 짝 cost 합 + 버림 비용 합 + 비움 비용 합.
// 가지치기를 하지 않고, kind 불일치 짝도 빼지 않고 cost(FORBIDDEN_COST)로만 다룬다.
// 그래야 hungarian과 똑같은 문제를 푸는 기준값이 된다.
import type { MatchContext } from '../context';
import type { MatchResult } from '../schema';
import { cost, DUMMY_ITEM_COST, DUMMY_SLOT_COST } from '../scoring/cost';
import { BRUTE_FORCE_MAX_ITEMS, BRUTE_FORCE_MAX_SLOTS } from '../scoring/weights';
import type { Matcher } from './types';

// 이 ctx를 bruteForce로 풀어도 되는 크기인가.
export function bruteForceFits(ctx: MatchContext): boolean {
  return ctx.slots.length <= BRUTE_FORCE_MAX_SLOTS && ctx.content.items.length <= BRUTE_FORCE_MAX_ITEMS;
}

function match(ctx: MatchContext): MatchResult {
  if (!bruteForceFits(ctx)) {
    throw new Error(
      `bruteForce: 슬롯 ≤ ${BRUTE_FORCE_MAX_SLOTS}, 항목 ≤ ${BRUTE_FORCE_MAX_ITEMS}에서만 실행한다 ` +
        `(지금 슬롯 ${ctx.slots.length}, 항목 ${ctx.content.items.length})`,
    );
  }
  const items = ctx.content.items;
  const slots = ctx.slots;

  // choice[k] = 항목 k가 들어간 슬롯 번호, null이면 버림.
  const choice: (number | null)[] = items.map(() => null);
  const usedSlot: boolean[] = slots.map(() => false);
  // 지금까지 가장 싼 완성 배치. 클로저 안에서 바꾸므로 상자에 담아 둔다.
  const found: { best: { choice: (number | null)[]; totalCost: number } | null } = { best: null };

  // 항목 k부터 끝까지 고른다. costSoFar = 항목 0..k-1에서 생긴 짝 cost + 버림 비용.
  const search = (k: number, costSoFar: number): void => {
    const item = items[k];
    if (item === undefined) {
      // 다 골랐다: 남은 슬롯은 비움 비용을 더한다.
      let total = costSoFar;
      slots.forEach((slot, j) => {
        if (!usedSlot[j]) total += DUMMY_ITEM_COST(slot, ctx.weights);
      });
      // 같은 비용이면 먼저 찾은 배치를 둔다.
      if (found.best === null || total < found.best.totalCost) {
        found.best = { choice: [...choice], totalCost: total };
      }
      return;
    }
    // 아직 안 쓴 실제 슬롯 하나에 넣는다.
    slots.forEach((slot, j) => {
      if (usedSlot[j]) return;
      usedSlot[j] = true;
      choice[k] = j;
      search(k + 1, costSoFar + cost(item, slot, ctx));
      usedSlot[j] = false;
    });
    // 또는 버린다.
    choice[k] = null;
    search(k + 1, costSoFar + DUMMY_SLOT_COST(item, ctx.weights));
  };
  search(0, 0);

  // 항목이 0개여도 search가 한 번은 끝까지 가므로 best는 항상 있다.
  const best = found.best;
  if (best === null) throw new Error('bruteForce: 배치를 하나도 찾지 못했다');

  const itemIdBySlot = new Map<number, string>();
  const dropped: string[] = [];
  items.forEach((item, k) => {
    const j = best.choice[k];
    if (j === null || j === undefined) dropped.push(item.id);
    else itemIdBySlot.set(j, item.id);
  });
  const assignment = slots.map((slot, j) => ({ slotId: slot.id, contentId: itemIdBySlot.get(j) ?? null }));
  return { assignment, dropped, totalCost: best.totalCost };
}

export const bruteForce: Matcher = { name: 'bruteForce', match };
