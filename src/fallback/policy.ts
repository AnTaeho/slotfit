// fallback 단계의 적용 순서와 반복 상한.
import { dropLowPriority, shrinkFont } from './steps';
import type { FallbackStep } from './types';

export { MAX_ITERATIONS } from '../scoring/weights';

// D-21: 먼저 글자를 줄이고(shrinkFont), 그래도 넘치면 낮은 priority 항목을 버린다(dropLowPriority).
export const POLICY: FallbackStep[] = [shrinkFont, dropLowPriority];
