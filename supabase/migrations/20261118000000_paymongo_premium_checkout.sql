create table public.paymongo_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkout_session_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.paymongo_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.paymongo_purchases enable row level security;
alter table public.paymongo_webhook_events enable row level security;
revoke all on public.paymongo_purchases, public.paymongo_webhook_events from anon, authenticated;
grant all on public.paymongo_purchases, public.paymongo_webhook_events to service_role;

create function public.sync_paymongo_purchase(
  p_event_id text,
  p_purchase_id uuid,
  p_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_event_id text;
  purchase_row public.paymongo_purchases%rowtype;
begin
  if p_event_id is null or p_event_id = '' or p_checkout_session_id is null or p_checkout_session_id = '' then
    raise exception 'PayMongo event details are invalid';
  end if;

  insert into public.paymongo_webhook_events (event_id)
  values (p_event_id) on conflict do nothing returning event_id into inserted_event_id;
  if inserted_event_id is null then return false; end if;

  select * into purchase_row from public.paymongo_purchases where id = p_purchase_id for update;
  if not found or purchase_row.checkout_session_id is distinct from p_checkout_session_id then
    raise exception 'PayMongo purchase reference does not match';
  end if;
  if purchase_row.status = 'paid' then return false; end if;

  update public.paymongo_purchases set status = 'paid', paid_at = now() where id = p_purchase_id;
  insert into public.subscriptions as current_subscription (user_id, tier, status, current_period_end, updated_at)
  values (purchase_row.user_id, 'premium', 'active', now() + interval '30 days', now())
  on conflict (user_id) do update set
    tier = 'premium',
    status = 'active',
    current_period_end = greatest(coalesce(current_subscription.current_period_end, now()), now()) + interval '30 days',
    updated_at = now();
  return true;
end;
$$;

revoke all on function public.sync_paymongo_purchase(text, uuid, text) from public, anon, authenticated;
grant execute on function public.sync_paymongo_purchase(text, uuid, text) to service_role;

create or replace function public.submit_trainer_request(
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
  select coalesce(
    s.tier = 'premium' and s.status in ('active', 'trialing')
      and s.current_period_end > now(),
    false
  ) into is_premium from public.subscriptions s where s.user_id = current_user_id;
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
