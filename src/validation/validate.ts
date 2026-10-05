// 규칙 목록을 전부 실행해 위반을 합친다.
import type { MatchContext } from '../context';
import type { Adjustments, MatchResult, Violation } from '../schema';
import { groupSplit } from './rules/groupSplit';
import { overflow } from './rules/overflow';
import { priorityDropped } from './rules/priorityDropped';
import { roleMismatch } from './rules/roleMismatch';
import { titleMissing } from './rules/titleMissing';
import type { Rule } from './types';

export const DEFAULT_RULES: Rule[] = [overflow, titleMissing, priorityDropped, groupSplit, roleMismatch];

export function validate(
  ctx: MatchContext,
  r: MatchResult,
  adj: Adjustments,
  rules: Rule[] = DEFAULT_RULES,
): Violation[] {
  return rules.flatMap((rule) => rule.check(ctx, r, adj));
}
