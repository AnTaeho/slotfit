// hierarchical matcher: 그룹끼리 먼저 짝짓고 그룹 안을 채우는 2단계 매칭. 미구현.
import type { MatchContext } from '../context';
import type { MatchResult } from '../schema';
import type { Matcher } from './types';

// TODO(Step 3): 그룹↔그룹 cost(그 쌍 내부 Hungarian의 최적 cost)로 그룹끼리 Hungarian 매칭한다.
// 짝지어진 그룹 쌍마다 내부를 Hungarian으로 채운다.
// 그룹에 속하지 않은 슬롯과 항목은 마지막에 따로 매칭한다.
function match(_ctx: MatchContext): MatchResult {
  throw new Error('TODO: Step 3');
}

export const hierarchical: Matcher = { name: 'hierarchical', match };
