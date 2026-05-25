-- ════════════════════════════════════════════════════════════════
-- Yakflo · SaaS 마이그레이션 0005 — profiles 관리자 update 정책 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 안전 재실행 가능 (drop policy if exists 선행 + begin/commit 트랜잭션)
--
-- 의존성:
--   · profiles_schema.sql — profiles 테이블 + is_admin() 함수 + 기존 정책들
--
-- ⚠️ 적용 범위 (이 파일에서 하는 일):
--   · public.profiles에 'profiles_update_admin' 정책 추가
--   · 관리자(role='admin')가 다른 사용자의 profile을 update 가능하게 허용
--
-- ⚠️ 의도된 동작:
--   · USING : public.is_admin() = true 일 때만 update 대상으로 잡힘
--   · WITH CHECK : update 후에도 호출자가 여전히 admin (다른 관리자가 권한 강탈 방지)
--   · 기존 'profiles_update_own' (본인 행만 update)는 그대로 유지
--   · PostgreSQL RLS는 UPDATE 정책을 OR로 결합하므로:
--     → 일반 사용자: 본인 행만 (profiles_update_own)
--     → 관리자: 전체 행 (profiles_update_admin)
--
-- ⚠️ 절대 건드리지 않는 것:
--   · 기존 정책 4개: profiles_select_own, profiles_update_own,
--     profiles_select_admin_all, handle_new_user 트리거
--   · 기존 데이터/컬럼 0건 수정
--
-- ⚠️ 사전 점검 권장:
--   [P1] is_admin() 함수 존재 확인 — 1행이어야 정상
--        select proname from pg_proc
--          where proname = 'is_admin' and pronamespace = 'public'::regnamespace;
--
--   [P2] 현재 profiles 정책 목록 — 3행 예상 (select_own, update_own, select_admin_all)
--        select policyname, cmd from pg_policies
--         where schemaname='public' and tablename='profiles' order by policyname;
-- ════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────
-- 관리자 update 정책 — 관리자만, 다른 사용자의 profile 수정 가능
-- USING + WITH CHECK 양쪽에 is_admin() 적용:
--   · USING       : 대상 행이 admin에게 보여야 함 (이미 select_admin_all과 일관)
--   · WITH CHECK  : update 후에도 호출자가 admin이어야 함 (자기 권한 강탈 방지)
-- ────────────────────────────────────────────────────────────────
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

commit;

-- ════════════════════════════════════════════════════════════════
-- 검증 SELECT (commit 후 별도 실행 권장)
-- ────────────────────────────────────────────────────────────────
--
-- [검증 1] profiles 정책이 총 4개로 늘었는지 (기존 3 + 신규 1)
-- ────────────────────────────────────────────────────────────────
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public' and tablename = 'profiles'
-- order by policyname;
-- (예상: 4행 — profiles_select_admin_all, profiles_select_own,
--                 profiles_update_admin (신규), profiles_update_own)
--
-- [검증 2] 신규 정책의 USING + WITH CHECK 확인
-- ────────────────────────────────────────────────────────────────
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname='public' and tablename='profiles'
--   and policyname='profiles_update_admin';
-- (예상: qual = (is_admin()), with_check = (is_admin()))
--
-- [검증 3] 앱 로그인 상태(admin)에서 다른 사용자 role을 'user' → 'user'(no-op)으로 업데이트
--          → affected rows ≥ 1 이면 정책 작동
-- ────────────────────────────────────────────────────────────────
-- update public.profiles set role = role where role = 'user';
-- (예상: 영향 받은 행 수 ≥ 0 — 에러 없으면 성공)
--
-- ════════════════════════════════════════════════════════════════
-- [롤백] 정책 제거:
-- ────────────────────────────────────────────────────────────────
-- drop policy if exists "profiles_update_admin" on public.profiles;
-- ════════════════════════════════════════════════════════════════
