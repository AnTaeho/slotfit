// 배치에서 「찢어진 카드」를 찾는다: 같은 groupId의 콘텐츠가 서로 다른 템플릿 그룹(또는 그룹 밖)에 흩어진 경우.
// matcher(hierarchical) · validation(groupSplit) · fallback(dropLowPriority)이 같은 판정을 쓰도록 중립 모듈에 둔다.
import type { MatchContext } from './context';
import type { Assignment } from './schema';

export type GroupPlacement = { contentId: string; slotId: string };
// 찢어진 콘텐츠 그룹 하나: groupId와, 그 그룹에서 배치된 (항목, 슬롯) 목록(입력 순서).
export type SplitGroup = { groupId: string; placed: GroupPlacement[] };

// groupId마다 배치된 항목들이 놓인 슬롯의 소속 그룹(ctx.slotGroup)을 모은다. 그룹 밖(null)도 하나의 값이다.
// 값이 2가지 이상이면 그 groupId는 찢어진 것이다. 버려진 항목은 보지 않으므로 배치된 항목이 1개 이하면 찢어지지 않았다.
// 돌려주는 순서 = groupId가 content.items에 처음 나온 순서.
// 예: g1 = {c1-sub → cardA-sub(cardA), c1-body → cardB-body(cardB)} → {cardA, cardB} 2가지 → 찢어짐.
export function findSplitGroups(ctx: MatchContext, assignment: Assignment): SplitGroup[] {
  const slotIdOfItem = new Map<string, string>();
  for (const { slotId, contentId } of assignment) {
    if (contentId !== null) slotIdOfItem.set(contentId, slotId);
  }

  // groupId → 배치된 (항목, 슬롯) 목록. groupId는 첫 등장 순서, 목록은 입력 순서.
  const placedByGroup = new Map<string, GroupPlacement[]>();
  for (const item of ctx.content.items) {
    if (item.groupId === undefined) continue;
    const placed = placedByGroup.get(item.groupId) ?? [];
    const slotId = slotIdOfItem.get(item.id);
    if (slotId !== undefined) placed.push({ contentId: item.id, slotId });
    placedByGroup.set(item.groupId, placed);
  }

  const split: SplitGroup[] = [];
  for (const [groupId, placed] of placedByGroup) {
    const templateGroups = new Set(placed.map(({ slotId }) => ctx.slotGroup[slotId] ?? null));
    if (templateGroups.size >= 2) split.push({ groupId, placed });
  }
  return split;
}
