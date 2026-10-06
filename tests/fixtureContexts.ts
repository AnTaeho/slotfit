// 테스트용 fixture 도우미: id로 MatchContext를 만들거나 fixture 전 조합의 MatchContext를 모은다.
import { buildContext } from '../src/context';
import type { MatchContext } from '../src/context';
import { loadAllContents, loadAllTemplates, loadContent, loadTemplate } from '../src/io/loader';

export function contextOf(templateId: string, contentId: string): MatchContext {
  return buildContext(loadTemplate(templateId), loadContent(contentId));
}

// 모든 template × content 쌍의 MatchContext(템플릿 순 → 콘텐츠 순).
export function allFixtureContexts(): MatchContext[] {
  const contents = loadAllContents();
  return loadAllTemplates().flatMap((template) => contents.map((content) => buildContext(template, content)));
}
