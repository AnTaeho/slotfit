// cost: 짝 하나의 나쁨 점수를 항별로 겨눈다(D-13~D-16). 한 번에 한 항만 달라지도록 입력을 통제한다.
import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import type { MatchContext } from '../src/context';
import type { ContentItem, ImageSlot, Role, Slot, TextSlot } from '../src/schema';
import { cost, DUMMY_ITEM_COST, DUMMY_SLOT_COST } from '../src/scoring/cost';
import {
  DROP_COST_BY_PRIORITY, EMPTY_COST_BY_ROLE, FORBIDDEN_COST, ORDER_COST, OVERFLOW_PER_LINE_COST,
  ROLE_MISMATCH_COST, ROLE_UNKNOWN_COST, SHRINK_NEEDED_COST, UNDERFILL_COST,
} from '../src/scoring/weights';

const DIGITS = 9; // 소수 항(너무 짧음·순서)을 더한 값 비교용

const contextOf = (slots: Slot[], items: ContentItem[]): MatchContext =>
  buildContext(
    { id: 't', description: '', root: { id: 'root', type: 'frame', box: { x: 0, y: 0, w: 600, h: 400 }, children: slots } },
    { id: 'c', description: '', items },
  );

// 한 줄짜리 본문 칸: 폭 100, 기본 10px(한글 10자가 한 줄), 최소 5px(한글 20자가 한 줄).
// 높이 14 = 10px 한 줄(10 × 1.4). 5px에서는 높이로 2줄이 들어가지만 maxLines 1이 먼저 막는다.
const oneLineSlot: TextSlot = {
  id: 'body', type: 'text', role: 'body', box: { x: 0, y: 0, w: 100, h: 14 },
  fontSize: 10, minFontSize: 5, maxLines: 1,
};
const imageSlot = (id: string): ImageSlot => ({ id, type: 'image', role: 'image', box: { x: 0, y: 0, w: 100, h: 100 } });
const textItem = (text: string, roleHint?: Role): ContentItem =>
  roleHint === undefined ? { id: 'x', kind: 'text', text, priority: 2 } : { id: 'x', kind: 'text', text, roleHint, priority: 2 };
const imageItem = (id: string): ContentItem => ({ id, kind: 'image', roleHint: 'image', priority: 2 });

// 항목 하나 × 슬롯 하나면 상대 위치가 둘 다 0이라 순서 항은 0이다.
const costOfSingle = (item: ContentItem, slot: Slot): number => cost(item, slot, contextOf([slot], [item]));

const FULL_LINE = '가'.repeat(10); // oneLineSlot을 기본 크기로 꼭 채운다 → 넘침 0, 너무 짧음 0

describe('cost: kind 불일치 (D-15)', () => {
  it('글 항목 × 이미지 슬롯 = FORBIDDEN_COST', () => {
    expect(costOfSingle(textItem(FULL_LINE, 'body'), imageSlot('img'))).toBe(FORBIDDEN_COST);
  });
  it('이미지 항목 × 글 슬롯 = FORBIDDEN_COST', () => {
    expect(costOfSingle(imageItem('p'), oneLineSlot)).toBe(FORBIDDEN_COST);
  });
});

describe('cost: role 항 (D-8, D-14)', () => {
  // 같은 글, 같은 슬롯에서 roleHint만 바꾼다. 넘침·너무 짧음·순서 항은 셋 다 0으로 같다.
  const matched = costOfSingle(textItem(FULL_LINE, 'body'), oneLineSlot);
  const mismatched = costOfSingle(textItem(FULL_LINE, 'title'), oneLineSlot);
  const unknown = costOfSingle(textItem(FULL_LINE), oneLineSlot);

  it('roleHint가 슬롯 role과 같으면 0', () => expect(matched).toBe(0));
  it('다르면 ROLE_MISMATCH_COST', () => expect(mismatched - matched).toBe(ROLE_MISMATCH_COST));
  it('없으면 ROLE_UNKNOWN_COST', () => expect(unknown - matched).toBe(ROLE_UNKNOWN_COST));
});

describe('cost: 넘침 항 (D-14)', () => {
  // 아래 글은 모두 기본 크기에서 한 줄 이상이라 너무 짧음 항이 0이다. role 일치, 순서 0 → cost = 넘침 항.
  const overflowOf = (hangulCount: number): number => costOfSingle(textItem('가'.repeat(hangulCount), 'body'), oneLineSlot);

  it('기본 크기로 들어가면 0', () => {
    expect(overflowOf(10)).toBe(0); // 10px × 10자 = 100px = 1줄
  });
  it('줄이면 들어가면 SHRINK_NEEDED_COST', () => {
    expect(overflowOf(20)).toBe(SHRINK_NEEDED_COST); // 10px에서 2줄, 5px에서 100px = 1줄
  });
  it('minFontSize에서도 넘치면 넘치는 줄마다 OVERFLOW_PER_LINE_COST를 더한다', () => {
    // 5px × 30자 = 150px → 2줄, 담을 수 있는 줄 수 1 → 초과 1줄
    expect(overflowOf(30)).toBe(SHRINK_NEEDED_COST + 1 * OVERFLOW_PER_LINE_COST);
    // 5px × 50자 = 250px → 3줄 → 초과 2줄
    expect(overflowOf(50)).toBe(SHRINK_NEEDED_COST + 2 * OVERFLOW_PER_LINE_COST);
  });
  it('높이가 줄 수보다 먼저 막으면 높이에 들어가는 줄 수로 초과를 센다', () => {
    // maxLines 3이지만 높이 7 = 5px 한 줄(5 × 1.4)뿐 → 담을 수 있는 줄 수 min(3, 1) = 1.
    // 5px × 30자 = 2줄 → 초과 1줄. 너무 짧음 항: 10px × 30자 = 300px = 3줄 = maxLines → 0
    const lowSlot: TextSlot = { ...oneLineSlot, box: { x: 0, y: 0, w: 100, h: 7 }, maxLines: 3 };
    expect(costOfSingle(textItem('가'.repeat(30), 'body'), lowSlot)).toBe(SHRINK_NEEDED_COST + 1 * OVERFLOW_PER_LINE_COST);
  });
});

describe('cost: 너무 짧음 항 (D-14)', () => {
  it('maxLines 4인 칸에 한 줄 분량이면 UNDERFILL_COST × 3/4', () => {
    // used = 10자 × 10px / 폭 100 = 1줄 → underfill = 1 − 1/4 = 0.75
    const fourLineSlot: TextSlot = { ...oneLineSlot, box: { x: 0, y: 0, w: 100, h: 56 }, maxLines: 4 };
    expect(costOfSingle(textItem(FULL_LINE, 'body'), fourLineSlot)).toBeCloseTo(UNDERFILL_COST * 0.75, DIGITS);
  });
  it('빈 글이면 UNDERFILL_COST 전부', () => {
    expect(costOfSingle(textItem('', 'body'), oneLineSlot)).toBe(UNDERFILL_COST);
  });
});

describe('cost: 입력 순서 항 (D-16)', () => {
  // 이미지 항목 count개 × 이미지 슬롯 count개에서 항목 i × 슬롯 s의 cost.
  // 이미지 짝은 넘침·너무 짧음 항이 없고 role도 일치시켜 두었으므로 cost = 순서 항이다.
  const orderCostAt = (count: number, i: number, s: number): number => {
    const slots = Array.from({ length: count }, (_, index) => imageSlot(`s${index}`));
    const items = Array.from({ length: count }, (_, index) => imageItem(`i${index}`));
    const item = items[i];
    const slot = slots[s];
    if (item === undefined || slot === undefined) throw new Error(`범위 밖: 항목 ${i}, 슬롯 ${s}`);
    return cost(item, slot, contextOf(slots, items));
  };

  it('항목 2개 × 슬롯 2개: 같은 상대 위치면 0, 끝과 끝이면 ORDER_COST', () => {
    expect(orderCostAt(2, 0, 0)).toBe(0);
    expect(orderCostAt(2, 1, 1)).toBe(0);
    expect(orderCostAt(2, 0, 1)).toBe(ORDER_COST); // 상대 위치 0 ↔ 1, 차이 1, 제곱 1
    expect(orderCostAt(2, 1, 0)).toBe(ORDER_COST);
  });

  it('항목 3개 × 슬롯 3개: 한 칸 어긋나면 ORDER_COST × 1/4', () => {
    expect(orderCostAt(3, 1, 1)).toBe(0); // 가운데 ↔ 가운데: 0.5 − 0.5
    // 상대 위치 0 ↔ 0.5, 차이 0.5, 제곱 0.25
    expect(orderCostAt(3, 0, 1)).toBeCloseTo(ORDER_COST * 0.25, DIGITS);
  });
});

describe('버림·비움 비용 (D-14)', () => {
  it('DUMMY_SLOT_COST = priority별 버림 비용 표의 값', () => {
    for (const priority of [1, 2, 3] as const) {
      expect(DUMMY_SLOT_COST({ id: 'x', kind: 'text', text: '', priority })).toBe(DROP_COST_BY_PRIORITY[priority]);
    }
  });

  it('DUMMY_ITEM_COST = role별 비움 비용 표의 값', () => {
    for (const role of ['title', 'subtitle', 'body', 'caption'] as const) {
      expect(DUMMY_ITEM_COST({ ...oneLineSlot, role })).toBe(EMPTY_COST_BY_ROLE[role]);
    }
    expect(DUMMY_ITEM_COST(imageSlot('img'))).toBe(EMPTY_COST_BY_ROLE.image);
  });
});
