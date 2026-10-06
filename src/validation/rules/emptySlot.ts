// emptySlot 규칙: role이 title이 아닌 슬롯이 비어 있으면 위반(D-27: warn).
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

const id = 'emptySlot';
const severity = 'warn'; // D-27

// contentId가 null이고 role이 title이 아닌 슬롯마다 위반 1개. 글 칸과 이미지 칸을 똑같이 본다.
// title 슬롯이 빈 것은 titleMissing(error)이 보므로 여기서는 세지 않는다. 임계값·비율은 두지 않는다: 한 칸만 비어도 위반이다.
// 예: 제목·소제목·본문·사진 칸 중 본문과 사진이 비었으면 위반 2개. 제목만 비었으면 0개.
function check(ctx: MatchContext, result: MatchResult, _adj: Adjustments): Violation[] {
  const violations: Violation[] = [];
  for (const { slotId, contentId } of result.assignment) {
    const role = ctx.slotsById[slotId]?.role;
    if (contentId !== null || role === undefined || role === 'title') continue;
    violations.push({ ruleId: id, severity, slotId, detail: `${role} 슬롯 ${slotId}이 비어 있다` });
  }
  return violations;
}

export const emptySlot: Rule = { id, severity, check };
