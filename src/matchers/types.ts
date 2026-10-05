// 모든 배치 알고리즘이 따르는 공통 인터페이스.
import type { MatchContext } from '../context';
import type { MatchResult } from '../schema';

export type Matcher = { name: string; match(ctx: MatchContext): MatchResult };
