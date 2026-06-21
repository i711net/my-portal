create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  category text,
  tags text,
  cover_url text,
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  rich_content text,
  rich_text text,
  blocks jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists posts_status_published_at_idx
  on public.posts (status, published_at desc);

create table if not exists public.home_settings (
  language text primary key check (language in ('zh', 'en', 'ko')),
  site_name text not null,
  marquee_text text not null default '',
  marquee_items jsonb not null default '[]'::jsonb,
  marquee_speed integer not null default 18,
  marquee_gap integer not null default 2,
  headline text not null,
  intro text not null,
  start_writing text not null,
  browse_posts text not null,
  featured_title text not null,
  latest_title text not null,
  seo_title text not null,
  seo_description text not null,
  contact_title text not null default '联系我',
  contact_intro text not null default '',
  contact_button text not null default '发送留言',
  friend_links_title text not null default '友情链接',
  friend_links_intro text not null default '',
  friend_links jsonb not null default '[]'::jsonb,
  background_color text not null default '#ffffff',
  background_image text not null default '',
  layout_order jsonb not null default '["hero", "latest", "friends", "contact"]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.home_settings
  add column if not exists layout_order jsonb not null default '["hero", "latest", "friends", "contact"]'::jsonb;

alter table public.home_settings
  alter column layout_order set default '["hero", "latest", "friends", "contact"]'::jsonb;

alter table public.home_settings
  add column if not exists contact_title text not null default '联系我',
  add column if not exists contact_intro text not null default '',
  add column if not exists contact_button text not null default '发送留言';

alter table public.home_settings
  add column if not exists friend_links_title text not null default '友情链接',
  add column if not exists friend_links_intro text not null default '',
  add column if not exists friend_links jsonb not null default '[]'::jsonb;

alter table public.home_settings
  add column if not exists background_color text not null default '#ffffff',
  add column if not exists background_image text not null default '';

alter table public.home_settings
  add column if not exists marquee_text text not null default '',
  add column if not exists marquee_items jsonb not null default '[]'::jsonb,
  add column if not exists marquee_speed integer not null default 18,
  add column if not exists marquee_gap integer not null default 2;

create table if not exists public.site_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  message text not null check (char_length(message) between 2 and 200),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_login_attempts (
  ip_address text primary key,
  attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_categories (
  slug text primary key,
  label_en text not null,
  label_zh text not null,
  label_ko text not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.blog_categories (slug, label_en, label_zh, label_ko, sort_order)
values
  ('Workflow', 'Workflow', '工作流', '워크플로', 0),
  ('Engineering', 'Engineering', '工程', '엔지니어링', 1),
  ('Publishing', 'Publishing', '发布', '발행', 2),
  ('Design', 'Design', '设计', '디자인', 3)
on conflict (slug) do nothing;

alter table public.posts enable row level security;
alter table public.home_settings enable row level security;
alter table public.blog_categories enable row level security;
alter table public.site_messages enable row level security;
alter table public.admin_login_attempts enable row level security;

drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts"
  on public.posts
  for select
  using (status = 'Published');

drop policy if exists "Public can read home settings" on public.home_settings;
create policy "Public can read home settings"
  on public.home_settings
  for select
  using (true);

drop policy if exists "Public can read categories" on public.blog_categories;
create policy "Public can read categories"
  on public.blog_categories
  for select
  using (true);

notify pgrst, 'reload schema';
