// contentDropped 규칙: priority 2 콘텐츠가 버려졌으면 위반(D-26: warn).
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

const id = 'contentDropped';
const severity = 'warn'; // D-26

// dropped 중 priority 2인 항목마다 위반 1개. 순서는 dropped 순서를 따른다.
// matcher가 버린 것과 fallback이 버린 것을 구분하지 않는다(둘 다 dropped에 있다).
// priority 1은 priorityDropped(error)가 본다. priority 3은 「있으면 좋은 것」이라 버려도 위반이 아니다.
// 예: dropped = [소제목(p2), 캡션(p3)] → 소제목에 위반 1개.
function check(ctx: MatchContext, result: MatchResult, _adj: Adjustments): Violation[] {
  const violations: Violation[] = [];
  for (const contentId of result.dropped) {
    if (ctx.itemsById[contentId]?.priority !== 2) continue;
    violations.push({ ruleId: id, severity, contentId, detail: `priority 2 항목 ${contentId}이 버려졌다` });
  }
  return violations;
}

export const contentDropped: Rule = { id, severity, check };
