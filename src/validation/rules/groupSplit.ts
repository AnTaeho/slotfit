// groupSplit 규칙: 같은 groupId의 콘텐츠가 서로 다른 템플릿 그룹(또는 그룹 밖)에 흩어졌는지 본다.
import type { MatchContext } from '../../context';
import { findSplitGroups } from '../../grouping';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

const id = 'groupSplit';
const severity = 'error'; // D-20

// 찢어진 groupId마다 위반 1개. 찢어짐 판정은 findSplitGroups(src/grouping.ts)가 한다:
// 배치된 항목들이 놓인 슬롯의 소속 그룹이 2가지 이상(그룹 밖도 하나의 값)이면 찢어진 것. 버려진 항목은 보지 않는다.
// 예: g1 = {c1-sub → cardA-sub(cardA), c1-body → cardB-body(cardB)} → {cardA, cardB} 2가지 → 위반.
function check(ctx: MatchContext, result: MatchResult, _adj: Adjustments): Violation[] {
  const violations: Violation[] = [];
  for (const { groupId, placed } of findSplitGroups(ctx, result.assignment)) {
    const first = placed[0];
    if (first === undefined) continue;
    const where = placed
      .map(({ contentId, slotId }) => `${contentId} → ${slotId}(${ctx.slotGroup[slotId] ?? '그룹 밖'})`)
      .join(', ');
    // slotId는 render가 칠할 수 있게 배치된 첫 항목의 슬롯으로 둔다.
    violations.push({ ruleId: id, severity, slotId: first.slotId, detail: `groupId ${groupId}: ${where}` });
  }
  return violations;
}

export const groupSplit: Rule = { id, severity, check };
