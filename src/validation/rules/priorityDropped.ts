// priorityDropped 규칙: priority 1 콘텐츠가 버려졌으면 위반(D-20: error).
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

const id = 'priorityDropped';
const severity = 'error'; // D-20

// dropped 중 priority 1인 항목마다 위반 1개. 순서는 dropped 순서를 따른다.
function check(ctx: MatchContext, result: MatchResult, _adj: Adjustments): Violation[] {
  const violations: Violation[] = [];
  for (const contentId of result.dropped) {
    if (ctx.itemsById[contentId]?.priority !== 1) continue;
    violations.push({ ruleId: id, severity, contentId, detail: `priority 1 항목 ${contentId}이 버려졌다` });
  }
  return violations;
}

export const priorityDropped: Rule = { id, severity, check };
