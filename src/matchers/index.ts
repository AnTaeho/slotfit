// 이름 → matcher 레지스트리. 구현 여부(implemented)로 테스트와 bench가 건너뛸 대상을 가린다.
import { bruteForce } from './bruteForce';
import { greedy } from './greedy';
import { hierarchical } from './hierarchical';
import { hungarian } from './hungarian';
import type { Matcher } from './types';

export type { Matcher } from './types';
export type RegistryEntry = { matcher: Matcher; implemented: boolean };

export const REGISTRY: RegistryEntry[] = [
  { matcher: greedy, implemented: true },
  { matcher: bruteForce, implemented: false }, // TODO(Step 2): 구현 후 true로 바꾼다.
  { matcher: hungarian, implemented: false }, // TODO(Step 2): 구현 후 true로 바꾼다.
  { matcher: hierarchical, implemented: false }, // TODO(Step 3): 구현 후 true로 바꾼다.
];

export function findMatcher(name: string): RegistryEntry | undefined {
  return REGISTRY.find((entry) => entry.matcher.name === name);
}

export function matcherNames(): string[] {
  return REGISTRY.map((entry) => entry.matcher.name);
}
