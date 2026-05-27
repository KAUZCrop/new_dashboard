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
  SHEET_ID: "",                 // 예: "1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"
  RANGE:    "campaign-perf!A:K", // 시트탭이름!컬럼범위
  API_KEY:  "",                 // GCP API 키

  // ─── (선택) Google Drive — 광고 소재 폴더 ─────────────
  GDRIVE_FOLDER_ID: "",         // 예: "1xYz0123..."

  // ─── 시트 컬럼 매핑 ────────────────────────────────────
  //  내부 키(왼쪽)는 고정 — 시트 헤더 이름(오른쪽)만 본인 시트에 맞게 수정.
  COLUMNS: {
    week:        "주차",
    date:        "날짜",
    media:       "매체",
    campaign:    "캠페인",
    adGroup:     "광고그룹",
    device:      "기기",
    impressions: "노출수",
    clicks:      "클릭수",
    cost:        "비용(KRW)",
    conversions: "전환수",
    revenue:     "매출",
  },

  // ─── 표시 옵션 ────────────────────────────────────────
  TITLE:        "CAMPAIGN.TERM",
  SUBTITLE:     "AD-PERF MONITOR",
  REFRESH_MIN:  10, // 자동 새로고침 (분) · 0이면 비활성화
};
