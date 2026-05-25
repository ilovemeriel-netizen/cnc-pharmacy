-- ════════════════════════════════════════════════════════════════
-- Yakflo · SaaS 마이그레이션 0004b — drugs 테이블 1개에만 RLS 우선 적용
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 안전 재실행 가능 (drop policy if exists 선행 + begin/commit 트랜잭션)
--
-- 의존성:
--   · 0001_add_tenants.sql        — current_tenant_ids() 함수 생성 완료
--   · 0002_tag_existing_tenant.sql — drugs.tenant_id 컬럼 + 백필 + 트리거 완료
--
-- ⚠️ 적용 대상: public.drugs 1개 테이블만
-- ⚠️ 만들 정책: SELECT / INSERT / UPDATE 3개만
--    (DELETE 정책은 0004c에서 admin/owner 제한과 함께 별도 추가)
--
-- ⚠️ 사전 점검 권장 (이 파일 실행 전 별도로 확인):
--   [P1] 본인 매핑 확인 — 결과가 1행이어야 정상
--        select tm.role, t.slug
--          from public.tenant_members tm
--          join public.tenants t on t.id = tm.tenant_id
--         where tm.user_id = auth.uid();
--
--   [P2] drugs.tenant_id NULL 건수 — 0이어야 정상 (NULL이면 RLS 후 안 보임)
--        select count(*) from public.drugs where tenant_id is null;
--
--   ※ SQL Editor에서는 auth.uid()가 비어 P1 결과가 0행으로 보일 수 있음.
--     이는 정상 — 실제 앱 로그인 상태에서만 결과가 나옴.
--
-- ⚠️ 금지: drugs 외 다른 테이블 건드리지 않음 · 기존 데이터/컬럼 수정 0건
-- ════════════════════════════════════════════════════════════════

begin;

-- 1) drugs 테이블 RLS 활성화
alter table public.drugs enable row level security;

-- 2) SELECT 정책 — 자기 테넌트의 약품만 조회
drop policy if exists "drugs_select_own_tenant" on public.drugs;
create policy "drugs_select_own_tenant" on public.drugs
  for select using (tenant_id in (select public.current_tenant_ids()));

-- 3) INSERT 정책 — 자기 테넌트로만 삽입 허용
drop policy if exists "drugs_insert_own_tenant" on public.drugs;
create policy "drugs_insert_own_tenant" on public.drugs
  for insert with check (tenant_id in (select public.current_tenant_ids()));

-- 4) UPDATE 정책 — 자기 테넌트 약품만 수정 (대상 행 + 변경 결과 모두 검증)
drop policy if exists "drugs_update_own_tenant" on public.drugs;
create policy "drugs_update_own_tenant" on public.drugs
  for update using (tenant_id in (select public.current_tenant_ids()))
            with check (tenant_id in (select public.current_tenant_ids()));

commit;

-- ════════════════════════════════════════════════════════════════
-- 검증 SELECT (commit 후 별도 실행 권장 — 모두 앱 로그인 세션 기준)
-- ────────────────────────────────────────────────────────────────
--
-- [검증 1] RLS 활성화 여부 확인 → rowsecurity = true 여야 정상
-- ────────────────────────────────────────────────────────────────
-- select relname as table_name, relrowsecurity as rls_enabled
-- from pg_class
-- where relname = 'drugs' and relnamespace = 'public'::regnamespace;
--
-- [검증 2] 등록된 정책 3개 확인 (select/insert/update)
-- ────────────────────────────────────────────────────────────────
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'drugs'
-- order by policyname;
--
-- [검증 3] 앱 로그인 상태에서 drugs 조회 — 본인 테넌트 약품만 보여야 정상
-- ────────────────────────────────────────────────────────────────
-- select count(*) as visible_count from public.drugs;
-- (예상: 0002 백필 이후 cnc 테넌트 약품 수 = 1083)
--
-- ════════════════════════════════════════════════════════════════
-- [롤백] 약품이 안 보이거나 INSERT/UPDATE 실패 시 아래 4줄 즉시 실행:
-- ────────────────────────────────────────────────────────────────
-- alter table public.drugs disable row level security;
-- drop policy if exists "drugs_select_own_tenant" on public.drugs;
-- drop policy if exists "drugs_insert_own_tenant" on public.drugs;
-- drop policy if exists "drugs_update_own_tenant" on public.drugs;
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- 후속 단계 예고 (이 파일 범위 밖):
--   0004c: DELETE 정책 — admin/owner 한정 (앱 내 영구 삭제 버튼 권한과 일치)
--   0004d: drug_lots(존재 시), inventory_stock, monthly_snapshots, transactions
--   0005:  공유 레퍼런스 7개 RLS (select 모두 허용 패턴)
-- ════════════════════════════════════════════════════════════════
