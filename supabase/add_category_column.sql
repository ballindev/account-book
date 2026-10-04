-- expenses 테이블에 category 컬럼 추가
alter table public.expenses
  add column if not exists category text not null default '기타';

-- 허용 카테고리 제한 (이미 있으면가 있으면 있으면 실패할 수 있음)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_category_check'
  ) then
    alter table public.expenses
      add constraint expenses_category_check
      check (category in ('식비', '교통', '쇼핑', '문화', '기타'));
  end if;
end $$;
