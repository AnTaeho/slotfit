// groupSplit 규칙: 같은 groupId의 콘텐츠가 서로 다른 템플릿 그룹(또는 그룹 밖)에 흩어졌는지 본다.
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

const id = 'groupSplit';
const severity = 'error'; // D-20

type Placement = { contentId: string; slotId: string };

// groupId마다 배치된 항목들이 놓인 슬롯의 소속 그룹(ctx.slotGroup)을 모은다. 그룹 밖(null)도 하나의 값이다.
// 값이 2가지 이상이면 그 groupId에 위반 1개. 버려진 항목은 보지 않으므로 배치된 항목이 1개 이하면 위반이 아니다.
// 예: g1 = {c1-sub → cardA-sub(cardA), c1-body → cardB-body(cardB)} → {cardA, cardB} 2가지 → 위반.
function check(ctx: MatchContext, result: MatchResult, _adj: Adjustments): Violation[] {
  const slotIdOfItem = new Map<string, string>();
  for (const { slotId, contentId } of result.assignment) {
    if (contentId !== null) slotIdOfItem.set(contentId, slotId);
  }

  // groupId → 배치된 (항목, 슬롯) 목록. groupId는 첫 등장 순서, 목록은 입력 순서.
  const placedByGroup = new Map<string, Placement[]>();
  for (const item of ctx.content.items) {
    if (item.groupId === undefined) continue;
    const placed = placedByGroup.get(item.groupId) ?? [];
    const slotId = slotIdOfItem.get(item.id);
    if (slotId !== undefined) placed.push({ contentId: item.id, slotId });
    placedByGroup.set(item.groupId, placed);
  }

  const violations: Violation[] = [];
  for (const [groupId, placed] of placedByGroup) {
    const first = placed[0];
    if (first === undefined) continue;
    const templateGroups = new Set(placed.map(({ slotId }) => ctx.slotGroup[slotId] ?? null));
    if (templateGroups.size < 2) continue;
    const where = placed
      .map(({ contentId, slotId }) => `${contentId} → ${slotId}(${ctx.slotGroup[slotId] ?? '그룹 밖'})`)
      .join(', ');
    // slotId는 render가 칠할 수 있게 배치된 첫 항목의 슬롯으로 둔다.
    violations.push({ ruleId: id, severity, slotId: first.slotId, detail: `groupId ${groupId}: ${where}` });
  }
  return violations;
}

export const groupSplit: Rule = { id, severity, check };
