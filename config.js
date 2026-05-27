// ────────────────────────────────────────────────────────────
//  config.js — 여기를 본인 환경에 맞게 채우세요
//
//  1. SHEET_ID, API_KEY를 비워두면 샘플 데이터로 동작합니다.
//  2. 시트 헤더 행(1행)의 컬럼 이름과 COLUMNS의 값이 정확히 일치해야 합니다.
//  3. GCP 콘솔에서 Sheets API를 활성화하고 API 키를 발급받으세요.
//     자세한 설정 방법은 README.md 또는 integration-guide.html 참고.
// ────────────────────────────────────────────────────────────

window.CONFIG = {
  // ─── Google Sheets ─────────────────────────────────────
  SHEET_ID: "1WJsAoDjLuFOf9GYksEADqHYtqb4d983C_NhxGlSRgus",
  RANGE:    "총 RAW 데이터 정리!A:Z", // A:Z 전체 컬럼 → 자동감지
  API_KEY:  "AIzaSyCcedehsEm9zrHr8CiZhBGcAGzJHJEvur4",

  // ─── (선택) Google Drive — 광고 소재 폴더 ─────────────
  GDRIVE_FOLDER_ID: "",         // 예: "1xYz0123..."

  // ─── 시트 컬럼 매핑 ────────────────────────────────────
  //  비워두면 헤더 이름으로 자동 감지합니다.
  //  특정 컬럼 이름이 자동감지와 다를 때만 아래에 직접 지정하세요.
  COLUMNS: {},

  // ─── 표시 옵션 ────────────────────────────────────────
  TITLE:        "CAMPAIGN.TERM",
  SUBTITLE:     "AD-PERF MONITOR",
  REFRESH_MIN:  10, // 자동 새로고침 (분) · 0이면 비활성화
};
