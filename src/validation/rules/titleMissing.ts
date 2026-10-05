// titleMissing 규칙: title 슬롯이 비었거나 title이 아닌 것이 들어갔는지 본다. 미구현.
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

// TODO(Step 4): role이 title인 슬롯의 contentId가 null이면 위반으로 낸다.
function check(_ctx: MatchContext, _r: MatchResult, _adj: Adjustments): Violation[] {
  return [];
}

export const titleMissing: Rule = {
  id: 'titleMissing',
  severity: 'warn', // TODO(Step 4): severity는 사용자 결정
  check,
};
