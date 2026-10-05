// 이름 → matcher 레지스트리. 구현 여부(implemented)로 테스트와 bench가 건너뛸 대상을 가린다.
// oracleOnly인 matcher(bruteForce)는 작은 입력에서 정답 확인용으로만 쓴다(D-17).
import type { MatchContext } from '../context';
import { bruteForce, bruteForceFits } from './bruteForce';
import { greedy } from './greedy';
import { hierarchical } from './hierarchical';
import { hungarian } from './hungarian';
import type { Matcher } from './types';

export type { Matcher } from './types';
export type RegistryEntry = { matcher: Matcher; implemented: boolean; oracleOnly?: boolean };

export const REGISTRY: RegistryEntry[] = [
  { matcher: greedy, implemented: true },
  { matcher: bruteForce, implemented: true, oracleOnly: true }, // D-17: bench·render:all에서 뺀다
  { matcher: hungarian, implemented: true },
  { matcher: hierarchical, implemented: false }, // TODO(Step 3): 구현 후 true로 바꾼다.
];

export function findMatcher(name: string): RegistryEntry | undefined {
  return REGISTRY.find((entry) => entry.matcher.name === name);
}

export function matcherNames(): string[] {
  return REGISTRY.map((entry) => entry.matcher.name);
}

// 이 matcher를 이 ctx에 돌려도 되는가. oracleOnly면 bruteForce 크기 상한 이내일 때만, 아니면 항상.
export function withinLimit(entry: RegistryEntry, ctx: MatchContext): boolean {
  return entry.oracleOnly === true ? bruteForceFits(ctx) : true;
}
