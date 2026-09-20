-- Server-enforced fixed-window rate limits for PACSA Edge Functions.

begin;

create table if not exists public.api_rate_limits (
  key_hash text not null,
  route text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (key_hash, route, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;

create index if not exists api_rate_limits_window_start_idx
  on public.api_rate_limits (window_start);

create or replace function public.pacsa_check_rate_limit(
  p_key_hash text,
  p_route text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  current_count integer;
  seconds_left integer;
begin
  if p_key_hash is null or length(p_key_hash) <> 64 then
    raise exception 'Invalid rate-limit key.';
  end if;
  if p_route is null or length(trim(p_route)) = 0 then
    raise exception 'Invalid rate-limit route.';
  end if;
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit configuration.';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits(key_hash, route, window_start, request_count)
  values (p_key_hash, p_route, current_window, 1)
  on conflict (key_hash, route, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into current_count;

  seconds_left := greatest(
    1,
    ceil(extract(epoch from (current_window + make_interval(secs => p_window_seconds) - clock_timestamp())))::integer
  );

  return query select
    current_count <= p_limit,
    greatest(0, p_limit - current_count),
    seconds_left;
end;
$$;

revoke all on function public.pacsa_check_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.pacsa_check_rate_limit(text,text,integer,integer)
  to service_role;

commit;
