-- ════════════════════════════════════════════════════════════════
-- Yakflo · SaaS 마이그레이션 0004d
--   (1) drugs의 'allow_all' 정책 제거  — 테넌트 격리 무력화 차단
--   (2) drugs의 DELETE 정책 추가         — admin/owner 한정 (0004c와 동일 본문)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 안전 재실행 가능 (drop policy if exists 선행 + begin/commit 트랜잭션)
--
-- 의존성:
--   · 0001_add_tenants.sql        — current_tenant_ids(), tenants, tenant_members
--   · 0002_tag_existing_tenant.sql — drugs.tenant_id 백필 + 본인(tenant_members owner)
--   · 0004b_rls_drugs_only.sql    — drugs RLS 활성화 + SELECT/INSERT/UPDATE 정책 (그대로 유지)
--
-- ⚠️ 배경:
--   drugs에 'allow_all' (cmd=ALL, qual=true) 정책이 남아있어 0004b의 격리 정책이
--   무력화되고 있었음. PostgreSQL RLS는 정책들을 OR로 결합하므로, qual=true 정책
--   하나만 있어도 다른 격리 정책이 무의미해짐. 이 파일에서 그것을 제거.
--
-- ⚠️ [백업] 제거 전 allow_all 정의 (필요시 복구용 — 본문 실행 후에도 이 줄은 안전):
--   ALL / qual = true / roles = {public}
--   복구 필요시: create policy "allow_all" on public.drugs for all using (true);
--
-- ⚠️ 적용 범위 (이 파일에서 하는 일):
--   · drop policy "allow_all" on public.drugs                 (제거)
--   · create policy "drugs_delete_admin_own_tenant" on drugs  (추가)
--
-- ⚠️ 절대 건드리지 않는 것:
--   · 기존 drugs 격리 정책 3개 (drugs_select_own_tenant / _insert_own_tenant / _update_own_tenant)
--   · drugs 외 다른 테이블 (inventory_stock, monthly_snapshots, transactions, 공유 레퍼런스 등)
--   · 기존 데이터/컬럼 0건 수정
--
-- ⚠️ 사전 점검 권장 (이 파일 실행 전 별도로 확인):
--   [P1] 현재 drugs 정책 목록 — allow_all이 실제로 있는지, 격리 정책 3개도 그대로인지
--        select policyname, cmd, qual
--          from pg_policies
--         where schemaname='public' and tablename='drugs'
--         order by cmd, policyname;
--
--   [P2] 본인이 cnc 테넌트의 owner인지 (DELETE 정책 사후 테스트용)
--        select tm.role, t.slug
--          from public.tenant_members tm
--          join public.tenants t on t.id = tm.tenant_id
--         where tm.user_id = auth.uid();
-- ════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────
-- 1) allow_all 정책 제거 — 격리 무력화 원인 제거
-- ────────────────────────────────────────────────────────────────
drop policy if exists "allow_all" on public.drugs;

-- ────────────────────────────────────────────────────────────────
-- 2) DELETE 정책 추가 — 자기 테넌트 + owner/admin만 허용
--    (0004c와 동일 본문 — 이미 적용돼 있어도 안전: drop if exists 선행)
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
-- [검증 1] drugs 정책이 정확히 4개(SELECT/INSERT/UPDATE/DELETE)이고
--          allow_all이 사라졌는지 확인:
-- ────────────────────────────────────────────────────────────────
-- select policyname, cmd, qual
-- from pg_policies
-- where schemaname='public' and tablename='drugs'
-- order by cmd;
-- (예상: 4행. allow_all 0행. 각 cmd가 SELECT/INSERT/UPDATE/DELETE 1개씩)
--
-- [검증 2] 다른 운영 테이블(inventory_stock / monthly_snapshots / transactions)에도
--          'allow_all' 같은 qual=true 정책이 있는지 점검:
-- ────────────────────────────────────────────────────────────────
-- select tablename, policyname, cmd, qual
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('inventory_stock','monthly_snapshots','transactions')
--   and qual = 'true';
-- (기대: 0행. 1행 이상이면 해당 테이블도 격리가 무력화된 상태이므로
--   별도 마이그레이션으로 동일 패턴으로 drop 필요)
--
-- [검증 3] 앱 로그인 상태에서 행 수 확인 — 격리 작동 여부 최종 검증
-- ────────────────────────────────────────────────────────────────
-- select count(*) as visible_drugs from public.drugs;
-- (예상: 본인 테넌트의 약품 수만, 다른 테넌트 약품은 보이지 않아야 함)
--
-- ════════════════════════════════════════════════════════════════
-- [롤백 — allow_all 다시 살리고 delete 정책 제거]:
-- ────────────────────────────────────────────────────────────────
-- create policy "allow_all" on public.drugs for all using (true);
-- drop policy if exists "drugs_delete_admin_own_tenant" on public.drugs;
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- 후속 단계 예고 (이 파일 범위 밖):
--   · 위 [검증 2]에서 발견된 qual=true 정책들을 별도 마이그레이션으로 정리
--   · 0005: 공유 레퍼런스 7개 RLS (select 모두 허용 패턴)
-- ════════════════════════════════════════════════════════════════
