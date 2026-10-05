// groupSplit 규칙: 같은 groupId의 콘텐츠가 서로 다른 그룹 슬롯에 흩어졌는지 본다. 미구현.
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

// TODO(Step 3): 콘텐츠 groupId별로 배치된 슬롯의 slotGroup을 모아 둘 이상이면 위반을 낸다.
function check(_ctx: MatchContext, _r: MatchResult, _adj: Adjustments): Violation[] {
  return [];
}

export const groupSplit: Rule = {
  id: 'groupSplit',
  severity: 'warn', // TODO(Step 3): severity는 사용자 결정
  check,
};
