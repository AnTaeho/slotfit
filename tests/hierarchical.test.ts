// hierarchical: 카드 섞임(F-3)을 막는지, priority 1을 잃을 때 카드를 찢지 않는 flat 해로 물러나는지(D-28, F-7) 확인한다.
import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import type { MatchContext } from '../src/context';
import { hierarchical } from '../src/matchers/hierarchical';
import { hungarian } from '../src/matchers/hungarian';
import type { Content, MatchResult, Template } from '../src/schema';
import { groupSplit } from '../src/validation/rules/groupSplit';
import { contextOf } from './fixtureContexts';

const splitCount = (ctx: MatchContext, result: MatchResult): number =>
  groupSplit.check(ctx, result, { fontSize: {} }).length;

describe('hierarchical: t04-product-cards-3 × c05-product-launch', () => {
  const ctx = contextOf('t04-product-cards-3', 'c05-product-launch');

  it('hierarchical은 카드를 찢지 않고, hungarian은 찢는다', () => {
    expect(splitCount(ctx, hierarchical.match(ctx))).toBe(0);
    expect(splitCount(ctx, hungarian.match(ctx))).toBeGreaterThanOrEqual(1);
  });
});

const droppedPriorityOne = (ctx: MatchContext, result: MatchResult): string[] =>
  result.dropped.filter((contentId) => ctx.itemsById[contentId]?.priority === 1);

// F-7이던 쌍: 카드 한 장뿐인 템플릿에서 계층 단계만 돌면 카드가 자리를 다 차지해 제목이 버려진다.
// flat 해는 제목을 카드 소제목 칸에 넣고 소제목(p2)을 버린다. 카드를 찢지 않으므로 hierarchical은 이 해로 물러난다(D-28).
describe('hierarchical: t09-single-card × c09-title-and-card (flat 해로 물러남)', () => {
  const ctx = contextOf('t09-single-card', 'c09-title-and-card');
  const hier = hierarchical.match(ctx);
  const flat = hungarian.match(ctx);

  it('hierarchical은 title을 버리지 않는다', () => {
    expect(hier.dropped).not.toContain('title');
    expect(droppedPriorityOne(ctx, hier)).toEqual([]);
  });

  it('찢어진 카드가 없다', () => {
    expect(splitCount(ctx, hier)).toBe(0);
  });

  it('결과가 flat 해(hungarian)와 같다', () => {
    expect(hier).toEqual(flat);
  });
});

// flat 해가 priority 1을 더 살리더라도 카드를 찢으면 물러나지 않는다.
// 본문 두 칸짜리 카드 두 장에 p1 본문 세 개짜리 콘텐츠 그룹 하나.
//   계층: g1을 카드 한 장에 넣어 둘만 들어가고 하나를 버린다(p1 유실 1, 찢어짐 0).
//   flat: 셋을 다 넣지만 두 카드에 걸친다(p1 유실 0, 찢어짐 1).
describe('hierarchical: flat 해가 카드를 찢으면 물러나지 않는다', () => {
  const box = { x: 0, y: 0, w: 200, h: 40 };
  const bodySlot = (id: string) => ({ id, type: 'text', role: 'body', box, fontSize: 16, minFontSize: 12, maxLines: 2 }) as const;
  const template: Template = {
    id: 't-two-cards', description: '본문 두 칸짜리 카드 두 장',
    root: {
      id: 'root', type: 'frame', box: { x: 0, y: 0, w: 400, h: 200 },
      children: [
        { id: 'cardA', type: 'group', box, children: [bodySlot('a1'), bodySlot('a2')] },
        { id: 'cardB', type: 'group', box, children: [bodySlot('b1'), bodySlot('b2')] },
      ],
    },
  };
  const content: Content = {
    id: 'c-three-p1', description: '한 카드에 들어가야 하는 p1 본문 셋',
    items: ['x1', 'x2', 'x3'].map((id) => ({ id, kind: 'text', roleHint: 'body', text: '짧은 본문', groupId: 'g1', priority: 1 })),
  };
  const ctx = buildContext(template, content);
  const hier = hierarchical.match(ctx);
  const flat = hungarian.match(ctx);

  it('전제: flat 해는 p1을 다 넣지만 카드를 찢는다', () => {
    expect(droppedPriorityOne(ctx, flat)).toEqual([]);
    expect(splitCount(ctx, flat)).toBe(1);
  });

  it('hierarchical은 p1 하나를 버린 계층 결과를 그대로 낸다', () => {
    expect(droppedPriorityOne(ctx, hier)).toHaveLength(1);
    expect(splitCount(ctx, hier)).toBe(0);
    expect(hier).not.toEqual(flat);
  });
});
