# 광고 캠페인 성과 대시보드

Google Sheets의 캠페인 성과 데이터와 Google Drive의 광고 소재를 실시간으로 통합해, Bloomberg 터미널 스타일로 시각화하는 대시보드입니다.

![Data](https://img.shields.io/badge/data-Google%20Sheets%20%2B%20Drive-success) ![Style](https://img.shields.io/badge/style-Bloomberg%20Classic%20White-orange) ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Vanilla-blue)

---

## ✨ 주요 기능

### 📊 시각화
- **8개 핵심 KPI** — 노출 · 클릭 · CTR · CPC · 전환 · CPA · 매출 · ROAS, 각 카드에 스파크라인 + 전기간 대비 델타
- **일별 / 주별 / 월별 토글** — 라인 차트 X축이 즉시 재집계
- **메트릭 전환** — 라인 차트에서 매출&비용 / 전환수 / CVR / ROAS 중 선택 표시
- **다중 필터 (슬라이서)** — 캠페인, 매체(다중 선택), 기기(다중 선택)
- **[05] 주차별 요약 표** — `4월 1주차`, `5월 2주차` 한국식 표기 + 합계
- **[06] 일자별 상세 표** — 토요일=파랑, 일요일=빨강, sticky 헤더, 스크롤 + 합계
- **[07] 소재별 리포트** — 썸네일 테이블 (광고 유입 · 매체 전환 · GA 전환 컬럼)
- **P.MAX 번들 행 지원** — 한 행에 여러 썸네일을 가로로 묶어 표시
- **[08] TOP 광고그룹** — 14일 스파크라인 포함 상위 12개 순위

### 🔌 데이터 소스
- **Google Sheets API** — 캠페인 성과 데이터 (노출·클릭·비용·전환·매출)
- **Google Drive API** — 광고 소재 이미지 자동 매핑
- **샘플 데이터 폴백** — 설정 비어있으면 자동으로 mock 데이터 표시

---

## 🚀 빠른 시작

### 1. 클론
```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
```

### 2. 로컬에서 바로 확인 (샘플 데이터)
```bash
# Python:
python3 -m http.server 8080

# 또는 Node:
npx serve .
```
브라우저에서 `http://localhost:8080` 접속.

> ⚠️ `file://`로 직접 열면 CORS로 인해 API 호출이 실패합니다. 반드시 HTTP 서버로 여세요.

### 3. 실제 시트 연결

#### 3-1. GCP 셋업
1. https://console.cloud.google.com → 새 프로젝트
2. "API 및 서비스" → "라이브러리" → **Google Sheets API**, **Google Drive API** 둘 다 활성화
3. "사용자 인증 정보" → "+ 사용자 인증 정보 만들기" → **API 키**
4. API 키 → "HTTP 리퍼러" 제한 추가 (예: `https://<username>.github.io/*`, `http://localhost:8080/*`)

#### 3-2. 시트 + 드라이브 공유
- 스프레드시트: 우측 상단 `공유` → "링크가 있는 모든 사용자: 뷰어"
- 소재 폴더: 동일하게 "뷰어" 권한 부여

#### 3-3. `config.js` 수정
```js
window.CONFIG = {
  SHEET_ID:         "1aBcDeFg...",         // 시트 URL의 /d/ 다음 문자열
  RANGE:            "campaign-perf!A:K",
  API_KEY:          "AIzaSy...",
  GDRIVE_FOLDER_ID: "1xYz...",             // (선택) 소재 폴더 ID
  COLUMNS: { /* 시트 헤더와 매핑 — README 아래 참고 */ },
  REFRESH_MIN:      10,
};
```

---

## 📑 시트 컬럼 구조 (기본값)

| 시트 헤더 (1행)   | 내부 키       | 타입            |
|----------------|--------------|----------------|
| `주차`           | `week`         | "5월 1주차"    |
| `날짜`           | `date`         | YYYY.MM.DD     |
| `매체`           | `media`        | "네이버 S/A"   |
| `캠페인`         | `campaign`     | string         |
| `광고그룹`       | `adGroup`      | string         |
| `기기`           | `device`       | "PC" / "MO"    |
| `노출수`         | `impressions`  | int            |
| `클릭수`         | `clicks`       | int            |
| `비용(KRW)`     | `cost`         | int (원)       |
| `전환수`         | `conversions`  | int            |
| `매출`           | `revenue`      | int (원)       |

CTR · CPC · CPA · CVR · ROAS는 자동 계산됩니다.

---

## 🖼 소재 파일명 규칙 (Google Drive)

자동 매핑을 위해 파일명을 다음 패턴으로:
```
[CAMPAIGN_KEY][MEDIA_KEY][DEVICE]_vN.png
예: [PR_NEW][META][MO]_v3.png
```
- `CAMPAIGN_KEY`, `MEDIA_KEY`는 시트의 캠페인/매체 값과 일치
- 일치하면 해당 캠페인/매체의 성과 지표가 자동으로 카드에 표시됨

P.MAX(실적 최대화) 캠페인처럼 소재별 추적이 불가능한 경우, 파일명에 `PMAX` 또는 `실적최대화`를 포함하면 한 행에 묶어서 표시됩니다.

---

## 📂 파일 구조

```
.
├── index.html              ← 메인 진입점 (이거 열면 됨)
├── config.js               ← 사용자 설정
├── data.jsx                ← 데이터 로더 (Sheets · Drive · mock)
├── charts.jsx              ← 차트 컴포넌트 (라인 · 바 · 도넛 · 스파크라인)
├── dashboard.jsx           ← Terminal 대시보드 본체
├── integration-guide.html  ← 자세한 연동 가이드
├── README.md
└── .gitignore
```

---

## 🚢 배포

### GitHub Pages
1. 리포지토리 → **Settings** → **Pages** → Source: `main` branch / `/ (root)` → Save
2. 몇 분 뒤 `https://<username>.github.io/<repo>/` 에서 접속 가능
3. **API 키 referer 제한에 이 도메인을 반드시 추가**

### Vercel / Netlify
정적 파일 그대로 drag & drop 하면 즉시 배포됩니다.

---

## 🎨 커스터마이징

### 컬러
`dashboard.jsx` 상단의 `TerminalTheme` 객체 수정:
```js
const TerminalTheme = {
  bg:     "#FAFAF5",
  accent: "#C2410C",
  green:  "#15803D",
  red:    "#B91C1C",
  blue:   "#1D4ED8",
  // ...
};
```

### 자동 새로고침
`config.js`의 `REFRESH_MIN`을 분 단위로. `0`이면 비활성화.

### 기본 기간
`dashboard.jsx`의 `React.useState(28)` 값 수정.

---

## 🔐 보안

- 클라이언트 사이드에서 API를 호출하므로 API 키가 노출됨 — **반드시 HTTP 리퍼러 제한 설정**
- 비공개 시트는 OAuth 2.0 또는 서비스 계정 + 백엔드 프록시 권장
- 자세한 인증 패턴은 [`integration-guide.html`](./integration-guide.html) 참고

---

## 📋 트러블슈팅

| 증상 | 해결 |
|---|---|
| 샘플 데이터만 표시 | `config.js`의 `SHEET_ID` + `API_KEY` 둘 다 채워졌는지 확인 |
| `401 Unauthorized` | API 키 referer 제한에 현재 도메인 등록 확인 |
| `403 Forbidden` | 시트/폴더 공유 설정이 "링크가 있는 모든 사용자: 뷰어"인지 |
| `Sheet has no data rows` | 1행이 헤더, 2행부터 데이터인지 확인 |
| 컬럼이 빈 값 | `COLUMNS`의 헤더 이름이 시트와 정확히 일치 (공백 · 괄호 포함) |
| Drive 이미지 안 보임 | 폴더 공유 권한 + 파일이 이미지 형식(image/*) 확인 |
| CORS 에러 | `file://`가 아닌 HTTP 서버로 접속 |

---

## 📄 라이선스

MIT — 자유롭게 수정/배포하세요.
