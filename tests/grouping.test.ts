// findSplitGroups: 배치에서 찢어진 콘텐츠 그룹을 찾는 공용 함수를 작은 인라인 입력으로 확인한다.
import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import { findSplitGroups } from '../src/grouping';
import type { Assignment, Content, Template } from '../src/schema';

// 카드 2장(소제목·본문) + 그룹 밖 캡션.
const box = { x: 0, y: 0, w: 100, h: 14 };
const textSlot = (id: string, role: 'subtitle' | 'body' | 'caption') =>
  ({ id, type: 'text', role, box, fontSize: 10, minFontSize: 5, maxLines: 1 }) as const;
const template: Template = {
  id: 't-grouping', description: '카드 2장 + 그룹 밖 캡션',
  root: {
    id: 'root', type: 'frame', box: { x: 0, y: 0, w: 600, h: 400 },
    children: [
      { id: 'cardA', type: 'group', box, children: [textSlot('a-sub', 'subtitle'), textSlot('a-body', 'body')] },
      { id: 'cardB', type: 'group', box, children: [textSlot('b-sub', 'subtitle'), textSlot('b-body', 'body')] },
      textSlot('note', 'caption'),
    ],
  },
};
const SLOT_IDS = ['a-sub', 'a-body', 'b-sub', 'b-body', 'note'];

// 콘텐츠 그룹 g2가 g1보다 먼저 나온다. free는 groupId가 없다.
const content: Content = {
  id: 'c-grouping', description: '카드 g2·g1과 groupId 없는 글',
  items: [
    { id: 'g2-sub', kind: 'text', roleHint: 'subtitle', text: '둘', groupId: 'g2', priority: 2 },
    { id: 'g1-sub', kind: 'text', roleHint: 'subtitle', text: '하나', groupId: 'g1', priority: 2 },
    { id: 'g1-body', kind: 'text', roleHint: 'body', text: '본문', groupId: 'g1', priority: 2 },
    { id: 'g2-body', kind: 'text', roleHint: 'body', text: '본문', groupId: 'g2', priority: 2 },
    { id: 'free', kind: 'text', text: '낱개', priority: 3 },
  ],
};
const ctx = buildContext(template, content);

// placed에 적은 슬롯만 채우고 나머지는 비운다.
const assignmentOf = (placed: Record<string, string>): Assignment =>
  SLOT_IDS.map((slotId) => ({ slotId, contentId: placed[slotId] ?? null }));

describe('findSplitGroups', () => {
  it('그룹마다 한 카드 안에 있으면 빈 목록', () => {
    const assignment = assignmentOf({ 'a-sub': 'g1-sub', 'a-body': 'g1-body', 'b-sub': 'g2-sub', 'b-body': 'g2-body' });
    expect(findSplitGroups(ctx, assignment)).toEqual([]);
  });

  it('두 카드에 흩어진 그룹을 배치된 (항목, 슬롯)과 함께 돌려준다. 항목은 입력 순서', () => {
    const assignment = assignmentOf({ 'b-body': 'g1-body', 'a-sub': 'g1-sub' });
    expect(findSplitGroups(ctx, assignment)).toEqual([
      { groupId: 'g1', placed: [{ contentId: 'g1-sub', slotId: 'a-sub' }, { contentId: 'g1-body', slotId: 'b-body' }] },
    ]);
  });

  it('카드 안과 그룹 밖에 걸쳐도 찢어진 것이다', () => {
    const assignment = assignmentOf({ 'a-sub': 'g1-sub', note: 'g1-body' });
    expect(findSplitGroups(ctx, assignment).map((group) => group.groupId)).toEqual(['g1']);
  });

  it('여러 그룹이 찢어지면 groupId가 콘텐츠에 처음 나온 순서로 돌려준다', () => {
    const assignment = assignmentOf({ 'a-sub': 'g1-sub', 'b-body': 'g1-body', 'b-sub': 'g2-sub', 'a-body': 'g2-body' });
    expect(findSplitGroups(ctx, assignment).map((group) => group.groupId)).toEqual(['g2', 'g1']);
  });

  it('배치된 항목이 하나뿐이거나 groupId가 없으면 찢어지지 않았다', () => {
    expect(findSplitGroups(ctx, assignmentOf({ 'a-sub': 'g1-sub', 'b-body': 'free' }))).toEqual([]);
  });

  it('입력 assignment를 바꾸지 않는다', () => {
    const assignment = assignmentOf({ 'a-sub': 'g1-sub', 'b-body': 'g1-body' });
    const before = structuredClone(assignment);
    findSplitGroups(ctx, assignment);
    expect(assignment).toEqual(before);
  });
});
