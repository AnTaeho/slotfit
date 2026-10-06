// 템플릿과 콘텐츠에서 매칭·검증·그림에 필요한 조회 표를 한 번 계산해 둔다.
import type { Content, ContentItem, Slot, Template } from './schema';
import { collectSlots, slotGroupMap } from './tree/traverse';

export type MatchContext = {
  template: Template; content: Content;
  slots: Slot[];                               // DFS 순서
  slotGroup: Record<string, string | null>;    // slotId → GroupNode id
  itemsById: Record<string, ContentItem>;
  slotsById: Record<string, Slot>;
  itemIndex: Record<string, number>;           // contentId → content.items 안의 위치(입력 순서)
  slotIndex: Record<string, number>;           // slotId → slots 안의 위치(DFS 순서)
};

export function buildContext(t: Template, c: Content): MatchContext {
  const itemsById: Record<string, ContentItem> = {};
  const itemIndex: Record<string, number> = {};
  c.items.forEach((item, index) => {
    itemsById[item.id] = item;
    itemIndex[item.id] = index;
  });

  const slots = collectSlots(t.root);
  const slotsById: Record<string, Slot> = {};
  const slotIndex: Record<string, number> = {};
  slots.forEach((slot, index) => {
    slotsById[slot.id] = slot;
    slotIndex[slot.id] = index;
  });

  return {
    template: t,
    content: c,
    slots,
    slotGroup: slotGroupMap(t.root),
    itemsById,
    slotsById,
    itemIndex,
    slotIndex,
  };
}
