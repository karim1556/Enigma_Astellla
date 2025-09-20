-- Supabase SQL schema for MediGuide
-- Run this in Supabase SQL editor

-- Enable UUID extension (Supabase has uuid_generate_v4)
create extension if not exists "uuid-ossp";

-- profiles table (1-1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  phone text,
  date_of_birth date,
  emergency_contact jsonb,
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- medications
create table if not exists public.medications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text,
  frequency text,
  instructions text,
  category text check (category in ('prescription','otc','supplement')),
  start_date date,
  end_date date,
  reminder_times text[] default '{}',
  refill_reminder boolean default false,
  refills_remaining int,
  side_effects text[] default '{}',
  interactions text[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- doses (taken log)
create table if not exists public.doses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  taken_at timestamptz not null,
  notes text,
  created_at timestamptz default now()
);

-- prescriptions
create table if not exists public.prescriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text,
  file_url text,
  status text not null default 'processing' check (status in ('processing','approved','rejected')),
  extracted_data jsonb,
  confidence numeric,
  warnings jsonb,
  upload_date timestamptz default now(),
  processed_date timestamptz,
  approved_date timestamptz
);

-- care circle members
create table if not exists public.care_circle_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid references auth.users(id),
  name text,
  email text,
  phone text,
  role text default 'member',
  permissions jsonb default '{"viewMedications": true, "viewAdherence": true, "receiveAlerts": true, "manageMedications": false}',
  status text default 'pending',
  added_date timestamptz default now(),
  message text
);

-- notifications
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text,
  message text,
  scheduled_time timestamptz,
  medication jsonb,
  read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.medications enable row level security;
alter table public.doses enable row level security;
alter table public.prescriptions enable row level security;
alter table public.care_circle_members enable row level security;
alter table public.notifications enable row level security;

-- Profiles policies
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Profiles upsert by owner" on public.profiles;
create policy "Profiles upsert by owner"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Profiles update by owner" on public.profiles;
create policy "Profiles update by owner"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Medications policies
drop policy if exists "Select own medications" on public.medications;
create policy "Select own medications"
  on public.medications
  for select
  using (auth.uid() = user_id);

drop policy if exists "Insert own medications" on public.medications;
create policy "Insert own medications"
  on public.medications
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Update own medications" on public.medications;
create policy "Update own medications"
  on public.medications
  for update
  using (auth.uid() = user_id);

drop policy if exists "Delete own medications" on public.medications;
create policy "Delete own medications"
  on public.medications
  for delete
  using (auth.uid() = user_id);

-- Doses policies
drop policy if exists "Select own doses" on public.doses;
create policy "Select own doses" on public.doses for select using (auth.uid() = user_id);
drop policy if exists "Insert own doses" on public.doses;
create policy "Insert own doses" on public.doses for insert with check (auth.uid() = user_id);

-- Prescriptions policies
drop policy if exists "Select own prescriptions" on public.prescriptions;
create policy "Select own prescriptions" on public.prescriptions for select using (auth.uid() = user_id);
drop policy if exists "Insert own prescriptions" on public.prescriptions;
create policy "Insert own prescriptions" on public.prescriptions for insert with check (auth.uid() = user_id);
drop policy if exists "Update own prescriptions" on public.prescriptions;
create policy "Update own prescriptions" on public.prescriptions for update using (auth.uid() = user_id);

-- Care circle policies
drop policy if exists "Select own care circle" on public.care_circle_members;
create policy "Select own care circle" on public.care_circle_members for select using (auth.uid() = user_id);
drop policy if exists "Modify own care circle" on public.care_circle_members;
create policy "Modify own care circle" on public.care_circle_members for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notifications policies
drop policy if exists "Select own notifications" on public.notifications;
create policy "Select own notifications" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "Modify own notifications" on public.notifications;
create policy "Modify own notifications" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage: create bucket manually named 'prescriptions' and set public read if you want public URLs, or use signed URLs.

-- =============================
-- Clerk Migration (Option A)
-- Switch user identifiers from Supabase UUID to Clerk string IDs
-- Disable RLS policies based on auth.uid(); we'll enforce access in API
-- =============================

-- 1) Disable RLS for now to avoid auth.uid() dependency
alter table if exists public.profiles disable row level security;
alter table if exists public.medications disable row level security;
alter table if exists public.doses disable row level security;
alter table if exists public.prescriptions disable row level security;
alter table if exists public.care_circle_members disable row level security;
alter table if exists public.notifications disable row level security;

-- 2) profiles.id -> text (drop FK to auth.users if exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='profiles' and column_name='id' and data_type='uuid'
  ) then
    alter table public.profiles alter column id type text using id::text;
  end if;
  begin execute 'alter table public.profiles drop constraint if exists profiles_id_fkey'; exception when others then null; end;
end$$;

-- 6) 2025-09-20 Migration: Health profiles table
do $$
begin
  create table if not exists public.health_profiles (
    user_id text primary key,
    conditions text[] default '{}',
    allergies text[] default '{}',
    current_meds jsonb default '[]'::jsonb, -- [{name, dosage, frequency, started_on}]
    surgeries jsonb default '[]'::jsonb,    -- [{name, date, notes}]
    lifestyle jsonb default '{"smoking":null,"alcohol":null,"activityLevel":null,"diet":null}'::jsonb,
    vitals jsonb default '{"height_cm":null,"weight_kg":null,"bp":null,"blood_sugar":null}'::jsonb,
    family_history jsonb default '[]'::jsonb,
    notes text,
    updated_at timestamptz default now()
  );
  -- We'll enforce access in API; keep RLS off to avoid auth.uid() dependency with Clerk ids
  alter table public.health_profiles disable row level security;
exception when others then null; end$$;

-- 3) user_id columns -> text
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='medications' and column_name='user_id' and data_type='uuid') then
    alter table public.medications alter column user_id type text using user_id::text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='doses' and column_name='user_id' and data_type='uuid') then
    alter table public.doses alter column user_id type text using user_id::text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='prescriptions' and column_name='user_id' and data_type='uuid') then
    alter table public.prescriptions alter column user_id type text using user_id::text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='care_circle_members' and column_name='user_id' and data_type='uuid') then
    alter table public.care_circle_members alter column user_id type text using user_id::text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='user_id' and data_type='uuid') then
    alter table public.notifications alter column user_id type text using user_id::text;
  end if;
end$$;

-- 4) Drop potential FKs to auth.users (names may vary; ignore errors)
do $$
begin
  begin execute 'alter table public.medications drop constraint if exists medications_user_id_fkey'; exception when others then null; end;
  begin execute 'alter table public.doses drop constraint if exists doses_user_id_fkey'; exception when others then null; end;
  begin execute 'alter table public.prescriptions drop constraint if exists prescriptions_user_id_fkey'; exception when others then null; end;
  begin execute 'alter table public.care_circle_members drop constraint if exists care_circle_members_user_id_fkey'; exception when others then null; end;
  begin execute 'alter table public.notifications drop constraint if exists notifications_user_id_fkey'; exception when others then null; end;
end$$;

-- Note: Re-introduce Clerk-aware RLS later via custom JWT/claims or API-level enforcement

-- 5) 2025-09-20 Migration: Relax medications.category and ensure reminder_times type
do $$
begin
  -- Drop restrictive category check so arbitrary categories (e.g., 'Antidiabetic') are allowed
  begin
    execute 'alter table public.medications drop constraint if exists medications_category_check';
  exception when others then null; end;

  -- Ensure reminder_times is text[] (not jsonb or text)
  begin
    execute 'alter table public.medications alter column reminder_times type text[] using case when reminder_times is null then array[]::text[] when pg_typeof(reminder_times)::text = ''jsonb'' then array(select jsonb_array_elements_text(reminder_times)) else reminder_times::text[] end';
  exception when others then null; end;

  -- Ensure default for reminder_times is empty text array
  begin
    execute 'alter table public.medications alter column reminder_times set default ''{}''::text[]';
  exception when others then null; end;
end$$;
