// 규칙 목록을 전부 실행해 위반을 합친다. 위반 순서 = 규칙 순서, 규칙 안에서는 규칙이 낸 순서.
import type { MatchContext } from '../context';
import type { Adjustments, MatchResult, Violation } from '../schema';
import { contentDropped } from './rules/contentDropped';
import { emptySlot } from './rules/emptySlot';
import { groupSplit } from './rules/groupSplit';
import { overflow } from './rules/overflow';
import { priorityDropped } from './rules/priorityDropped';
import { roleMismatch } from './rules/roleMismatch';
import { titleMissing } from './rules/titleMissing';
import type { Rule } from './types';

const DEFAULT_RULES: Rule[] = [overflow, titleMissing, emptySlot, priorityDropped, contentDropped, groupSplit, roleMismatch];

export function validate(
  ctx: MatchContext,
  result: MatchResult,
  adj: Adjustments,
  rules: Rule[] = DEFAULT_RULES,
): Violation[] {
  return rules.flatMap((rule) => rule.check(ctx, result, adj));
}
