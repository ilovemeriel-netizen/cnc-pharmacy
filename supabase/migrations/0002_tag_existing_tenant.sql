-- ════════════════════════════════════════════════════════════════
-- Yakflo · SaaS 마이그레이션 0002 — 기존 데이터에 tenant_id 태깅
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 안전 재실행 가능 (IF NOT EXISTS / ON CONFLICT / WHERE tenant_id IS NULL)
--
-- ⚠️ 적용 대상: 운영 데이터 4개 테이블만
--     drugs, inventory_stock, monthly_snapshots, transactions
--
-- ⚠️ 절대 손대지 않는 테이블:
--   (1) 공유 레퍼런스 7개 (식약처·DUR — 모든 테넌트가 동일 데이터 공유):
--       drug_master, drug_discontinuation, drug_harmful, drug_status_alerts,
--       dur_age_contraindication, dur_elderly_caution, dur_pregnancy_contraindication
--   (2) 메타·인증:
--       profiles (사용자 1:1), tenants (자기 자신), tenant_members (이미 매핑)
--   (3) 비정상 테이블:
--       create_drug_lots.sql (이름이 .sql 확장자 포함 — 별도 정리 필요)
--   (4) 부재 테이블:
--       drug_lots (DB에 존재하지 않아 적용 대상에서 제외)
--
-- ⚠️ 금지 사항:
--   · DELETE / DROP / 기존 컬럼 수정 — 0건
--   · NOT NULL 제약 추가 — 안 함 (다음 단계에서 데이터 안정화 후 별도 진행)
-- ════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────
-- 1) 씨엔씨 테넌트 1행 삽입 (slug 중복 시 무시 — 재실행 안전)
-- ────────────────────────────────────────────────────────────────
insert into public.tenants (name, slug, plan)
values ('씨엔씨재활의학과병원', 'cnc', 'enterprise')
on conflict (slug) do nothing;

-- ────────────────────────────────────────────────────────────────
-- 2) 운영 4개 테이블에 tenant_id 컬럼 추가 (NULL 허용)
--    NOT NULL은 데이터 백필 + 트리거 검증 후 별도 단계에서 강제
-- ────────────────────────────────────────────────────────────────
alter table public.drugs
  add column if not exists tenant_id uuid references public.tenants(id);

alter table public.inventory_stock
  add column if not exists tenant_id uuid references public.tenants(id);

alter table public.monthly_snapshots
  add column if not exists tenant_id uuid references public.tenants(id);

alter table public.transactions
  add column if not exists tenant_id uuid references public.tenants(id);

-- ────────────────────────────────────────────────────────────────
-- 3) 기존 행 백필 — NULL인 행만 cnc 테넌트로 (재실행 안전)
--    이미 채워진 행은 건드리지 않음 (멱등성)
-- ────────────────────────────────────────────────────────────────
update public.drugs
   set tenant_id = (select id from public.tenants where slug='cnc')
 where tenant_id is null;

update public.inventory_stock
   set tenant_id = (select id from public.tenants where slug='cnc')
 where tenant_id is null;

update public.monthly_snapshots
   set tenant_id = (select id from public.tenants where slug='cnc')
 where tenant_id is null;

update public.transactions
   set tenant_id = (select id from public.tenants where slug='cnc')
 where tenant_id is null;

-- ────────────────────────────────────────────────────────────────
-- 4) 기존 사용자 → 씨엔씨 테넌트 매핑
--    · ilovemeriel@gmail.com → 'owner'
--    · 그 외 → 'member'
--    · 이미 매핑된 경우 무시 (재실행 안전)
-- ────────────────────────────────────────────────────────────────
insert into public.tenant_members (tenant_id, user_id, role)
select
  (select id from public.tenants where slug='cnc') as tenant_id,
  u.id                                              as user_id,
  case when u.email = 'ilovemeriel@gmail.com'
       then 'owner' else 'member' end               as role
from auth.users u
on conflict (tenant_id, user_id) do nothing;

-- ────────────────────────────────────────────────────────────────
-- 5) BEFORE INSERT 트리거 — NEW.tenant_id IS NULL일 때만 자동 채움
--    여러 테넌트 소속 시 tenants.created_at 가장 빠른 것 + tenant_id asc tie-break
--    (결정적 선택으로 같은 입력에 항상 같은 결과 보장)
--
--    SECURITY DEFINER + search_path = public 고정으로
--    search_path 하이재킹 차단 + RLS 정책에서도 안전 호출.
-- ────────────────────────────────────────────────────────────────
create or replace function public.set_tenant_id_from_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is null then
    select tm.tenant_id
      into new.tenant_id
      from public.tenant_members tm
      join public.tenants        t on t.id = tm.tenant_id
     where tm.user_id = auth.uid()
     order by t.created_at asc, tm.tenant_id asc
     limit 1;
  end if;
  return new;
end
$$;

-- 트리거 부착 (4개 운영 테이블) — 안전 재실행을 위해 drop if exists 선행
drop trigger if exists trg_set_tenant_id on public.drugs;
create trigger trg_set_tenant_id
  before insert on public.drugs
  for each row execute function public.set_tenant_id_from_user();

drop trigger if exists trg_set_tenant_id on public.inventory_stock;
create trigger trg_set_tenant_id
  before insert on public.inventory_stock
  for each row execute function public.set_tenant_id_from_user();

drop trigger if exists trg_set_tenant_id on public.monthly_snapshots;
create trigger trg_set_tenant_id
  before insert on public.monthly_snapshots
  for each row execute function public.set_tenant_id_from_user();

drop trigger if exists trg_set_tenant_id on public.transactions;
create trigger trg_set_tenant_id
  before insert on public.transactions
  for each row execute function public.set_tenant_id_from_user();

commit;

-- ════════════════════════════════════════════════════════════════
-- 검증 SELECT (실행 후 별도로 한 번씩 돌려 결과 확인)
-- 모두 commit 후에 실행하세요. 결과가 "예상값"과 일치하면 정상.
-- ────────────────────────────────────────────────────────────────
--
-- [검증 1] 각 운영 테이블의 tenant_id IS NULL 건수 → 모두 0이어야 정상
-- ────────────────────────────────────────────────────────────────
-- select 'drugs'             as table_name, count(*) as null_cnt from public.drugs             where tenant_id is null
-- union all
-- select 'inventory_stock',   count(*) from public.inventory_stock   where tenant_id is null
-- union all
-- select 'monthly_snapshots', count(*) from public.monthly_snapshots where tenant_id is null
-- union all
-- select 'transactions',      count(*) from public.transactions      where tenant_id is null;
--
-- [검증 2] 마이그레이션 전후 행 수 변동 0건 — 사전 캡쳐와 비교
--          (사전 캡쳐: drugs=1083, inventory_stock=574, monthly_snapshots=1422)
-- ────────────────────────────────────────────────────────────────
-- select 'drugs'             as table_name, count(*) from public.drugs
-- union all
-- select 'inventory_stock',   count(*) from public.inventory_stock
-- union all
-- select 'monthly_snapshots', count(*) from public.monthly_snapshots
-- union all
-- select 'transactions',      count(*) from public.transactions;
--
-- [검증 3] tenants에 cnc 1행 존재 + tenant_members 매핑 확인
-- ────────────────────────────────────────────────────────────────
-- select t.name, t.slug, t.plan,
--        (select count(*) from public.tenant_members tm where tm.tenant_id = t.id) as members
-- from public.tenants t where t.slug='cnc';
--
-- [검증 4] 본인이 owner로 매핑됐는지 확인
-- ────────────────────────────────────────────────────────────────
-- select u.email, tm.role
-- from public.tenant_members tm
-- join auth.users u on u.id = tm.user_id
-- join public.tenants t on t.id = tm.tenant_id
-- where t.slug='cnc';
--
-- [검증 5] 공유 레퍼런스 7개에 tenant_id가 추가되지 않았는지 확인
--          → 결과 0행이어야 정상 (즉, tenant_id 컬럼 없음)
-- ────────────────────────────────────────────────────────────────
-- select table_name
-- from information_schema.columns
-- where table_schema='public' and column_name='tenant_id'
--   and table_name in (
--     'drug_master','drug_discontinuation','drug_harmful','drug_status_alerts',
--     'dur_age_contraindication','dur_elderly_caution','dur_pregnancy_contraindication'
--   );
--
-- [검증 6] 트리거 부착 확인 — 4행 결과 (drugs, inventory_stock, monthly_snapshots, transactions)
-- ────────────────────────────────────────────────────────────────
-- select event_object_table as table_name, trigger_name, action_timing, event_manipulation
-- from information_schema.triggers
-- where trigger_name = 'trg_set_tenant_id'
-- order by event_object_table;
--
-- ════════════════════════════════════════════════════════════════
-- 후속 단계 예고 (이 마이그레이션 범위 밖):
--   0003: 운영 4개 테이블의 tenant_id에 NOT NULL 강제 (데이터 안정화 후)
--   0004: 운영 4개 + 공유 7개 RLS 정책 활성화
--   0005: create_drug_lots.sql 비정상 테이블 정리 (검토 후 DROP 또는 RENAME)
--   별도: drug_lots 테이블 신규 설계 필요 시 추가
-- ════════════════════════════════════════════════════════════════
