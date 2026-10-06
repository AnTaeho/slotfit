// validation 규칙 다섯 개(D-20)를 하나씩: 작은 인라인 입력으로 「위반 없음」과 「위반 있음」을 직접 확인한다.
import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import type { Adjustments, Assignment, Content, MatchResult, Template } from '../src/schema';
import { groupSplit } from '../src/validation/rules/groupSplit';
import { overflow } from '../src/validation/rules/overflow';
import { priorityDropped } from '../src/validation/rules/priorityDropped';
import { roleMismatch } from '../src/validation/rules/roleMismatch';
import { titleMissing } from '../src/validation/rules/titleMissing';

// 제목 + 카드 2장(소제목·본문) + 그룹 밖 캡션 + 그룹 밖 이미지.
// 글 칸은 모두 폭 100, 기본 10px(한글 10자가 한 줄), 최소 5px, 한 줄.
const box = { x: 0, y: 0, w: 100, h: 14 };
const textSlot = (id: string, role: 'title' | 'subtitle' | 'body' | 'caption') =>
  ({ id, type: 'text', role, box, fontSize: 10, minFontSize: 5, maxLines: 1 }) as const;
const template: Template = {
  id: 't-rules', description: '제목 + 카드 2장 + 그룹 밖 캡션·이미지',
  root: {
    id: 'root', type: 'frame', box: { x: 0, y: 0, w: 600, h: 400 },
    children: [
      textSlot('title', 'title'),
      { id: 'cardA', type: 'group', box, children: [textSlot('a-sub', 'subtitle'), textSlot('a-body', 'body')] },
      { id: 'cardB', type: 'group', box, children: [textSlot('b-sub', 'subtitle'), textSlot('b-body', 'body')] },
      textSlot('note', 'caption'),
      { id: 'photo', type: 'image', role: 'image', box },
    ],
  },
};
const SLOT_IDS = ['title', 'a-sub', 'a-body', 'b-sub', 'b-body', 'note', 'photo'];

const LONG = '가'.repeat(20); // 10px에서 2줄(넘침), 5px에서 1줄(들어감)
const content: Content = {
  id: 'c-rules', description: '제목, 카드 g1(소제목·본문), 긴 글, roleHint 없는 글, 사진',
  items: [
    { id: 'head', kind: 'text', roleHint: 'title', text: '제목', priority: 1 },
    { id: 'g1-sub', kind: 'text', roleHint: 'subtitle', text: '소제목', groupId: 'g1', priority: 2 },
    { id: 'g1-body', kind: 'text', roleHint: 'body', text: '본문', groupId: 'g1', priority: 2 },
    { id: 'long', kind: 'text', roleHint: 'body', text: LONG, priority: 2 },
    { id: 'plain', kind: 'text', text: '힌트 없음', priority: 3 },
    { id: 'pic', kind: 'image', roleHint: 'image', priority: 3 },
  ],
};
const ctx = buildContext(template, content);
const NO_ADJ: Adjustments = { fontSize: {} };

// placed에 적은 슬롯만 채우고 나머지는 비운다. totalCost는 규칙이 보지 않는다.
const resultOf = (placed: Record<string, string>, dropped: string[] = []): MatchResult => {
  const assignment: Assignment = SLOT_IDS.map((slotId) => ({ slotId, contentId: placed[slotId] ?? null }));
  return { assignment, dropped, totalCost: 0 };
};

describe('overflow (error)', () => {
  it('들어가는 글, 빈 슬롯, 이미지 짝은 위반이 아니다', () => {
    const result = resultOf({ title: 'head', 'a-body': 'g1-body', photo: 'pic' });
    expect(overflow.check(ctx, result, NO_ADJ)).toEqual([]);
  });

  it('기본 크기에서 줄 수를 넘으면 그 슬롯·항목에 위반 1개', () => {
    const violations = overflow.check(ctx, resultOf({ title: 'head', 'a-body': 'long' }), NO_ADJ);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ ruleId: 'overflow', severity: 'error', slotId: 'a-body', contentId: 'long' });
  });

  it('adj.fontSize가 있으면 그 크기로 잰다: 5px로 줄였으면 같은 글이 들어간다', () => {
    const result = resultOf({ 'a-body': 'long' });
    expect(overflow.check(ctx, result, { fontSize: { 'a-body': 5 } })).toEqual([]);
  });

  it('adj.fontSize는 그 슬롯에만 적용된다: 다른 슬롯을 줄여도 위반은 남는다', () => {
    const violations = overflow.check(ctx, resultOf({ 'a-body': 'long' }), { fontSize: { 'b-body': 5 } });
    expect(violations.map((v) => v.slotId)).toEqual(['a-body']);
  });
});

describe('titleMissing (error)', () => {
  it('title 슬롯이 차 있으면 위반이 아니다', () => {
    expect(titleMissing.check(ctx, resultOf({ title: 'head' }), NO_ADJ)).toEqual([]);
  });

  it('title 슬롯에 title이 아닌 항목이 들어가도 이 규칙의 위반은 아니다', () => {
    expect(titleMissing.check(ctx, resultOf({ title: 'g1-sub' }), NO_ADJ)).toEqual([]);
  });

  it('title 슬롯이 비면 위반 1개', () => {
    const violations = titleMissing.check(ctx, resultOf({ 'a-sub': 'g1-sub' }), NO_ADJ);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ ruleId: 'titleMissing', severity: 'error', slotId: 'title' });
  });

  it('title 슬롯이 없는 템플릿이면 다 비어도 위반이 아니다', () => {
    const noTitle: Template = {
      id: 't-no-title', description: '본문 칸 하나',
      root: { id: 'root', type: 'frame', box, children: [textSlot('only', 'body')] },
    };
    const result: MatchResult = { assignment: [{ slotId: 'only', contentId: null }], dropped: [], totalCost: 0 };
    expect(titleMissing.check(buildContext(noTitle, content), result, NO_ADJ)).toEqual([]);
  });
});

describe('priorityDropped (error)', () => {
  it('priority 2·3만 버려졌으면 위반이 아니다', () => {
    expect(priorityDropped.check(ctx, resultOf({ title: 'head' }, ['long', 'plain', 'pic']), NO_ADJ)).toEqual([]);
  });

  it('priority 1이 버려지면 그 항목에 위반 1개', () => {
    const violations = priorityDropped.check(ctx, resultOf({}, ['head', 'plain']), NO_ADJ);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ ruleId: 'priorityDropped', severity: 'error', contentId: 'head' });
  });
});

describe('groupSplit (error)', () => {
  it('같은 groupId가 한 카드 안에 있으면 위반이 아니다', () => {
    expect(groupSplit.check(ctx, resultOf({ 'a-sub': 'g1-sub', 'a-body': 'g1-body' }), NO_ADJ)).toEqual([]);
  });

  it('두 카드에 흩어지면 위반 1개', () => {
    const violations = groupSplit.check(ctx, resultOf({ 'a-sub': 'g1-sub', 'b-body': 'g1-body' }), NO_ADJ);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ ruleId: 'groupSplit', severity: 'error', slotId: 'a-sub' });
  });

  it('카드 안과 그룹 밖(null)에 섞여도 위반 1개', () => {
    const violations = groupSplit.check(ctx, resultOf({ 'a-sub': 'g1-sub', note: 'g1-body' }), NO_ADJ);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.detail).toContain('그룹 밖');
  });

  it('둘 다 그룹 밖이면 한 곳에 모인 것이라 위반이 아니다', () => {
    expect(groupSplit.check(ctx, resultOf({ title: 'g1-sub', note: 'g1-body' }), NO_ADJ)).toEqual([]);
  });

  it('버려진 항목은 세지 않는다: 하나만 배치되고 하나는 버려졌으면 위반이 아니다', () => {
    expect(groupSplit.check(ctx, resultOf({ 'a-sub': 'g1-sub' }, ['g1-body']), NO_ADJ)).toEqual([]);
  });

  it('groupId가 없는 항목은 어디에 놓여도 위반이 아니다', () => {
    expect(groupSplit.check(ctx, resultOf({ 'a-sub': 'head', 'b-body': 'long', note: 'plain' }), NO_ADJ)).toEqual([]);
  });
});

describe('roleMismatch (warn)', () => {
  it('roleHint와 슬롯 role이 같으면 위반이 아니다', () => {
    const result = resultOf({ title: 'head', 'a-sub': 'g1-sub', 'a-body': 'g1-body', photo: 'pic' });
    expect(roleMismatch.check(ctx, result, NO_ADJ)).toEqual([]);
  });

  it('roleHint가 없는 항목은 어느 칸에 들어가도 위반이 아니다(D-8)', () => {
    expect(roleMismatch.check(ctx, resultOf({ title: 'plain' }), NO_ADJ)).toEqual([]);
  });

  it('roleHint와 슬롯 role이 다르면 짝마다 warn 1개', () => {
    const violations = roleMismatch.check(ctx, resultOf({ title: 'g1-sub', 'a-sub': 'head', 'a-body': 'g1-body' }), NO_ADJ);
    expect(violations.map((v) => [v.severity, v.slotId, v.contentId])).toEqual([
      ['warn', 'title', 'g1-sub'],
      ['warn', 'a-sub', 'head'],
    ]);
  });
});
