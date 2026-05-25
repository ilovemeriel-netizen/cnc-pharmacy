-- ════════════════════════════════════════════════════════════════
-- Yakflo · SaaS 마이그레이션 0004b-2 — 나머지 운영 테이블 3개 RLS 적용
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 안전 재실행 가능 (drop policy if exists 선행 + begin/commit 트랜잭션)
--
-- 의존성:
--   · 0001_add_tenants.sql        — current_tenant_ids() 함수 생성 완료
--   · 0002_tag_existing_tenant.sql — tenant_id 컬럼 + 백필 + 트리거 완료
--   · 0004b_rls_drugs_only.sql    — drugs 테이블 RLS 검증 완료 (SELECT/INSERT 정상)
--
-- ⚠️ 적용 대상 (3개 테이블):
--   · public.inventory_stock
--   · public.monthly_snapshots
--   · public.transactions
--
-- ⚠️ 만들 정책: 각 테이블마다 SELECT / INSERT / UPDATE 3개 → 총 9개
--    (DELETE 정책은 0004c에서 admin/owner 제한과 함께 별도 추가)
--
-- ⚠️ 사전 점검 권장 (이 파일 실행 전 별도로 확인):
--   [P1] 본인 매핑 확인 — 결과가 1행이어야 정상
--        select tm.role, t.slug
--          from public.tenant_members tm
--          join public.tenants t on t.id = tm.tenant_id
--         where tm.user_id = auth.uid();
--
--   [P2] 3개 테이블의 tenant_id NULL 건수 — 모두 0이어야 정상
--        select 'inventory_stock'   as t, count(*) as null_cnt from public.inventory_stock   where tenant_id is null
--        union all
--        select 'monthly_snapshots',     count(*)              from public.monthly_snapshots where tenant_id is null
--        union all
--        select 'transactions',          count(*)              from public.transactions      where tenant_id is null;
--
--   ※ SQL Editor에서는 auth.uid()가 비어 P1 결과가 0행으로 보일 수 있음.
--     이는 정상 — 실제 앱 로그인 상태에서만 결과가 나옴.
--
-- ⚠️ 금지:
--   · drugs · 공유 레퍼런스 7개 · profiles · tenants · tenant_members 건드리지 않음
--   · DELETE 정책 만들지 않음 (0004c에서)
--   · 기존 데이터/컬럼 수정 0건
-- ════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────
-- A) inventory_stock — RLS + SELECT/INSERT/UPDATE 정책
-- ────────────────────────────────────────────────────────────────
alter table public.inventory_stock enable row level security;

drop policy if exists "inventory_stock_select_own_tenant" on public.inventory_stock;
create policy "inventory_stock_select_own_tenant" on public.inventory_stock
  for select using (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "inventory_stock_insert_own_tenant" on public.inventory_stock;
create policy "inventory_stock_insert_own_tenant" on public.inventory_stock
  for insert with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "inventory_stock_update_own_tenant" on public.inventory_stock;
create policy "inventory_stock_update_own_tenant" on public.inventory_stock
  for update using (tenant_id in (select public.current_tenant_ids()))
            with check (tenant_id in (select public.current_tenant_ids()));

-- ────────────────────────────────────────────────────────────────
-- B) monthly_snapshots — RLS + SELECT/INSERT/UPDATE 정책
-- ────────────────────────────────────────────────────────────────
alter table public.monthly_snapshots enable row level security;

drop policy if exists "monthly_snapshots_select_own_tenant" on public.monthly_snapshots;
create policy "monthly_snapshots_select_own_tenant" on public.monthly_snapshots
  for select using (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "monthly_snapshots_insert_own_tenant" on public.monthly_snapshots;
create policy "monthly_snapshots_insert_own_tenant" on public.monthly_snapshots
  for insert with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "monthly_snapshots_update_own_tenant" on public.monthly_snapshots;
create policy "monthly_snapshots_update_own_tenant" on public.monthly_snapshots
  for update using (tenant_id in (select public.current_tenant_ids()))
            with check (tenant_id in (select public.current_tenant_ids()));

-- ────────────────────────────────────────────────────────────────
-- C) transactions — RLS + SELECT/INSERT/UPDATE 정책
-- ────────────────────────────────────────────────────────────────
alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own_tenant" on public.transactions;
create policy "transactions_select_own_tenant" on public.transactions
  for select using (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "transactions_insert_own_tenant" on public.transactions;
create policy "transactions_insert_own_tenant" on public.transactions
  for insert with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "transactions_update_own_tenant" on public.transactions;
create policy "transactions_update_own_tenant" on public.transactions
  for update using (tenant_id in (select public.current_tenant_ids()))
            with check (tenant_id in (select public.current_tenant_ids()));

commit;

-- ════════════════════════════════════════════════════════════════
-- 검증 SELECT (commit 후 별도 실행 권장 — 앱 로그인 세션 기준)
-- ────────────────────────────────────────────────────────────────
--
-- [검증 1] 3개 테이블 RLS 활성화 여부 → rowsecurity = true 모두 정상
-- ────────────────────────────────────────────────────────────────
-- select relname as table_name, relrowsecurity as rls_enabled
-- from pg_class
-- where relname in ('inventory_stock','monthly_snapshots','transactions')
--   and relnamespace = 'public'::regnamespace
-- order by relname;
--
-- [검증 2] 등록된 정책 9개 확인 (테이블별 select/insert/update 3개씩)
-- ────────────────────────────────────────────────────────────────
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('inventory_stock','monthly_snapshots','transactions')
-- order by tablename, policyname;
--
-- [검증 3] 앱 로그인 상태에서 행 수 확인 — 본인 테넌트 데이터만 보여야 정상
-- ────────────────────────────────────────────────────────────────
-- select 'inventory_stock'   as t, count(*) from public.inventory_stock
-- union all
-- select 'monthly_snapshots',     count(*) from public.monthly_snapshots
-- union all
-- select 'transactions',          count(*) from public.transactions;
-- (예상: 0002 백필 이후 cnc 테넌트의 inventory_stock=574, monthly_snapshots=1422)
--
-- ════════════════════════════════════════════════════════════════
-- [롤백] 데이터가 안 보이거나 INSERT/UPDATE 실패 시 아래 즉시 실행:
-- ────────────────────────────────────────────────────────────────
-- -- inventory_stock 원상복구
-- alter table public.inventory_stock disable row level security;
-- drop policy if exists "inventory_stock_select_own_tenant" on public.inventory_stock;
-- drop policy if exists "inventory_stock_insert_own_tenant" on public.inventory_stock;
-- drop policy if exists "inventory_stock_update_own_tenant" on public.inventory_stock;
--
-- -- monthly_snapshots 원상복구
-- alter table public.monthly_snapshots disable row level security;
-- drop policy if exists "monthly_snapshots_select_own_tenant" on public.monthly_snapshots;
-- drop policy if exists "monthly_snapshots_insert_own_tenant" on public.monthly_snapshots;
-- drop policy if exists "monthly_snapshots_update_own_tenant" on public.monthly_snapshots;
--
-- -- transactions 원상복구
-- alter table public.transactions disable row level security;
-- drop policy if exists "transactions_select_own_tenant" on public.transactions;
-- drop policy if exists "transactions_insert_own_tenant" on public.transactions;
-- drop policy if exists "transactions_update_own_tenant" on public.transactions;
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- 후속 단계 예고 (이 파일 범위 밖):
--   0004c: DELETE 정책 — admin/owner 한정 (4개 운영 테이블 일괄, 앱 내 권한과 일치)
--   0005:  공유 레퍼런스 7개 RLS (select 모두 허용 패턴)
-- ════════════════════════════════════════════════════════════════
