// hierarchical: 카드 섞임(F-3)을 막는지, 그리고 전역 최적이 아닌 알려진 반례가 그대로인지 확인한다.
import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import type { MatchContext } from '../src/context';
import { loadContent, loadTemplate } from '../src/io/loader';
import { hierarchical } from '../src/matchers/hierarchical';
import { hungarian } from '../src/matchers/hungarian';
import type { MatchResult } from '../src/schema';
import { groupSplit } from '../src/validation/rules/groupSplit';

const ctxOf = (t: string, c: string): MatchContext => buildContext(loadTemplate(t), loadContent(c));
const splits = (ctx: MatchContext, r: MatchResult): number => groupSplit.check(ctx, r, { fontSize: {} }).length;

describe('hierarchical: t04-product-cards-3 × c05-product-launch', () => {
  const ctx = ctxOf('t04-product-cards-3', 'c05-product-launch');

  it('hierarchical은 카드를 찢지 않고, hungarian은 찢는다', () => {
    expect(splits(ctx, hierarchical.match(ctx))).toBe(0);
    expect(splits(ctx, hungarian.match(ctx))).toBeGreaterThanOrEqual(1);
  });
});

// 알려진 한계를 고정하는 테스트: 카드 한 장뿐인 템플릿에서 카드가 자리를 다 차지해 제목이 버려진다.
// flat hungarian은 제목을 카드 소제목 칸에 넣고 소제목을 버려 더 싸다. 계층 매칭은 전역 최적이 아니다.
describe('hierarchical: t09-single-card × c09-title-and-card (전역 최적 아님)', () => {
  const ctx = ctxOf('t09-single-card', 'c09-title-and-card');
  const hier = hierarchical.match(ctx);
  const flat = hungarian.match(ctx);

  it('hierarchical totalCost > hungarian totalCost', () => {
    expect(hier.totalCost).toBeGreaterThan(flat.totalCost);
  });

  it('hierarchical은 title을 버린다', () => {
    expect(hier.dropped).toContain('title');
  });
});
