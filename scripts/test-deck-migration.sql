-- Test fixture only, for the disposable zaff_test database.
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table auth.users (id uuid primary key);
insert into auth.users values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
create table public.mazzi (
  id text primary key, name text not null, cards jsonb not null default '[]',
  created_at timestamptz default now(), source text,
  created_by uuid default auth.uid() references auth.users(id),
  colors jsonb not null default '[]', format text not null default ''
);
insert into public.mazzi (id,name,cards,created_by) values
  ('legacy','Legacy','[{"name":"Island","qty":2},{"name":"island","qty":1},{"name":"Island","qty":1,"section":"side"}]',null),
  ('other','Other','[{"name":"Forest","qty":1}]','22222222-2222-4222-8222-222222222222');
