// 템플릿과 콘텐츠에서 매칭에 필요한 파생 정보를 한 번 계산해 둔다.
import type { Content, ContentItem, Slot, Template } from './schema';
import { collectSlots, slotGroupMap } from './tree/traverse';

export type MatchContext = {
  template: Template; content: Content;
  slots: Slot[];                               // DFS 순서
  slotGroup: Record<string, string | null>;    // slotId → GroupNode id
  itemsById: Record<string, ContentItem>;
};

export function buildContext(t: Template, c: Content): MatchContext {
  const itemsById: Record<string, ContentItem> = {};
  for (const item of c.items) itemsById[item.id] = item;
  return {
    template: t,
    content: c,
    slots: collectSlots(t.root),
    slotGroup: slotGroupMap(t.root),
    itemsById,
  };
}
