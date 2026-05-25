-- ════════════════════════════════════════════════════════════════
-- Yakflo · SaaS 마이그레이션 0001 — 멀티 테넌시 기반
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 안전 재실행 가능 (IF NOT EXISTS / DROP IF EXISTS / DO 블록)
--
-- ⚠️ 기존 테이블(drugs, drug_lots, inventory_stock, transactions,
--    monthly_snapshots, profiles 등)은 일절 수정하지 않습니다.
--    이 파일은 신규 객체만 추가합니다.
-- ════════════════════════════════════════════════════════════════

-- 1) plan_tier ENUM 타입 — 안전 생성 (재실행 시 중복 무시)
do $$
begin
  create type public.plan_tier as enum ('free', 'trial', 'pro', 'enterprise');
exception
  when duplicate_object then null;
end $$;

-- 2) tenants 테이블 — SaaS 조직(병원·약국·테넌트) 단위
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  plan        public.plan_tier not null default 'trial',
  created_at  timestamptz not null default now()
);

-- 3) tenant_members 테이블 — 사용자와 테넌트의 N:M 매핑 + 역할
create table if not exists public.tenant_members (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id)     on delete cascade,
  role        text not null default 'member',
  primary key (tenant_id, user_id)
);

-- 4) current_tenant_ids() — 현재 로그인 사용자가 속한 tenant_id 목록 반환
--    RLS 정책에서 호출 예정: USING (tenant_id IN (SELECT current_tenant_ids()))
--
--    SECURITY DEFINER + search_path = public 고정으로
--    RLS 재귀·search_path 하이재킹 위험 차단.
create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.tenant_id
  from public.tenant_members tm
  where tm.user_id = auth.uid()
$$;

-- ════════════════════════════════════════════════════════════════
-- 후속 단계 예고 (이 마이그레이션 범위 밖):
--   · tenants/tenant_members RLS 활성화 + 정책
--   · 기존 약품·재고 테이블에 tenant_id 컬럼 추가 (별도 마이그레이션)
--   · 첫 테넌트 생성 + 기존 사용자 매핑 백필
-- 이번 파일은 스키마 추가만 담당.
-- ════════════════════════════════════════════════════════════════
