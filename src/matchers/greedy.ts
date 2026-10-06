// greedy matcher: 슬롯을 DFS 순서로 돌며 같은 kind의 아직 안 쓴 첫 콘텐츠를 넣는다.
import type { MatchContext } from '../context';
import type { Assignment, MatchResult } from '../schema';
import { cost, DUMMY_ITEM_COST, DUMMY_SLOT_COST } from '../scoring/cost';
import type { Matcher } from './types';

function match(ctx: MatchContext): MatchResult {
  const used = new Set<string>();
  const assignment: Assignment = [];
  let totalCost = 0;

  for (const slot of ctx.slots) {
    // role·길이·그룹은 보지 않는다. 입력 순서(content.items)만 따른다.
    const item = ctx.content.items.find((candidate) => !used.has(candidate.id) && candidate.kind === slot.type);
    if (item === undefined) {
      assignment.push({ slotId: slot.id, contentId: null });
      totalCost += DUMMY_ITEM_COST(slot); // 비움
      continue;
    }
    used.add(item.id);
    assignment.push({ slotId: slot.id, contentId: item.id });
    totalCost += cost(item, slot, ctx); // kind가 같은 쌍만 고르므로 금지 칸은 없다
  }

  const droppedItems = ctx.content.items.filter((item) => !used.has(item.id));
  // totalCost를 다른 matcher와 같은 기준(실제 짝 cost + 버림 + 비움)으로 맞춘다. 고르는 방식은 cost를 보지 않는다.
  for (const item of droppedItems) totalCost += DUMMY_SLOT_COST(item); // 버림
  return { assignment, dropped: droppedItems.map((item) => item.id), totalCost };
}

export const greedy: Matcher = { name: 'greedy', match };
