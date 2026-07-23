-- booroomable 2단계 DB 스키마
-- Supabase 대시보드 > SQL Editor에 이 파일 전체를 붙여넣고 실행하세요.
-- CLAUDE.md "데이터베이스 스키마" 섹션과 1:1로 대응됩니다.

create extension if not exists "pgcrypto";

-- rooms: 방 하나의 진행 상태
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'waiting', -- waiting | playing | finished
  turn_time_sec int not null default 30,
  current_player_id uuid,
  turn_number int not null default 0,
  turn_started_at timestamptz,
  host_client_id text not null,
  created_at timestamptz not null default now()
);

-- players: 방에 속한 플레이어 (신원/게임상태/외형 혼재, CLAUDE.md 참고)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  client_id text not null,
  nickname text not null,
  appearance jsonb not null default '{}'::jsonb,
  color text not null,
  position int not null default 0,
  balance int not null default 0,
  is_bankrupt boolean not null default false,
  seat_order int not null,
  is_connected boolean not null default true,
  is_ready boolean not null default false,
  created_at timestamptz not null default now()
);

-- 기존에 스키마를 먼저 실행한 적이 있어도 안전하게 컬럼만 추가되도록.
alter table players add column if not exists is_ready boolean not null default false;

-- 동시 참가 시 좌석 번호/같은 사람 중복 참가 방지.
do $$
begin
  alter table players add constraint players_room_seat_unique unique (room_id, seat_order);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table players add constraint players_room_client_unique unique (room_id, client_id);
exception when duplicate_object then null;
end $$;

-- tiles: 40칸 보드 고정 마스터 데이터 (모든 방이 공유)
create table if not exists tiles (
  idx int primary key,
  name text not null,
  type text not null, -- start | jail | empty_land
  price int,
  toll int,
  color_group text
);

-- ownerships: 방별 타일 소유 현황
create table if not exists ownerships (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  tile_idx int not null references tiles (idx),
  player_id uuid not null references players (id) on delete cascade,
  level int not null default 0
);

-- chat_messages: 실시간은 Broadcast로 전파, 이 테이블은 로그 다시보기용 (선택 기능)
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- tiles 시드 데이터: src/game/board.ts·config.ts 공식과 동일한 값
-- (초기자본 1500 / 땅값 100부터 20씩 증가 / 통행료는 땅값의 20%)
insert into tiles (idx, name, type, price, toll, color_group) values
(0, '출발', 'start', NULL, NULL, NULL),
(1, '땅 1', 'empty_land', 100, 20, NULL),
(2, '땅 2', 'empty_land', 120, 24, NULL),
(3, '땅 3', 'empty_land', 140, 28, NULL),
(4, '땅 4', 'empty_land', 160, 32, NULL),
(5, '땅 5', 'empty_land', 180, 36, NULL),
(6, '땅 6', 'empty_land', 200, 40, NULL),
(7, '땅 7', 'empty_land', 220, 44, NULL),
(8, '땅 8', 'empty_land', 240, 48, NULL),
(9, '땅 9', 'empty_land', 260, 52, NULL),
(10, '땅 10', 'empty_land', 280, 56, NULL),
(11, '땅 11', 'empty_land', 300, 60, NULL),
(12, '땅 12', 'empty_land', 320, 64, NULL),
(13, '땅 13', 'empty_land', 340, 68, NULL),
(14, '땅 14', 'empty_land', 360, 72, NULL),
(15, '땅 15', 'empty_land', 380, 76, NULL),
(16, '땅 16', 'empty_land', 400, 80, NULL),
(17, '땅 17', 'empty_land', 420, 84, NULL),
(18, '땅 18', 'empty_land', 440, 88, NULL),
(19, '땅 19', 'empty_land', 460, 92, NULL),
(20, '무인도', 'jail', NULL, NULL, NULL),
(21, '땅 20', 'empty_land', 480, 96, NULL),
(22, '땅 21', 'empty_land', 500, 100, NULL),
(23, '땅 22', 'empty_land', 520, 104, NULL),
(24, '땅 23', 'empty_land', 540, 108, NULL),
(25, '땅 24', 'empty_land', 560, 112, NULL),
(26, '땅 25', 'empty_land', 580, 116, NULL),
(27, '땅 26', 'empty_land', 600, 120, NULL),
(28, '땅 27', 'empty_land', 620, 124, NULL),
(29, '땅 28', 'empty_land', 640, 128, NULL),
(30, '땅 29', 'empty_land', 660, 132, NULL),
(31, '땅 30', 'empty_land', 680, 136, NULL),
(32, '땅 31', 'empty_land', 700, 140, NULL),
(33, '땅 32', 'empty_land', 720, 144, NULL),
(34, '땅 33', 'empty_land', 740, 148, NULL),
(35, '땅 34', 'empty_land', 760, 152, NULL),
(36, '땅 35', 'empty_land', 780, 156, NULL),
(37, '땅 36', 'empty_land', 800, 160, NULL),
(38, '땅 37', 'empty_land', 820, 164, NULL),
(39, '땅 38', 'empty_land', 840, 168, NULL)
on conflict (idx) do nothing;

-- 이후 Postgres Changes 구독(상태 동기화)에 쓰일 테이블만 리얼타임 복제를 켜둔다.
-- 이미 추가되어 있으면 에러 없이 무시된다.
do $$
begin
  alter publication supabase_realtime add table rooms;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table players;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table ownerships;
exception when duplicate_object then null;
end $$;

-- RLS는 아직 켜지 않음: 로그인/Edge Function 도입 시점에 강화 예정 (CLAUDE.md "보안" 참고).
