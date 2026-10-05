// dropLowPriority 단계: 줄여도 넘치는 priority 3(다음 2) 항목을 하나 버린다. priority 1은 버리지 않는다(D-21).
import type { MatchContext } from '../../context';
import type { Adjustments, ContentItem, MatchResult, Violation } from '../../schema';
import { validate } from '../../validation/validate';
import { overflow } from '../../validation/rules/overflow';
import type { FallbackStep } from '../types';

const id = 'dropLowPriority';

type Candidate = { slotId: string; item: ContentItem };

// overflow 위반이 걸린 배치 항목 중 priority 2·3이고, 그 슬롯이 이미 minFontSize 이하인 것.
// 아직 줄일 수 있는 슬롯은 shrinkFont 몫이라 후보에서 뺀다.
function candidates(v: Violation[], ctx: MatchContext, adj: Adjustments): Candidate[] {
  const out: Candidate[] = [];
  for (const violation of v) {
    if (violation.ruleId !== overflow.id || violation.slotId === undefined || violation.contentId === undefined) continue;
    const slot = ctx.slots.find((s) => s.id === violation.slotId);
    const item = ctx.itemsById[violation.contentId];
    if (slot === undefined || slot.type !== 'text' || item === undefined) continue;
    if (item.priority === 1) continue; // D-21: priority 1은 절대 버리지 않는다
    if ((adj.fontSize[slot.id] ?? slot.fontSize) > slot.minFontSize) continue;
    out.push({ slotId: slot.id, item });
  }
  return out;
}

function applies(v: Violation[], ctx: MatchContext, _r: MatchResult, adj: Adjustments): boolean {
  return candidates(v, ctx, adj).length > 0;
}

// 버릴 하나: priority 3이 2보다 먼저(숫자가 큰 쪽), 같은 priority면 입력 순서가 뒤인 것.
function pick(list: Candidate[], ctx: MatchContext): Candidate | undefined {
  const order = (c: Candidate): number => ctx.itemIndex[c.item.id] ?? -1;
  return [...list].sort((a, b) => b.item.priority - a.item.priority || order(b) - order(a))[0];
}

function apply(ctx: MatchContext, r: MatchResult, adj: Adjustments): { r: MatchResult; adj: Adjustments; note: string } {
  const target = pick(candidates(validate(ctx, r, adj, [overflow]), ctx, adj), ctx);
  if (target === undefined) return { r, adj, note: '버릴 항목 없음' };

  const dropId = target.item.id;
  const assignment = r.assignment.map((a) => (a.slotId === target.slotId ? { slotId: a.slotId, contentId: null } : a));
  // dropped는 content.items 순서를 유지한다.
  const droppedSet = new Set([...r.dropped, dropId]);
  const dropped = ctx.content.items.map((i) => i.id).filter((itemId) => droppedSet.has(itemId));
  // 가정: totalCost는 matcher가 낸 배치 점수로 남겨 둔다(버림 비용을 다시 더하지 않는다). 판정에는 쓰지 않는다.
  return {
    r: { ...r, assignment, dropped },
    adj,
    note: `drop ${dropId} (p${target.item.priority}) from ${target.slotId}`,
  };
}

export const dropLowPriority: FallbackStep = { id, applies, apply };
