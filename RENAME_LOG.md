# RENAME_LOG — cnc-pharmacy → Yakflo

## 🧷 롤백 기준점 (Rollback Anchor)

| 항목 | 값 |
|---|---|
| **기준 커밋 (SHA)** | `d81e1fe781c2ba52a0dbae5d98c509eacf902497` |
| **짧은 SHA** | `d81e1fe` |
| **커밋 메시지** | `feat: PWA 지원 추가 (vite-plugin-pwa)` |
| **기준 커밋 날짜** | `2026-05-25 09:22:59 +0000` (UTC) |
| **기준 브랜치** | `main` (origin/main과 동기화 완료) |
| **작업 브랜치** | `rename-yakflo` (이 커밋에서 분기) |
| **로그 작성 시각** | `2026-05-25` |
| **원격 저장소** | `https://github.com/ilovemeriel-netizen/cnc-pharmacy` |

## 🔁 롤백 절차 (문제 발생 시)

이름 변경 작업 중 또는 후에 문제가 생기면 아래 절차로 즉시 복원 가능합니다.

### 1) 로컬 — 작업 브랜치 폐기하고 main으로 복원
```bash
git checkout main
git branch -D rename-yakflo          # 작업 브랜치 삭제
# 필요 시 stash로 임시 백업: git stash push -m "rename-yakflo WIP"
```

### 2) 원격에 push했고 main에도 머지된 경우 — 머지 커밋 되돌리기
```bash
# 머지 커밋이 HEAD인 경우 (가장 흔함)
git revert -m 1 HEAD
git push origin main
```

### 3) 강제로 기준점까지 main 되돌리기 (⚠️ 협업자 있으면 위험 — 단독 작업 한정)
```bash
git checkout main
git reset --hard d81e1fe781c2ba52a0dbae5d98c509eacf902497
git push --force-with-lease origin main
```

### 4) 외부 서비스 원복 체크리스트
| 항목 | 원복 조치 |
|---|---|
| GitHub repo 이름 변경 시 | Settings → Rename으로 `cnc-pharmacy`로 되돌리기 (자동 리다이렉트 유지) |
| Netlify 사이트 도메인 변경 시 | Site settings → Change site name 원복 |
| Vercel 프로젝트 이름 변경 시 | Settings → General → Project Name 원복 |
| Supabase Site URL / Redirect URLs 변경 시 | Auth → URL Configuration 에서 이전 값으로 복원 |
| 네이버 디벨로퍼스 Callback URL | 새로 추가한 URL 삭제 (기존 URL 그대로 유지됨) |
| Netlify/Vercel `SITE_URL` 환경변수 변경 시 | 이전 값으로 복원 후 재배포 |

## 📦 기준 시점 환경

- Node.js: 24.14.0
- Vite: 8.0.1
- React: 19.2.4
- vite-plugin-pwa: 1.3.0
- 주요 의존성: `@supabase/supabase-js@2.100.1`, `xlsx@0.18.5`, `sharp@0.34.5`

## 📝 작업 이력 (이후 단계에서 누적 기록)

| 일자 | 단계 | 변경 요약 | 커밋 |
|---|---|---|---|
| 2026-05-25 | 0. 안전망 | `rename-yakflo` 브랜치 생성 + RENAME_LOG.md 작성 | (이번 커밋) |
