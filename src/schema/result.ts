// 매칭/검증/파이프라인 결과 타입과 golden 파일 스키마.
import { z } from 'zod';

export type Assignment = { slotId: string; contentId: string | null }[];
export type MatchResult = {
  assignment: Assignment;   // 모든 슬롯이 정확히 한 번 등장
  dropped: string[];
  totalCost: number;
};
export type Severity = 'error' | 'warn';
export type Violation = {
  ruleId: string; severity: Severity; slotId?: string; contentId?: string; detail: string;
};
export type Adjustments = { fontSize: Record<string, number> }; // fallback이 조정하는 렌더 상태
export type Status = 'accepted' | 'degraded' | 'rejected';
export type PipelineResult = {
  status: Status; matcher: string;
  assignment: Assignment; dropped: string[]; adjustments: Adjustments;
  violations: Violation[]; trace: string[];
};

// 사람이 적은 정답 배치 파일(fixtures/golden/<templateId>__<contentId>.json).
export type Golden = { templateId: string; contentId: string; assignment: Assignment; note?: string };

export const AssignmentSchema: z.ZodType<Assignment> = z.array(
  z.strictObject({ slotId: z.string().min(1), contentId: z.string().min(1).nullable() }),
);

export const GoldenSchema: z.ZodType<Golden> = z.strictObject({
  templateId: z.string().min(1),
  contentId: z.string().min(1),
  assignment: AssignmentSchema,
  note: z.string().optional(),
});
