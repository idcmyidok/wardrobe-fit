-- 10단계 AI 구매 판단기: 판단 기록(fit_checks)과 비교 대상(fit_check_comparables)은 사용자가 고치거나 지울 수 없게 한다.
-- 지울 수 있으면 하루 판단 20회·AI 10회 제한을 스스로 초기화할 수 있다(product_imports와 같은 방식, 마이그레이션 5 참고).
-- 서버(/api/fit-checks)는 계산과 AI 요약을 끝낸 뒤 사용자 세션으로 한 번에 insert만 한다. 계정을 지우면 FK cascade로 함께 지워진다.

drop policy if exists "fit_checks_update_own" on public.fit_checks;
drop policy if exists "fit_checks_delete_own" on public.fit_checks;
drop policy if exists "fit_check_comparables_update_own" on public.fit_check_comparables;
drop policy if exists "fit_check_comparables_delete_own" on public.fit_check_comparables;

-- AI 결과 캐시 조회(같은 사용자·같은 입력 해시)
create index if not exists fit_checks_user_ai_hash_idx on public.fit_checks (user_id, ((computed ->> 'aiInputHash')))
  where interpretation is not null;
