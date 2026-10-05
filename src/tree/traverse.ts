// 템플릿 트리를 DFS로 돌며 슬롯과 그룹을 모은다.
import type { GroupNode, Slot, TemplateNode } from '../schema';

// DFS(전위) 순서의 슬롯 목록.
export function collectSlots(root: TemplateNode): Slot[] {
  if (root.type === 'text' || root.type === 'image') return [root];
  return root.children.flatMap(collectSlots);
}

// DFS(전위) 순서의 그룹 노드 목록.
export function collectGroups(root: TemplateNode): GroupNode[] {
  if (root.type === 'text' || root.type === 'image') return [];
  const nested = root.children.flatMap(collectGroups);
  return root.type === 'group' ? [root, ...nested] : nested;
}

// slotId → 소속 GroupNode id. 그룹 밖이면 null.
// 가정: 그룹이 중첩되면 가장 가까운(안쪽) 그룹을 소속으로 본다.
export function slotGroupMap(root: TemplateNode): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  const walk = (node: TemplateNode, groupId: string | null): void => {
    if (node.type === 'text' || node.type === 'image') {
      map[node.id] = groupId;
      return;
    }
    const next = node.type === 'group' ? node.id : groupId;
    for (const child of node.children) walk(child, next);
  };
  walk(root, null);
  return map;
}
