// fixtures 디렉터리에서 템플릿/콘텐츠/golden JSON을 읽고 zod로 검증한다.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { ContentSchema, GoldenSchema, TemplateSchema } from '../schema';
import type { Content, Golden, Template } from '../schema';

// 가정: 파일 이름은 `<id>.json`, golden은 `<templateId>__<contentId>.json`.
export const FIXTURES_DIR = fileURLToPath(new URL('../../fixtures/', import.meta.url));

function readJson<T>(path: string, schema: z.ZodType<T>): T {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`fixture 검증 실패: ${path}\n${parsed.error.message}`);
  }
  return parsed.data;
}

function readAll<T>(dir: string, schema: z.ZodType<T>): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(join(dir, name), schema));
}

export function goldenKey(templateId: string, contentId: string): string {
  return `${templateId}__${contentId}`;
}

export function loadTemplate(id: string, fixturesDir: string = FIXTURES_DIR): Template {
  return readJson(join(fixturesDir, 'templates', `${id}.json`), TemplateSchema);
}

export function loadContent(id: string, fixturesDir: string = FIXTURES_DIR): Content {
  return readJson(join(fixturesDir, 'contents', `${id}.json`), ContentSchema);
}

// golden이 없는 쌍이면 null.
export function loadGolden(templateId: string, contentId: string, fixturesDir: string = FIXTURES_DIR): Golden | null {
  const path = join(fixturesDir, 'golden', `${goldenKey(templateId, contentId)}.json`);
  return existsSync(path) ? readJson(path, GoldenSchema) : null;
}

export function loadAllTemplates(fixturesDir: string = FIXTURES_DIR): Template[] {
  return readAll(join(fixturesDir, 'templates'), TemplateSchema);
}

export function loadAllContents(fixturesDir: string = FIXTURES_DIR): Content[] {
  return readAll(join(fixturesDir, 'contents'), ContentSchema);
}

export function loadAllGoldens(fixturesDir: string = FIXTURES_DIR): Golden[] {
  return readAll(join(fixturesDir, 'golden'), GoldenSchema);
}
