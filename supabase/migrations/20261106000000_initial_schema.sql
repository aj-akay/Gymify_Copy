create extension if not exists pgcrypto;

create type public.account_role as enum ('gym_goer', 'trainer', 'gym_partner', 'admin');
create type public.request_kind as enum ('connection', 'session');
create type public.request_state as enum ('pending', 'accepted', 'declined', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role public.account_role not null default 'gym_goer',
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_role public.account_role;
begin
  if coalesce(new.raw_user_meta_data ->> 'role', 'gym_goer') not in ('gym_goer', 'trainer') then
    raise exception 'Unsupported account role';
  end if;
  selected_role := coalesce(new.raw_user_meta_data ->> 'role', 'gym_goer')::public.account_role;
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, 'member'), '@', 1)),
    selected_role
  );
  if selected_role = 'trainer' then
    insert into public.trainer_profiles (user_id, display_name)
    values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, 'member'), '@', 1)));
    insert into public.trainer_private (user_id) values (new.id);
  end if;
  insert into public.subscriptions (user_id, tier, status) values (new.id, 'free', 'free');
  return new;
end;
$$;

create function public.replace_trainer_availability(p_slots jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare slot jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'trainer'
  ) then raise exception 'Trainer account required'; end if;
  if jsonb_typeof(p_slots) is distinct from 'array' then
    raise exception 'Provide a valid weekly availability schedule';
  end if;
  if jsonb_array_length(p_slots) > 42 then
    raise exception 'Provide a valid weekly availability schedule';
  end if;
  delete from public.trainer_availability where trainer_id = auth.uid();
  for slot in select value from jsonb_array_elements(p_slots) loop
    if not exists (
      select 1 from pg_catalog.pg_timezone_names
      where name = coalesce(slot ->> 'timezone', 'Asia/Manila')
    ) then raise exception 'Availability timezone is invalid'; end if;
    insert into public.trainer_availability (trainer_id, weekday, starts_at, ends_at, timezone)
    values (
      auth.uid(),
      (slot ->> 'weekday')::smallint,
      (slot ->> 'startsAt')::time,
      (slot ->> 'endsAt')::time,
      coalesce(slot ->> 'timezone', 'Asia/Manila')
    );
  end loop;
end;
$$;

create table public.gyms (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  area text not null check (char_length(area) between 1 and 120),
  address text not null check (char_length(address) between 1 and 250),
  monthly integer not null check (monthly between 0 and 1000000),
  day integer not null check (day between 0 and 1000000),
  category text not null check (char_length(category) between 1 and 80),
  description text not null check (char_length(description) <= 4000),
  hours text not null check (char_length(hours) <= 250),
  image text not null check (char_length(image) <= 2048 and image ~* '^https://[^[:space:]]+$'),
  featured boolean not null default false,
  sample boolean not null default false,
  contact_url text check (
    contact_url is null or (
      char_length(contact_url) <= 2048 and contact_url ~* '^https://[^[:space:]]+$'
    )
  ),
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table public.amenities (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table public.gym_equipment (
  gym_id text not null references public.gyms(id) on delete cascade,
  equipment_id bigint not null references public.equipment(id) on delete restrict,
  primary key (gym_id, equipment_id)
);

create table public.gym_amenities (
  gym_id text not null references public.gyms(id) on delete cascade,
  amenity_id bigint not null references public.amenities(id) on delete restrict,
  primary key (gym_id, amenity_id)
);

create index gyms_published_order on public.gyms (published, featured desc, sort_order);
create index gym_equipment_equipment_id on public.gym_equipment (equipment_id, gym_id);
create index gym_amenities_amenity_id on public.gym_amenities (amenity_id, gym_id);

create table public.gym_partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  gym_name text not null check (char_length(gym_name) between 1 and 120),
  contact_name text not null check (char_length(contact_name) between 1 and 80),
  email text not null check (char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 30),
  location text not null check (char_length(location) between 1 and 250),
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  reviewed_at timestamptz,
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index gym_partner_inquiries_email_created on public.gym_partner_inquiries (lower(email), created_at desc);

create table public.gym_partners (
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id text not null references public.gyms(id) on delete cascade,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, gym_id)
);

create table public.trainer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  bio text not null default '' check (char_length(bio) <= 2000),
  specialties text[] not null default '{}',
  service_areas text[] not null default '{}',
  avatar_url text check (
    avatar_url is null or (
      char_length(avatar_url) <= 2048 and avatar_url ~* '^https://[^[:space:]]+$'
    )
  ),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.trainer_private (
  user_id uuid primary key references public.trainer_profiles(user_id) on delete cascade,
  contact_email text check (
    contact_email is null or (
      char_length(contact_email) <= 254
      and contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    )
  ),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 30),
  contact_preference text not null default 'email' check (contact_preference in ('email', 'phone', 'either'))
);

create table public.trainer_gym_affiliations (
  trainer_id uuid not null references public.trainer_profiles(user_id) on delete cascade,
  gym_id text not null references public.gyms(id) on delete cascade,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (trainer_id, gym_id)
);

create table public.trainer_availability (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainer_profiles(user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  timezone text not null default 'Asia/Manila',
  check (ends_at > starts_at),
  unique (trainer_id, weekday, starts_at, ends_at)
);

create table public.trainer_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid not null references public.trainer_profiles(user_id) on delete cascade,
  kind public.request_kind not null,
  status public.request_state not null default 'pending',
  message text not null default '' check (char_length(message) <= 1000),
  requested_start timestamptz,
  requested_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'connection' and requested_start is null and requested_end is null)
    or (kind = 'session' and requested_start is not null and requested_end is not null and requested_end > requested_start)
  )
);

create index trainer_requests_requester_month on public.trainer_requests (requester_id, created_at);
create index trainer_requests_connection_lookup on public.trainer_requests (requester_id, trainer_id, kind, status);

create table public.saved_gyms (
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id text not null references public.gyms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, gym_id)
);

create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  status text not null default 'free'
    check (status in ('free', 'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_subscription_created bigint,
  stripe_event_created bigint not null default 0,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.stripe_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_after_signup
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger trainer_profiles_touch_updated
  before update on public.trainer_profiles
  for each row execute function public.touch_updated_at();

create trigger gyms_touch_updated
  before update on public.gyms
  for each row execute function public.touch_updated_at();
create trigger trainer_requests_touch_updated
  before update on public.trainer_requests
  for each row execute function public.touch_updated_at();

create function public.submit_trainer_request(
  p_trainer_id uuid,
  p_kind public.request_kind,
  p_message text default '',
  p_requested_start timestamptz default null,
  p_requested_end timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  is_premium boolean;
  monthly_limit integer;
  request_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = current_user_id and role = 'gym_goer') then
    raise exception 'Only gym-goer accounts can contact trainers';
  end if;
  if not exists (
    select 1 from public.trainer_profiles
    where user_id = p_trainer_id and verification_status = 'approved' and is_active
  ) then raise exception 'Trainer is not available'; end if;

  perform 1 from public.profiles where id = current_user_id for update;
  select coalesce(s.tier = 'premium' and s.status in ('active', 'trialing'), false)
    into is_premium from public.subscriptions s where s.user_id = current_user_id;
  monthly_limit := case when is_premium then 20 else 5 end;

  if (
    select count(*) from public.trainer_requests
    where requester_id = current_user_id
      and created_at >= date_trunc('month', now())
  ) >= monthly_limit then
    raise exception 'Monthly trainer request limit reached';
  end if;

  if p_kind = 'connection' then
    if exists (
      select 1 from public.trainer_requests
      where requester_id = current_user_id and trainer_id = p_trainer_id
        and kind = 'connection' and status in ('pending', 'accepted')
    ) then raise exception 'A connection request already exists'; end if;
  else
    if p_requested_start is null or p_requested_end is null
      or p_requested_start <= now()
      or p_requested_start > now() + interval '30 days'
      or p_requested_end <= p_requested_start then
      raise exception 'Choose an available future time within the next 30 days';
    end if;
    if not exists (
      select 1 from public.trainer_requests
      where requester_id = current_user_id and trainer_id = p_trainer_id
        and kind = 'connection' and status = 'accepted'
    ) then raise exception 'Trainer connection must be accepted first'; end if;
    if not exists (
      select 1 from public.trainer_availability a
      where a.trainer_id = p_trainer_id
        and extract(dow from p_requested_start at time zone a.timezone) = a.weekday
        and (p_requested_start at time zone a.timezone)::time >= a.starts_at
        and (p_requested_end at time zone a.timezone)::time <= a.ends_at
    ) then raise exception 'Requested time is not within the trainer availability'; end if;
  end if;

  insert into public.trainer_requests (
    requester_id, trainer_id, kind, message, requested_start, requested_end
  ) values (
    current_user_id, p_trainer_id, p_kind, coalesce(p_message, ''),
    p_requested_start, p_requested_end
  ) returning id into request_id;
  return request_id;
end;
$$;

create function public.set_trainer_request_status(p_request_id uuid, p_status public.request_state)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare request_row public.trainer_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('accepted', 'declined', 'cancelled') then raise exception 'Invalid status'; end if;
  select * into request_row from public.trainer_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if p_status = 'cancelled' and request_row.requester_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if p_status <> 'cancelled' and request_row.trainer_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if request_row.status <> 'pending' then raise exception 'Request is no longer pending'; end if;
  if p_status = 'accepted' and request_row.kind = 'session' then
    perform 1 from public.trainer_profiles where user_id = request_row.trainer_id for update;
    if exists (
      select 1 from public.trainer_requests
      where trainer_id = request_row.trainer_id and id <> request_row.id
        and kind = 'session' and status = 'accepted'
        and requested_start < request_row.requested_end
        and requested_end > request_row.requested_start
    ) then raise exception 'Session time is already booked'; end if;
  end if;
  update public.trainer_requests set status = p_status where id = p_request_id;
end;
$$;

create function public.submit_gym_partner_inquiry(
  p_gym_name text, p_contact_name text, p_email text, p_phone text,
  p_location text, p_message text, p_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare inquiry_id uuid;
begin
  if p_consent is distinct from true then raise exception 'Consent is required'; end if;
  if char_length(trim(p_gym_name)) not between 1 and 120
    or char_length(trim(p_contact_name)) not between 1 and 80
    or char_length(trim(p_email)) > 254
    or trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or char_length(trim(p_location)) not between 1 and 250
    or char_length(coalesce(p_phone, '')) > 30
    or char_length(coalesce(p_message, '')) > 2000 then
    raise exception 'Invalid inquiry details';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(trim(p_email)), 0));
  if (
    select count(*) from public.gym_partner_inquiries
    where lower(email) = lower(trim(p_email))
      and created_at > now() - interval '1 hour'
  ) >= 3 then raise exception 'Too many inquiries; try again later'; end if;
  insert into public.gym_partner_inquiries (
    gym_name, contact_name, email, phone, location, message, consented_at
  ) values (
    trim(p_gym_name), trim(p_contact_name), lower(trim(p_email)),
    nullif(trim(coalesce(p_phone, '')), ''), trim(p_location),
    nullif(trim(coalesce(p_message, '')), ''), now()
  ) returning id into inquiry_id;
  return inquiry_id;
end;
$$;

create function public.admin_invite_partner(p_email text, p_display_name text, p_gym_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare invited_user_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Admin access required';
  end if;
  select id into invited_user_id from auth.users where lower(email) = lower(trim(p_email));
  if invited_user_id is null then raise exception 'Create/invite the auth user before assigning a gym'; end if;
  if not exists (
    select 1 from public.profiles where id = invited_user_id and role = 'gym_goer'
  ) then raise exception 'Only an existing gym-goer account can be assigned as a gym partner'; end if;
  update public.profiles set role = 'gym_partner', display_name = p_display_name
  where id = invited_user_id;
  insert into public.gym_partners (user_id, gym_id, approved_at)
  values (invited_user_id, p_gym_id, now())
  on conflict (user_id, gym_id) do update set approved_at = now();
end;
$$;

create function public.sync_stripe_subscription(
  p_event_id text,
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_subscription_created bigint,
  p_status text,
  p_current_period_end timestamptz,
  p_event_created bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare inserted_event_id text;
begin
  if p_status not in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused') then
    raise exception 'Unsupported Stripe subscription status';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'gym_goer') then
    raise exception 'Subscription owner is not a gym-goer';
  end if;
  insert into public.stripe_webhook_events (event_id)
  values (p_event_id) on conflict do nothing returning event_id into inserted_event_id;
  if inserted_event_id is null then return false; end if;
  insert into public.subscriptions as current_subscription (
    user_id, tier, status, stripe_customer_id, stripe_subscription_id,
    stripe_subscription_created, stripe_event_created, current_period_end, updated_at
  ) values (
    p_user_id,
    case when p_status in ('active', 'trialing') then 'premium' else 'free' end,
    p_status, p_customer_id, p_subscription_id, p_subscription_created, p_event_created,
    p_current_period_end, now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    status = excluded.status,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_subscription_created = excluded.stripe_subscription_created,
    stripe_event_created = excluded.stripe_event_created,
    current_period_end = excluded.current_period_end,
    updated_at = now()
  where (
    excluded.stripe_subscription_id = current_subscription.stripe_subscription_id
    and excluded.stripe_event_created >= current_subscription.stripe_event_created
  ) or excluded.stripe_subscription_created > coalesce(current_subscription.stripe_subscription_created, 0);
  return true;
end;
$$;

alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.equipment enable row level security;
alter table public.amenities enable row level security;
alter table public.gym_equipment enable row level security;
alter table public.gym_amenities enable row level security;
alter table public.gym_partner_inquiries enable row level security;
alter table public.gym_partners enable row level security;
alter table public.trainer_profiles enable row level security;
alter table public.trainer_private enable row level security;
alter table public.trainer_gym_affiliations enable row level security;
alter table public.trainer_availability enable row level security;
alter table public.trainer_requests enable row level security;
alter table public.saved_gyms enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;

create policy "Profiles are private to their owner" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "Request participants can see shared names" on public.profiles
  for select to authenticated using (exists (
    select 1 from public.trainer_requests r
    where (r.requester_id = profiles.id and r.trainer_id = auth.uid())
      or (r.trainer_id = profiles.id and r.requester_id = auth.uid())
  ));
create policy "Published gyms are public" on public.gyms
  for select to anon, authenticated using (published);
create policy "Partners view assigned gyms" on public.gyms
  for select to authenticated using (exists (
    select 1 from public.gym_partners p
    where p.user_id = auth.uid() and p.gym_id = id and p.approved_at is not null
  ));
create policy "Approved partners edit their own gyms" on public.gyms
  for update to authenticated using (
    not sample and exists (
      select 1 from public.gym_partners p
      where p.user_id = auth.uid() and p.gym_id = id and p.approved_at is not null
    )
  ) with check (not sample);
create policy "Equipment is public" on public.equipment for select to anon, authenticated using (true);
create policy "Amenities are public" on public.amenities for select to anon, authenticated using (true);
create policy "Gym equipment is public" on public.gym_equipment for select to anon, authenticated using (true);
create policy "Gym amenities are public" on public.gym_amenities for select to anon, authenticated using (true);
create policy "Partner inquiry is private" on public.gym_partner_inquiries
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
create policy "Admins update partner inquiries" on public.gym_partner_inquiries
  for update to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )) with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
create policy "Partners see own gym assignments" on public.gym_partners
  for select to authenticated using (user_id = auth.uid());
create policy "Verified trainers are discoverable" on public.trainer_profiles
  for select to anon, authenticated using (verification_status = 'approved' and is_active);
create policy "Trainers view own profile" on public.trainer_profiles
  for select to authenticated using (user_id = auth.uid());
create policy "Trainer edits own public profile" on public.trainer_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Trainer private contact is restricted" on public.trainer_private
  for select to authenticated using (
    user_id = auth.uid() or exists (
      select 1 from public.trainer_requests r
      where r.trainer_id = user_id and r.requester_id = auth.uid()
        and r.kind = 'connection' and r.status = 'accepted'
    )
  );
create policy "Trainer edits own private contact" on public.trainer_private
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Approved trainer affiliations are public" on public.trainer_gym_affiliations
  for select to anon, authenticated using (approved_at is not null);
create policy "Trainer owns availability" on public.trainer_availability
  for all to authenticated using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy "Accepted connections view availability" on public.trainer_availability
  for select to authenticated using (exists (
    select 1 from public.trainer_requests r
    where r.trainer_id = trainer_availability.trainer_id and r.requester_id = auth.uid()
      and r.kind = 'connection' and r.status = 'accepted'
  ));
create policy "Request participants can view requests" on public.trainer_requests
  for select to authenticated using (requester_id = auth.uid() or trainer_id = auth.uid());
create policy "Users manage their own saved gyms" on public.saved_gyms
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users view own subscription" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

revoke all on public.gym_partner_inquiries from anon, authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke update (role) on public.profiles from authenticated;
grant select on public.profiles, public.gyms, public.equipment, public.amenities,
  public.gym_equipment, public.gym_amenities, public.trainer_profiles,
  public.trainer_gym_affiliations to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name, area, address, monthly, day, category, description, hours, image, contact_url)
  on public.gyms to authenticated;
grant select on public.gym_partners, public.trainer_requests, public.subscriptions to authenticated;
grant select on public.gym_partner_inquiries to authenticated;
grant update (status, reviewed_at) on public.gym_partner_inquiries to authenticated;
grant select, insert, update, delete on public.trainer_private,
  public.trainer_availability, public.saved_gyms to authenticated;
revoke update on public.trainer_profiles from authenticated;
grant update (bio, specialties, service_areas, avatar_url)
  on public.trainer_profiles to authenticated;
revoke all on function public.handle_new_user() from public;
revoke all on function public.touch_updated_at() from public;
revoke all on function public.submit_trainer_request(uuid, public.request_kind, text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.set_trainer_request_status(uuid, public.request_state)
  from public, anon, authenticated;
revoke all on function public.replace_trainer_availability(jsonb)
  from public, anon, authenticated;
revoke all on function public.submit_gym_partner_inquiry(text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_invite_partner(text, text, text)
  from public, anon, authenticated;
revoke all on function public.sync_stripe_subscription(text, uuid, text, text, bigint, text, timestamptz, bigint)
  from public, anon, authenticated;
grant execute on function public.submit_trainer_request(uuid, public.request_kind, text, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.set_trainer_request_status(uuid, public.request_state)
  to authenticated;
grant execute on function public.replace_trainer_availability(jsonb)
  to authenticated;
grant execute on function public.submit_gym_partner_inquiry(text, text, text, text, text, text, boolean)
  to anon, authenticated;
grant execute on function public.admin_invite_partner(text, text, text)
  to authenticated;
grant execute on function public.sync_stripe_subscription(text, uuid, text, text, bigint, text, timestamptz, bigint)
  to service_role;

insert into public.subscriptions (user_id, tier, status)
  select id, 'free', 'free' from public.profiles
  on conflict (user_id) do nothing;

insert into public.gyms
  (id,name,area,address,monthly,day,category,description,hours,image,featured,sample,sort_order,published)
values
  ('forge-fitness','Forge Fitness Club','Magsaysay Avenue','Sample location near Magsaysay Avenue, Naga City',1200,150,'Strength & conditioning','A sample strength-focused space with room for your everyday lifts, free weights, and a dedicated conditioning zone.','Mon–Sat 6 AM–10 PM · Sun 8 AM–6 PM','https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=85',true,true,0,true),
  ('district-athletics','District Athletics','Concepcion Pequeña','Sample location in Concepcion Pequeña, Naga City',1800,250,'Functional fitness','An example training floor built around movement, functional equipment, and flexible workouts for different experience levels.','Mon–Sat 5 AM–10 PM · Sun 7 AM–5 PM','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85',true,true,1,true),
  ('everyday-strength','Everyday Strength','Bagumbayan Sur','Sample location in Bagumbayan Sur, Naga City',800,80,'Neighborhood gym','A sample no-frills neighborhood gym with essential equipment and accessible example rates for a consistent routine.','Mon–Sat 6 AM–9 PM · Sun closed','https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=85',true,true,2,true),
  ('summit-training','Summit Training Studio','Triangulo','Sample location in Triangulo, Naga City',2200,300,'Boutique training','An illustrative compact studio with a comfortable training environment and a balanced mix of strength and cardio equipment.','Mon–Fri 6 AM–9 PM · Sat–Sun 8 AM–5 PM','https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1200&q=85',false,true,3,true),
  ('iron-yard','Iron Yard Gym','San Felipe','Sample location in San Felipe, Naga City',950,100,'Strength & conditioning','A fictional lifting space with classic strength equipment, simple facilities, and space to focus on your next set.','Mon–Sat 5 AM–9 PM · Sun 7 AM–12 PM','https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=1200&q=85',false,true,4,true),
  ('pace-wellness','Pace Fitness & Wellness','Del Rosario','Sample location in Del Rosario, Naga City',1500,200,'Everyday fitness','A sample all-round fitness space for people looking to build a sustainable routine with cardio and resistance training.','Mon–Sat 6 AM–10 PM · Sun 8 AM–4 PM','https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1200&q=85',false,true,5,true);

insert into public.equipment (name) values
  ('Free weights'), ('Squat racks'), ('Cable machines'), ('Cardio machines'), ('Kettlebells')
on conflict (name) do nothing;
insert into public.amenities (name) values
  ('Lockers'), ('Showers'), ('Parking'), ('Air conditioning')
on conflict (name) do nothing;

insert into public.gym_equipment (gym_id, equipment_id)
select mapping.gym_id, equipment.id from (values
  ('forge-fitness','Free weights'),('forge-fitness','Squat racks'),('forge-fitness','Cable machines'),('forge-fitness','Cardio machines'),
  ('district-athletics','Free weights'),('district-athletics','Squat racks'),('district-athletics','Kettlebells'),('district-athletics','Cardio machines'),
  ('everyday-strength','Free weights'),('everyday-strength','Cable machines'),
  ('summit-training','Free weights'),('summit-training','Kettlebells'),('summit-training','Cardio machines'),
  ('iron-yard','Free weights'),('iron-yard','Squat racks'),('iron-yard','Cable machines'),
  ('pace-wellness','Free weights'),('pace-wellness','Cardio machines'),('pace-wellness','Cable machines')
) as mapping(gym_id, name) join public.equipment on equipment.name = mapping.name
on conflict do nothing;

insert into public.gym_amenities (gym_id, amenity_id)
select mapping.gym_id, amenities.id from (values
  ('forge-fitness','Lockers'),('forge-fitness','Showers'),('forge-fitness','Parking'),
  ('district-athletics','Lockers'),('district-athletics','Showers'),('district-athletics','Parking'),('district-athletics','Air conditioning'),
  ('everyday-strength','Lockers'),('everyday-strength','Parking'),
  ('summit-training','Showers'),('summit-training','Air conditioning'),('summit-training','Lockers'),
  ('iron-yard','Parking'),('iron-yard','Lockers'),
  ('pace-wellness','Air conditioning'),('pace-wellness','Showers'),('pace-wellness','Parking')
) as mapping(gym_id, name) join public.amenities on amenities.name = mapping.name
on conflict do nothing;
