// roleMismatch 규칙: 콘텐츠 roleHint와 슬롯 role이 다른지 본다. 미구현.
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

// TODO(Step 4): 배치된 쌍마다 roleHint가 있고 slot.role과 다르면 위반을 낸다.
function check(_ctx: MatchContext, _r: MatchResult, _adj: Adjustments): Violation[] {
  return [];
}

export const roleMismatch: Rule = {
  id: 'roleMismatch',
  severity: 'warn', // TODO(Step 4): severity는 사용자 결정
  check,
};
