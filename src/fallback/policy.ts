// fallback 단계의 적용 순서와 반복 상한.
import type { FallbackStep } from './types';

export { MAX_ITERATIONS } from '../scoring/weights';

// TODO(Step 4): 사용자가 정한 순서대로 shrinkFont, dropLowPriority를 넣는다.
export const POLICY: FallbackStep[] = [];
