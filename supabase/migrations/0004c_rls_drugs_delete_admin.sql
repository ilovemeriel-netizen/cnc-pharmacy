-- ════════════════════════════════════════════════════════════════
-- Yakflo · SaaS 마이그레이션 0004c — drugs 테이블 DELETE 정책 (관리자 한정) 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 안전 재실행 가능 (drop policy if exists 선행 + begin/commit 트랜잭션)
--
-- 의존성:
--   · 0001_add_tenants.sql        — current_tenant_ids(), tenants, tenant_members 생성
--   · 0002_tag_existing_tenant.sql — drugs.tenant_id 백필 + 본인 tenant_members 매핑(owner)
--   · 0004b_rls_drugs_only.sql    — drugs RLS 활성화 + SELECT/INSERT/UPDATE 정책 (그대로 유지)
--
-- ⚠️ 적용 범위 (이 파일에서 하는 일):
--   · public.drugs 테이블에 DELETE 정책 1개만 "추가"
--   · 정책 이름: drugs_delete_admin_own_tenant
--
-- ⚠️ 의도된 동작:
--   · "삭제하려는 약품의 tenant_id가 내 테넌트 목록에 있음" AND
--     "내가 그 테넌트의 tenant_members.role IN ('owner','admin')"
--     → 위 두 조건 모두 만족할 때만 DELETE 허용
--   · member 역할 사용자는 프론트 버튼을 우회해 DELETE를 직접 호출해도 DB가 차단
--   · 다른 테넌트의 약품은 절대 삭제 불가 (관리자라도)
--
-- ⚠️ 절대 건드리지 않는 것:
--   · 기존 drugs 정책 3개 (drugs_select_own_tenant / _insert_own_tenant / _update_own_tenant)
--   · drugs 외 다른 테이블 (inventory_stock, monthly_snapshots, transactions, 공유 레퍼런스 7개 등)
--   · 기존 데이터/컬럼 0건 수정
--
-- ⚠️ 사전 점검 권장 (이 파일 실행 전 별도로 확인):
--   [P1] 본인이 cnc 테넌트의 owner인지 확인 — 결과가 'owner' 1행이어야 정상
--        select tm.role, t.slug
--          from public.tenant_members tm
--          join public.tenants t on t.id = tm.tenant_id
--         where tm.user_id = auth.uid();
--
--   [P2] drugs에 이미 RLS + 정책 3개가 정상 적용되어 있는지 확인 — 3행이어야 정상
--        select policyname, cmd from pg_policies
--         where schemaname='public' and tablename='drugs' order by policyname;
--
--   ※ SQL Editor에서는 auth.uid()가 비어 P1 결과가 0행으로 보일 수 있음 — 정상.
-- ════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────
-- drugs DELETE 정책 — 자기 테넌트 + owner/admin만 허용
-- (USING만 사용 — DELETE는 WITH CHECK가 의미 없음)
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
-- [검증 1] drugs의 정책이 총 4개인지 확인 (select / insert / update / delete)
-- ────────────────────────────────────────────────────────────────
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename = 'drugs'
-- order by cmd, policyname;
-- (예상: 4행 — cmd가 SELECT, INSERT, UPDATE, DELETE 각 1개씩)
--
-- [검증 2] DELETE 정책의 cmd = 'DELETE' + USING 조건 확인
-- ────────────────────────────────────────────────────────────────
-- select policyname, cmd, qual, with_check, roles
-- from pg_policies
-- where schemaname = 'public'
--   and tablename  = 'drugs'
--   and policyname = 'drugs_delete_admin_own_tenant';
-- (예상: cmd='DELETE', qual에 current_tenant_ids + tenant_members 조건이 보임,
--        with_check는 NULL(DELETE는 WITH CHECK 사용 안 함), roles는 {public})
--
-- [검증 3] 앱 로그인 상태에서 자기 테넌트 + owner/admin 시나리오 동작
-- ────────────────────────────────────────────────────────────────
-- (안전한 무영향 테스트 — 실제 삭제는 0건 발생)
-- · 거래 이력이 0건인 임시 더미 약품을 등록한 뒤 본인(owner)으로 삭제 시도
--   → 성공해야 정상
-- · 같은 약품을 다른 사용자(member)로 로그인해 삭제 시도
--   → 0행 영향(silent fail) — RLS가 행을 안 보여주므로 DELETE도 차단됨
--
-- ════════════════════════════════════════════════════════════════
-- [롤백] 삭제 정책 제거 — 즉시 실행 가능:
-- ────────────────────────────────────────────────────────────────
-- drop policy if exists "drugs_delete_admin_own_tenant" on public.drugs;
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- 후속 단계 예고 (이 파일 범위 밖):
--   0004c-2: inventory_stock / monthly_snapshots / transactions 의 DELETE 정책
--            (각각 운영 정책에 따라 admin 한정 또는 일반 허용 결정 필요)
--   0005:    공유 레퍼런스 7개 RLS (select 모두 허용 패턴)
-- ════════════════════════════════════════════════════════════════
