// 모든 가중치/임계값/근사 상수. 매직 넘버는 이 파일에만 둔다.

// ---------- 텍스트 근사 (D-1) ----------
export const CHAR_WIDTH_HANGUL_EM = 1.0; // D-1: 한글 한 글자 너비
export const CHAR_WIDTH_LATIN_EM = 0.55; // D-1: 영문/숫자 한 글자 너비
export const CHAR_WIDTH_SPACE_EM = 0.3; // D-1: 공백 너비
export const CHAR_WIDTH_OTHER_EM = 0.55; // D-1: 문장부호·기호 등 그 외 문자는 영문과 같게 본다
export const LINE_HEIGHT_RATIO = 1.4; // D-1: 줄 높이 = fontSize × 1.4
export const MIN_LINES_PER_PARAGRAPH = 1; // D-1: 빈 문단도 한 줄을 차지한다

// ---------- cost placeholder ----------
// TODO(Step 2): 사용자 결정에 따라 role 불일치·넘침·순서 역전·priority별 dummy 비용 가중치를 추가한다.
export const KIND_MISMATCH_COST = Infinity; // text↔image는 배치 불가
export const PLACEHOLDER_COST = 0; // Step 0에서는 kind만 맞으면 비용 0

// ---------- fallback ----------
export const MAX_ITERATIONS = 5; // validate ↔ fallback 반복 상한 (spec 3.4)

// ---------- render (점수와 무관한 그림 치수) ----------
export const RENDER_FOOTER_HEIGHT = 44; // 하단 status 표시 영역 높이(px)
export const RENDER_FOOTER_FONT_SIZE = 14;
export const RENDER_FOOTER_PADDING = 12;
export const RENDER_IMAGE_LABEL_FONT_SIZE = 12;
export const RENDER_SLOT_FILL_OPACITY = 0.12;
