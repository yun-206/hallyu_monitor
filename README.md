# 한류 이슈 모니터 (hallyu-monitor)

네이버 API HUB(뉴스 검색·데이터랩 검색어 트렌드)로 모은 한류 이슈를 분야별(음악·영상·관광·정책)로 보여주는 **정적 대시보드**예요.
`data/data.json` 하나만 읽고, API 키·`.env`·빌드 과정이 없어요. 공개 API 기반 프로토타입이에요.

## 파일 구조
```
index.html        화면 뼈대
css/app.css       디자인 (K-pop Live Tracker와 같은 무드: 다크 차콜 기본 + 라이트, #01539F, Poppins + Pretendard)
js/app.js         data.json 읽기 → 화면 그리기 (외부 라이브러리 없음, 차트는 직접 그린 SVG)
data/data.json    수집·분석 결과 (회사 PC youtube-collector에서 만들어짐)
```

## 배포 (Vercel)
1. 이 폴더 내용을 GitHub 저장소 맨 위(루트)에 올려요.
2. Vercel에서 저장소 Import → Framework Preset **Other**, Build Command 비움, Output Directory 비움(루트) → Deploy.
3. 이후 push하면 자동 재배포돼요.

## 데이터 갱신
- 새로 만들어진 `data/data.json`만 GitHub에서 교체하면 끝이에요(다른 파일은 그대로).
- 올리기 전 체크: 폴더에 `.env`·API 키가 없는지.
- 시연 전날 루틴: Codex에서 요약 갱신 → `data/data.json` 업로드. 요약을 갱신하지 않으면 화면에 **‘갱신 전’** 배지가 떠요(`summary.stale: true`).

## 로컬에서 보기
파일을 더블클릭해서 열면 브라우저가 `data.json` 읽기를 막아요. 폴더에서 아래처럼 간이 서버로 열어요.
```
python -m http.server 8000     (회사 PC는 py -m http.server 8000)
```
→ http://localhost:8000

## 화면과 data.json 필드
| 화면 | 쓰는 필드 |
|---|---|
| 상단 마지막 수집 시각 | `collected_at` |
| 분석 기사 수 | `analysis.fields.*.news_count` 합계 (+ `news_total`, `photo_excluded` 합계) |
| 분야 탭 | `analysis.fields` 키 (음악·영상·관광·정책 순) |
| AI 이슈 요약 3줄 | `analysis.fields.<분야>.summary.lines`, 기준일 `based_on_date`, `stale` → ‘갱신 전’ |
| 검색 관심도 추이 | `trend.by_field.<분야>` (`ratio: null` → 선 끊고 ‘데이터 없음’, `partial: true` → 점선·‘집계 중’), 조회 검색어 `trend.keywords` · **`compare`는 쓰지 않음** |
| 키워드 TOP10 | `analysis.fields.<분야>.top_keywords` (`keyword`, `articles`) |
| 급상승(검색량) | `rising_search` (예전 이름 `rising_keywords`도 읽음), 기간 `analysis.rising_window` |
| 급상승(뉴스 언급량) | `rising_news` + `analysis.rising_news_status` (`ready: false`면 `message` 안내) |
| 최신 기사 | `news` (`field`, `keyword`, `title`, `summary`, `published`, `link`, `is_photo`) — 제목 클릭 시 `link`(원문) 새 탭, 없으면 `naver_link` |
| 하단 수집 기준 | `fields`, `keyword_counts` |

## 동작 메모
- 분야 탭은 주소 뒤 `#영상`처럼 남아서 새로고침해도 그 분야로 열려요. 키보드 ←/→로도 바뀌어요.
- 포토 기사(`is_photo: true`)는 기본으로 숨기고 ‘포토 기사 보기’로 켤 수 있어요.
- 다크/라이트 선택은 localStorage `hallyu-theme`에 저장돼요(팀 허브·툴과 도메인이 달라 각자 저장).
- `errors`에 항목이 있으면 상단에 안내 문구가 떠요.

## 변경 기록
- v1 (2026-11-12) 첫 버전: 분야 탭, AI 요약(기준일·갱신 전), 검색 관심도 꺾은선(null 끊김·partial 점선·툴팁·표로 보기), 키워드 TOP10, 급상승(검색량·뉴스 준비 중 안내), 최신 기사(검색어 거르기·포토 토글·더 보기), 출처·수집 기준. 테스트: 1440·390 너비 다크/라이트, 가로 넘침 0, 콘솔 오류 0, null·stale·rising_news 가상 데이터로 표시 확인.
