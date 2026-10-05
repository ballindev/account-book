-- =============================================================
-- Migration: categories 마스터 + expenses.category_id
-- 적용 위치: Supabase SQL Editor
-- 순서: 이 파일을 한 번에 실행
-- =============================================================

-- 1) categories 테이블
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  is_protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_unique unique (name)
);

comment on table public.categories is '지출 카테고리 마스터';
comment on column public.categories.is_default is '최초 시드된 기본 카테고리 여부';
comment on column public.categories.is_active is 'false면 신규 선택/분류에서 숨김 (소프트 삭제)';
comment on column public.categories.is_protected is 'true면 삭제 불가 (예: 기타)';

-- 2) 기본 카테고리 시드
insert into public.categories (name, is_default, is_active, is_protected)
values
  ('식비', true, true, false),
  ('교통', true, true, false),
  ('쇼핑', true, true, false),
  ('문화', true, true, false),
  ('기타', true, true, true)
on conflict (name) do update
set
  is_default = excluded.is_default,
  is_active = true,
  is_protected = categories.is_protected or excluded.is_protected,
  updated_at = now();

-- 3) expenses.category 텍스트 컬럼이 없다면 임시로 추가
--    (이미 있는 프로젝트는 그대로 유지)
alter table public.expenses
  add column if not exists category text;

-- 4) 기존 expenses.category 값 중 마스터에 없는 이름을 categories에 추가
insert into public.categories (name, is_default, is_active, is_protected)
select distinct trim(e.category) as name, false, true, false
from public.expenses e
where e.category is not null
  and trim(e.category) <> ''
  and not exists (
    select 1
    from public.categories c
    where c.name = trim(e.category)
  );

-- 빈/널 category는 기타로 정규화
update public.expenses
set category = '기타'
where category is null
   or trim(category) = '';

-- 5) expenses.category_id 컬럼 추가
alter table public.expenses
  add column if not exists category_id bigint;

-- 6) 기존 텍스트 category -> category_id 매핑
update public.expenses e
set category_id = c.id
from public.categories c
where e.category_id is null
  and c.name = trim(e.category);

-- 매핑 실패한 행은 기타로 연결
update public.expenses e
set category_id = c.id
from public.categories c
where e.category_id is null
  and c.name = '기타';

-- 7) category_id 필수 + FK
alter table public.expenses
  alter column category_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_category_id_fkey'
  ) then
    alter table public.expenses
      add constraint expenses_category_id_fkey
      foreign key (category_id)
      references public.categories (id)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists expenses_category_id_idx
  on public.expenses (category_id);

-- 8) 삭제 보호용 헬퍼 뷰/확인 쿼리 (참고용)
-- 카테고리별 사용 건수:
-- select c.id, c.name, c.is_active, c.is_protected, count(e.id) as expense_count
-- from public.categories c
-- left join public.expenses e on e.category_id = c.id
-- group by c.id
-- order by c.id;

-- 9) RLS (expenses와 동일하게 공개 사용 중이면 정책은 프로젝트에 맞게 조정)
alter table public.categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'Allow all access to categories'
  ) then
    create policy "Allow all access to categories"
      on public.categories
      for all
      using (true)
      with check (true);
  end if;
end $$;

-- 완료 확인
select
  (select count(*) from public.categories) as category_count,
  (select count(*) from public.expenses where category_id is null) as unmapped_expenses,
  (select count(*) from public.expenses) as total_expenses;
