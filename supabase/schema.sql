create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  microsoft_id text,
  avatar_url text,
  name text not null,
  email text unique not null,
  password_hash text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  phone text,
  brokerage_commission_rate numeric default 0,
  ad_commission_rate numeric default 0,
  is_active boolean default true,
  last_login_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles add column if not exists password_hash text;

create table if not exists salary_formulas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  formula_total text,
  formula_deduction text,
  formula_transfer text,
  formula_remaining text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references profiles(id),
  contract_date date,
  contract_number text,
  customer_name text,
  residence_status text,
  phone text,
  property_name text,
  address text,
  rent numeric default 0,
  bank_deposit numeric default 0,
  withdrawal numeric default 0,
  transfer_fee numeric default 0,
  brokerage_sales numeric default 0,
  ad_sales numeric default 0,
  ad_payment numeric default 0,
  refund_or_adjustment numeric default 0,
  contract_type text,
  management_company text,
  previous_ad_payment numeric default 0,
  salary_item text,
  salary_settlement numeric default 0,
  expected_payment_amount numeric default 0,
  actual_received_amount numeric default 0,
  payment_status text default '未確認' check (payment_status in ('未確認', '入金待ち', '一部入金', '入金済み', '返金あり', 'キャンセル')),
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid references profiles(id),
  payment_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists salary_monthly (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references profiles(id),
  target_month text not null,
  brokerage_sales_total numeric default 0,
  ad_sales_total numeric default 0,
  brokerage_commission numeric default 0,
  ad_commission numeric default 0,
  social_insurance numeric default 0,
  pension numeric default 0,
  employment_insurance numeric default 0,
  income_tax numeric default 0,
  commuter_pass numeric default 0,
  contract_transportation numeric default 0,
  it_cost numeric default 0,
  property_management_cost numeric default 0,
  previous_remaining_amount numeric default 0,
  expense_receipts numeric default 0,
  other_deduction numeric default 0,
  other_payment numeric default 0,
  total_amount numeric default 0,
  transfer_amount numeric default 0,
  actual_transfer_amount numeric default 0,
  remaining_amount numeric default 0,
  status text default '下書き' check (status in ('下書き', '確定', '支払済み')),
  confirmed_at timestamptz,
  confirmed_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(staff_id, target_month)
);

alter table profiles enable row level security;
alter table contracts enable row level security;
alter table salary_formulas enable row level security;
alter table salary_monthly enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and is_active = true);
$$;

drop policy if exists "profiles self read" on profiles;
create policy "profiles self read" on profiles for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles admin write" on profiles;
create policy "profiles admin write" on profiles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "contracts staff read own" on contracts;
create policy "contracts staff read own" on contracts for select using (staff_id = auth.uid() or public.is_admin());

drop policy if exists "contracts staff insert own" on contracts;
create policy "contracts staff insert own" on contracts for insert with check (staff_id = auth.uid() or public.is_admin());

drop policy if exists "contracts admin write" on contracts;
create policy "contracts admin write" on contracts for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "formulas admin all" on salary_formulas;
create policy "formulas admin all" on salary_formulas for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "salaries visible" on salary_monthly;
create policy "salaries visible" on salary_monthly for select using (staff_id = auth.uid() or public.is_admin());

drop policy if exists "salaries admin write" on salary_monthly;
create policy "salaries admin write" on salary_monthly for all using (public.is_admin()) with check (public.is_admin());

insert into salary_formulas (name, formula_total, formula_deduction, formula_transfer, formula_remaining, is_default)
values (
  '標準給与計算',
  '売買売上合計 * 売買歩合率 + 賃貸売上合計 * 賃貸歩合率 + 前月残り金額',
  '社会保険 + 年金料 + 雇用保険料 + 所得税 + 定期券 + 成約交通費 + IT + 物件管理費用 + 経費領収書 + その他控除',
  '合計 - 控除合計 + その他支給',
  '合計 - 控除合計 + その他支給 - 実際振込金額',
  true
)
on conflict do nothing;
