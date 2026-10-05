// priorityDropped 규칙: priority 1 콘텐츠가 버려졌는지 본다. 미구현.
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import type { Rule } from '../types';

// TODO(Step 4): dropped 중 priority가 1인 항목마다 위반을 낸다.
function check(_ctx: MatchContext, _r: MatchResult, _adj: Adjustments): Violation[] {
  return [];
}

export const priorityDropped: Rule = {
  id: 'priorityDropped',
  severity: 'warn', // TODO(Step 4): severity는 사용자 결정
  check,
};
