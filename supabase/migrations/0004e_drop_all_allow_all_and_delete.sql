-- ════════════════════════════════════════════════════════════════
-- Yakflo · SaaS 마이그레이션 0004e
--   (1) 4개 운영 테이블의 'allow_all' 정책 일괄 제거
--       — drugs, inventory_stock, monthly_snapshots, transactions
--   (2) drugs의 DELETE 정책 추가 — admin/owner 한정
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 안전 재실행 가능 (drop policy if exists 선행 + begin/commit 트랜잭션)
--
-- 의존성:
--   · 0001_add_tenants.sql        — current_tenant_ids(), tenants, tenant_members
--   · 0002_tag_existing_tenant.sql — 4개 테이블 tenant_id 백필 + 본인 owner 매핑
--   · 0004b_rls_drugs_only.sql    — drugs RLS 활성화 + 격리 정책 3개
--   · 0004b2_rls_remaining_tables.sql — 나머지 3개 테이블 RLS + 격리 정책 9개
--
-- ⚠️ 배경:
--   검증 2 결과 drugs뿐 아니라 inventory_stock, monthly_snapshots, transactions에도
--   'allow_all' (cmd=ALL, qual=true) 정책이 남아 있어 4개 테이블 모두의 격리 정책이
--   무력화 중이었음. PostgreSQL RLS는 정책들을 OR로 결합하므로, qual=true 정책 하나가
--   있으면 다른 격리 정책이 모두 무효. 이 파일에서 4개 한꺼번에 제거.
--
-- ⚠️ [백업] 제거 전 각 테이블 allow_all = for all using (true), roles = {public}
--   복구 필요시 각 테이블에:
--     create policy "allow_all" on public.<table> for all using (true);
--   (구체 복구 SQL은 본 파일 하단 [롤백] 섹션 참고)
--
-- ⚠️ 적용 범위 (이 파일에서 하는 일):
--   · drop policy "allow_all" on public.drugs
--   · drop policy "allow_all" on public.inventory_stock
--   · drop policy "allow_all" on public.monthly_snapshots
--   · drop policy "allow_all" on public.transactions
--   · create policy "drugs_delete_admin_own_tenant" on drugs
--
-- ⚠️ 절대 건드리지 않는 것:
--   · 격리 정책(*_own_tenant) — drugs / inventory_stock / monthly_snapshots / transactions 모두
--   · 공유 레퍼런스 7개 (drug_master, dur_*, drug_discontinuation, drug_harmful, drug_status_alerts)
--   · profiles · tenants · tenant_members
--   · 기존 데이터/컬럼 0건 수정
--
-- ⚠️ 사전 점검 권장 (이 파일 실행 전 별도로 확인):
--   [P1] 현재 4개 테이블의 allow_all 존재 확인:
--        select tablename, policyname, cmd, qual
--          from pg_policies
--         where schemaname='public' and policyname='allow_all'
--           and tablename in ('drugs','inventory_stock','monthly_snapshots','transactions')
--         order by tablename;
--        (예상: 4행, 모두 cmd=ALL, qual='true')
--
--   [P2] 격리 정책 12개(테이블별 3개씩) 정상 존재 확인:
--        select tablename, policyname, cmd from pg_policies
--         where schemaname='public'
--           and policyname like '%_own_tenant'
--         order by tablename, cmd;
-- ════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────
-- 1) 4개 운영 테이블의 allow_all 정책 일괄 제거
--    (없는 경우도 drop if exists로 안전 — 멱등)
-- ────────────────────────────────────────────────────────────────
drop policy if exists "allow_all" on public.drugs;
drop policy if exists "allow_all" on public.inventory_stock;
drop policy if exists "allow_all" on public.monthly_snapshots;
drop policy if exists "allow_all" on public.transactions;

-- ────────────────────────────────────────────────────────────────
-- 2) drugs DELETE 정책 추가 — 자기 테넌트 + owner/admin만 허용
--    (이미 적용돼 있어도 안전: drop if exists 선행)
-- ────────────────────────────────────────────────────────────────
drop policy if exists "drugs_delete_admin_own_tenant" on public.drugs;
create policy "drugs_delete_admin_own_tenant" on public.drugs
  for delete
  using (
    tenant_id in (select public.current_tenant_ids())
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.tenant_id = public.drugs.tenant_id
        and tm.role in ('owner','admin')
    )
  );

commit;

-- ════════════════════════════════════════════════════════════════
-- 검증 SELECT (commit 후 별도 실행 권장)
-- ────────────────────────────────────────────────────────────────
--
-- [검증 A] 4개 테이블에 allow_all이 모두 사라졌는지 — 0행이어야 정상
-- ────────────────────────────────────────────────────────────────
-- select tablename, policyname
-- from pg_policies
-- where schemaname = 'public'
--   and policyname = 'allow_all'
--   and tablename in ('drugs','inventory_stock','monthly_snapshots','transactions');
-- (예상: 0행)
--
-- [검증 B] drugs 정책 4개(SELECT/INSERT/UPDATE/DELETE) 확인
-- ────────────────────────────────────────────────────────────────
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public' and tablename = 'drugs'
-- order by cmd;
-- (예상: 4행, cmd가 SELECT/INSERT/UPDATE/DELETE 각 1개씩)
--
-- [검증 C] 격리 정책 12개(테이블별 3개씩) 유지 확인 — 손대지 않았음 검증
-- ────────────────────────────────────────────────────────────────
-- select tablename, count(*) as policy_count
-- from pg_policies
-- where schemaname='public'
--   and policyname like '%_own_tenant'
-- group by tablename
-- order by tablename;
-- (예상: 4행 — drugs=3, inventory_stock=3, monthly_snapshots=3, transactions=3)
--
-- [검증 D] 앱 로그인 상태에서 4개 테이블 행 수 — 본인 테넌트 데이터만 보여야 정상
-- ────────────────────────────────────────────────────────────────
-- select 'drugs'             as t, count(*) from public.drugs
-- union all
-- select 'inventory_stock',       count(*) from public.inventory_stock
-- union all
-- select 'monthly_snapshots',     count(*) from public.monthly_snapshots
-- union all
-- select 'transactions',          count(*) from public.transactions;
-- (예상: cnc 테넌트 수치 — drugs=1083, inventory_stock=574, monthly_snapshots=1422)
--
-- ════════════════════════════════════════════════════════════════
-- [롤백] 4개 allow_all 복원 + delete 정책 제거:
-- ────────────────────────────────────────────────────────────────
-- create policy "allow_all" on public.drugs             for all using (true);
-- create policy "allow_all" on public.inventory_stock   for all using (true);
-- create policy "allow_all" on public.monthly_snapshots for all using (true);
-- create policy "allow_all" on public.transactions      for all using (true);
-- drop policy if exists "drugs_delete_admin_own_tenant" on public.drugs;
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- 후속 단계 예고 (이 파일 범위 밖):
--   · inventory_stock / monthly_snapshots / transactions DELETE 정책 결정
--     (운영 정책상 관리자 한정 vs 일반 허용 vs 금지 — 의사결정 필요)
--   · 0005: 공유 레퍼런스 7개 RLS (select 모두 허용 패턴)
-- ════════════════════════════════════════════════════════════════
