// titleMissing 규칙: role이 title인 슬롯이 비어 있으면 위반(D-20: error).
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

const id = 'titleMissing';
const severity = 'error'; // D-20

// title 슬롯마다 contentId가 null이면 위반 1개. title 슬롯이 없는 템플릿이면 위반도 없다.
// title 칸에 title이 아닌 항목이 들어간 경우는 roleMismatch가 따로 잡는다.
function check(ctx: MatchContext, result: MatchResult, _adj: Adjustments): Violation[] {
  const violations: Violation[] = [];
  for (const { slotId, contentId } of result.assignment) {
    if (contentId !== null || ctx.slotsById[slotId]?.role !== 'title') continue;
    violations.push({ ruleId: id, severity, slotId, detail: `title 슬롯 ${slotId}이 비어 있다` });
  }
  return violations;
}

export const titleMissing: Rule = { id, severity, check };
