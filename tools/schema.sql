-- 用户 profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 会话
create table public.conversations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  summary text,
  mood_trail jsonb default '[]'::jsonb
);
create index idx_conversations_user on public.conversations(user_id);

-- 消息
create table public.messages (
  id bigserial primary key,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  mood text,
  created_at timestamptz default now()
);
create index idx_messages_conversation on public.messages(conversation_id);

-- 长期记忆
create table public.memories (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  source_conversation_id bigint references public.conversations(id) on delete set null,
  importance real default 0.5,
  access_count int default 0,
  last_accessed timestamptz,
  created_at timestamptz default now()
);
create index idx_memories_user on public.memories(user_id);

-- 用户画像
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary text,
  traits jsonb default '{}'::jsonb,
  topics jsonb default '[]'::jsonb,
  emotional_patterns jsonb default '{}'::jsonb,
  session_count int default 0,
  last_summarized_at timestamptz,
  version int default 1,
  updated_at timestamptz default now()
);

-- RLS 启用
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.user_profiles enable row level security;

-- 只读策略（用户只能看自己的），写操作走后端 service role
create policy "select_own" on public.profiles for select using (auth.uid() = id);
create policy "select_own" on public.conversations for select using (auth.uid() = user_id);
create policy "select_own" on public.messages for select using (auth.uid() = user_id);
create policy "select_own" on public.memories for select using (auth.uid() = user_id);
create policy "select_own" on public.user_profiles for select using (auth.uid() = user_id);

-- profiles 允许用户自己 insert/update（注册时创建）
create policy "insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "update_own" on public.profiles for update using (auth.uid() = id);
