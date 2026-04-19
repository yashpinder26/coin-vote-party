-- ────────────────────────────────────────────────────────────
-- 十円 Coin Vote — Supabase Schema
-- Run this in your Supabase SQL editor
-- ────────────────────────────────────────────────────────────

-- Drop tables if re-running
drop table if exists votes;
drop table if exists players;
drop table if exists rooms;

-- Rooms
create table rooms (
  id            uuid        default gen_random_uuid() primary key,
  code          char(4)     unique not null,
  host_player_id text       not null,
  status        text        default 'lobby'
                            check (status in ('lobby', 'voting', 'reveal')),
  current_question text,
  round         integer     default 0,
  created_at    timestamptz default now()
);

-- Players
create table players (
  id        text        primary key,
  room_id   uuid        references rooms(id) on delete cascade,
  name      text        not null,
  is_host   boolean     default false,
  connected boolean     default true,
  created_at timestamptz default now()
);

-- Votes
create table votes (
  id         uuid        default gen_random_uuid() primary key,
  room_id    uuid        references rooms(id) on delete cascade,
  player_id  text        references players(id) on delete cascade,
  vote       boolean     not null,
  round      integer     not null,
  created_at timestamptz default now(),
  unique(room_id, player_id, round)
);

-- Indexes
create index idx_players_room   on players(room_id);
create index idx_votes_room     on votes(room_id, round);

-- Disable RLS for simplicity (party game, no sensitive data)
alter table rooms   disable row level security;
alter table players disable row level security;
alter table votes   disable row level security;

-- Enable Realtime for all three tables
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table votes;

-- Optional: auto-cleanup rooms older than 24 hours
-- (requires pg_cron extension, enable in Supabase dashboard if desired)
-- select cron.schedule('cleanup-old-rooms', '0 * * * *',
--   $$ delete from rooms where created_at < now() - interval '24 hours' $$);
