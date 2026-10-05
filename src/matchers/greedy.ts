// greedy matcher: 슬롯을 DFS 순서로 돌며 같은 kind의 아직 안 쓴 첫 콘텐츠를 넣는다.
import type { MatchContext } from '../context';
import type { Assignment, MatchResult } from '../schema';
import { cost } from '../scoring/cost';
import type { Matcher } from './types';

function match(ctx: MatchContext): MatchResult {
  const used = new Set<string>();
  const assignment: Assignment = [];
  let totalCost = 0;

  for (const slot of ctx.slots) {
    // role·길이·그룹은 보지 않는다. 입력 순서(content.items)만 따른다.
    const item = ctx.content.items.find((i) => !used.has(i.id) && i.kind === slot.type);
    if (item === undefined) {
      assignment.push({ slotId: slot.id, contentId: null });
      continue;
    }
    used.add(item.id);
    assignment.push({ slotId: slot.id, contentId: item.id });
    totalCost += cost(item, slot, ctx); // kind가 같은 쌍만 더하므로 유한값
  }

  const dropped = ctx.content.items.filter((i) => !used.has(i.id)).map((i) => i.id);
  return { assignment, dropped, totalCost };
}

export const greedy: Matcher = { name: 'greedy', match };
