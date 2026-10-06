// dropLowPriority 단계: 줄여도 넘치는 priority 3(다음 2) 항목을 하나 버린다. priority 1(D-21)과 찢어진 카드의 항목(D-29)은 버리지 않는다.
import type { MatchContext } from '../../context';
import { findSplitGroups } from '../../grouping';
import type { Adjustments, ContentItem, MatchResult, Violation } from '../../schema';
import { currentFontSize } from '../../text/measure';
import { overflow } from '../../validation/rules/overflow';
import { validate } from '../../validation/validate';
import type { FallbackOutcome, FallbackStep } from '../types';

const id = 'dropLowPriority';

type Candidate = { slotId: string; item: ContentItem };

// overflow 위반이 걸린 배치 항목 중 priority 2·3이고, 그 슬롯이 이미 minFontSize 이하인 것.
// 아직 줄일 수 있는 슬롯은 shrinkFont 몫이라 후보에서 뺀다.
// 지금 배치에서 찢어진 groupId에 속한 항목도 뺀다(D-29): 그 항목을 버리면 groupSplit error가 함께 사라져
// 섞인 카드가 거절을 피한다(F-8). 후보에서 빠진 항목의 overflow는 error로 남는다.
function dropCandidates(violations: Violation[], ctx: MatchContext, result: MatchResult, adj: Adjustments): Candidate[] {
  const splitGroupIds = new Set(findSplitGroups(ctx, result.assignment).map((group) => group.groupId));
  const candidates: Candidate[] = [];
  for (const violation of violations) {
    if (violation.ruleId !== overflow.id || violation.slotId === undefined || violation.contentId === undefined) continue;
    const slot = ctx.slotsById[violation.slotId];
    const item = ctx.itemsById[violation.contentId];
    if (slot === undefined || slot.type !== 'text' || item === undefined) continue;
    if (item.priority === 1) continue; // D-21: priority 1은 절대 버리지 않는다
    if (item.groupId !== undefined && splitGroupIds.has(item.groupId)) continue; // D-29: 찢어진 카드의 항목은 버리지 않는다
    if (currentFontSize(slot, adj) > slot.minFontSize) continue;
    candidates.push({ slotId: slot.id, item });
  }
  return candidates;
}

function applies(violations: Violation[], ctx: MatchContext, result: MatchResult, adj: Adjustments): boolean {
  return dropCandidates(violations, ctx, result, adj).length > 0;
}

// 버릴 하나: priority 3이 2보다 먼저(숫자가 큰 쪽), 같은 priority면 입력 순서가 뒤인 것.
function pickToDrop(candidates: Candidate[], ctx: MatchContext): Candidate | undefined {
  const inputOrder = (candidate: Candidate): number => ctx.itemIndex[candidate.item.id] ?? -1;
  return [...candidates].sort((a, b) => b.item.priority - a.item.priority || inputOrder(b) - inputOrder(a))[0];
}

function apply(ctx: MatchContext, result: MatchResult, adj: Adjustments): FallbackOutcome {
  const target = pickToDrop(dropCandidates(validate(ctx, result, adj, [overflow]), ctx, result, adj), ctx);
  if (target === undefined) return { r: result, adj, note: '버릴 항목 없음' };

  const dropId = target.item.id;
  const assignment = result.assignment.map((a) => (a.slotId === target.slotId ? { slotId: a.slotId, contentId: null } : a));
  // dropped는 content.items 순서를 유지한다.
  const droppedSet = new Set([...result.dropped, dropId]);
  const dropped = ctx.content.items.map((item) => item.id).filter((itemId) => droppedSet.has(itemId));
  // 가정: totalCost는 matcher가 낸 배치 점수로 남겨 둔다(버림 비용을 다시 더하지 않는다). 판정에는 쓰지 않는다.
  return {
    r: { ...result, assignment, dropped },
    adj,
    note: `drop ${dropId} (p${target.item.priority}) from ${target.slotId}`,
  };
}

export const dropLowPriority: FallbackStep = { id, applies, apply };
