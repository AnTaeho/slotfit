// bench 공용: template × content 쌍 만들기, 쌍 실행 + golden 채점, 합계 내기, 표·결과 파일 쓰기.
// evaluate.ts(matcher 비교)와 sweep.ts(가중치 민감도)가 같이 쓴다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { goldenKey, loadAllGoldens } from '../src/io/loader';
import type { Matcher } from '../src/matchers';
import { countViolations, run } from '../src/pipeline';
import type { Content, Golden, PipelineResult, Status, Template } from '../src/schema';
import { DEFAULT_WEIGHTS } from '../src/scoring/weights';
import type { Weights } from '../src/scoring/weights';
import { scoreGolden } from './golden';
import type { GoldenScore } from './golden';

const RESULTS_DIR = fileURLToPath(new URL('./results/', import.meta.url));
export const NONE = '-';

export type Pair = { key: string; template: Template; content: Content; golden: Golden | undefined };
// 쌍 하나를 matcher 하나로 실행한 결과. golden이 없는 쌍이면 goldenScore는 undefined.
export type ScoredRun = { pair: Pair; result: PipelineResult; goldenScore: GoldenScore | undefined };
// 여러 쌍에 걸친 합계.
export type Tally = {
  goldenSlots: number; goldenHits: number;
  errors: number; warns: number; p1Dropped: number; groupSplits: number;
  status: Record<Status, number>;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// 로컬 시각 기준 YYYYMMDD-HHmm.
export function stamp(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

// 모든 template × content 쌍(템플릿 순 → 콘텐츠 순). golden이 있으면 붙인다.
export function buildPairs(templates: Template[], contents: Content[]): Pair[] {
  const goldens = new Map(loadAllGoldens().map((golden) => [goldenKey(golden.templateId, golden.contentId), golden]));
  return templates.flatMap((template) =>
    contents.map((content) => {
      const key = goldenKey(template.id, content.id);
      return { key, template, content, golden: goldens.get(key) };
    }),
  );
}

export function runScored(matcher: Matcher, pair: Pair, weights: Weights = DEFAULT_WEIGHTS): ScoredRun {
  const result = run(pair.template, pair.content, matcher, weights);
  // D-7: 모양이 같은 카드끼리 통째로 바꾼 배치도 정답으로 센다(bench/golden.ts).
  const goldenScore =
    pair.golden === undefined ? undefined : scoreGolden(pair.template, pair.golden.assignment, result.assignment);
  return { pair, result, goldenScore };
}

export function groupSplitCount(result: PipelineResult): number {
  return result.violations.filter((v) => v.ruleId === 'groupSplit').length;
}

function p1DroppedCount(result: PipelineResult, content: Content): number {
  return result.dropped.filter((id) => content.items.find((item) => item.id === id)?.priority === 1).length;
}

export function tally(runs: readonly ScoredRun[]): Tally {
  const total: Tally = {
    goldenSlots: 0, goldenHits: 0, errors: 0, warns: 0, p1Dropped: 0, groupSplits: 0,
    status: { accepted: 0, degraded: 0, rejected: 0 },
  };
  for (const { pair, result, goldenScore } of runs) {
    const counts = countViolations(result.violations);
    total.status[result.status] += 1;
    total.errors += counts.errors;
    total.warns += counts.warns;
    total.p1Dropped += p1DroppedCount(result, pair.content);
    total.groupSplits += groupSplitCount(result);
    if (goldenScore !== undefined) {
      total.goldenSlots += goldenScore.total;
      total.goldenHits += goldenScore.hits;
    }
  }
  return total;
}

// golden이 있는 쌍에서 맞은 슬롯 비율. golden 쌍이 없으면 "-".
export function goldenMatchText(total: Tally): string {
  return total.goldenSlots === 0 ? NONE : (total.goldenHits / total.goldenSlots).toFixed(2);
}

// accepted/degraded/rejected 쌍 수.
export function statusText(total: Tally): string {
  return `${total.status.accepted}/${total.status.degraded}/${total.status.rejected}`;
}

export function toTable(header: string[], rows: string[][]): string {
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

// bench/results/<name>.md로 저장하고 같은 내용을 stdout에도 찍는다.
export function saveReport(name: string, report: string): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const path = join(RESULTS_DIR, `${name}.md`);
  writeFileSync(path, report, 'utf8');
  console.log(report);
  console.log(`저장: ${path}`);
}
