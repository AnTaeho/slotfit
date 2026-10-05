// roleMismatch 규칙: 배치된 콘텐츠의 roleHint와 슬롯 role이 다르면 위반(D-20: warn).
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

const id = 'roleMismatch';
const severity = 'warn'; // D-20

// 배치된 짝마다 roleHint가 있고 slot.role과 다르면 위반 1개. roleHint가 없으면(D-8) 위반이 아니다.
function check(ctx: MatchContext, result: MatchResult, _adj: Adjustments): Violation[] {
  const violations: Violation[] = [];
  for (const { slotId, contentId } of result.assignment) {
    if (contentId === null) continue;
    const slot = ctx.slotsById[slotId];
    const hint = ctx.itemsById[contentId]?.roleHint;
    if (slot === undefined || hint === undefined || hint === slot.role) continue;
    violations.push({
      ruleId: id, severity, slotId, contentId,
      detail: `roleHint ${hint} 항목이 ${slot.role} 슬롯에 들어갔다`,
    });
  }
  return violations;
}

export const roleMismatch: Rule = { id, severity, check };
