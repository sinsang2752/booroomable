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
  skip_next_turn boolean not null default false,
  created_at timestamptz not null default now()
);

-- 기존에 스키마를 먼저 실행한 적이 있어도 안전하게 컬럼만 추가되도록.
alter table players add column if not exists is_ready boolean not null default false;
alter table players add column if not exists skip_next_turn boolean not null default false;

-- 게임 상태 동기화(진행 중인 방의 턴/주사위/구매대기/승자 등)를 위한 rooms 컬럼.
alter table rooms add column if not exists phase text not null default 'awaiting-roll';
alter table rooms add column if not exists last_roll_d1 int;
alter table rooms add column if not exists last_roll_d2 int;
alter table rooms add column if not exists is_double_roll boolean not null default false;
alter table rooms add column if not exists pending_purchase_tile_idx int;
alter table rooms add column if not exists winner_player_id uuid;
alter table rooms add column if not exists notice text;
-- 낙관적 동시성 가드: 액션을 처리할 때마다 1씩 증가시키고, 쓸 때 이 값이 그대로인지 확인한다.
alter table rooms add column if not exists version int not null default 0;

-- 동시 참가 시 좌석 번호/같은 사람 중복 참가 방지.
-- (unique 제약은 내부적으로 같은 이름의 인덱스를 만들어서, 이미 있으면
-- duplicate_object가 아니라 duplicate_table로 걸리는 경우가 있어 둘 다 잡아준다.)
do $$
begin
  alter table players add constraint players_room_seat_unique unique (room_id, seat_order);
exception when duplicate_object or duplicate_table then null;
end $$;

do $$
begin
  alter table players add constraint players_room_client_unique unique (room_id, client_id);
exception when duplicate_object or duplicate_table then null;
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

-- 같은 방의 같은 칸을 두 번 구매(중복 insert)하는 것 방지.
do $$
begin
  alter table ownerships add constraint ownerships_room_tile_unique unique (room_id, tile_idx);
exception when duplicate_object or duplicate_table then null;
end $$;

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
-- 참고: idx 5/10/15/18/25/30/35는 여기서 'empty_land'로 심어져 있지만 실제로는 board.ts 기준
-- 황금열쇠/기금/우주여행 특수칸이다(2단계 시드 이후 board.ts에 3단계 특수칸이 추가되면서 어긋남).
-- 클라이언트가 이 테이블을 아직 안 읽어서 지금은 영향 없음 — 나중에 DB를 실제로 읽도록
-- 마이그레이션할 때 타입까지 같이 바로잡을 것. 이번엔 이름만 board.ts와 맞춘다.
insert into tiles (idx, name, type, price, toll, color_group) values
(0, '출발', 'start', NULL, NULL, NULL),
(1, '하노이', 'empty_land', 100, 20, NULL),
(2, '자카르타', 'empty_land', 120, 24, NULL),
(3, '마닐라', 'empty_land', 140, 28, NULL),
(4, '방콕', 'empty_land', 160, 32, NULL),
(5, '땅 5', 'empty_land', 180, 36, NULL),
(6, '쿠알라룸푸르', 'empty_land', 200, 40, NULL),
(7, '타이베이', 'empty_land', 220, 44, NULL),
(8, '마카오', 'empty_land', 240, 48, NULL),
(9, '제주도', 'empty_land', 260, 52, NULL),
(10, '땅 10', 'empty_land', 280, 56, NULL),
(11, '아테네', 'empty_land', 300, 60, NULL),
(12, '프라하', 'empty_land', 320, 64, NULL),
(13, '리스본', 'empty_land', 340, 68, NULL),
(14, '바르샤바', 'empty_land', 360, 72, NULL),
(15, '땅 15', 'empty_land', 380, 76, NULL),
(16, '코펜하겐', 'empty_land', 400, 80, NULL),
(17, '스톡홀름', 'empty_land', 420, 84, NULL),
(18, '땅 18', 'empty_land', 440, 88, NULL),
(19, '하와이', 'empty_land', 460, 92, NULL),
(20, '무인도', 'jail', NULL, NULL, NULL),
(21, '부에노스아이레스', 'empty_land', 480, 96, NULL),
(22, '상파울루', 'empty_land', 500, 100, NULL),
(23, '시드니', 'empty_land', 520, 104, NULL),
(24, '멜버른', 'empty_land', 540, 108, NULL),
(25, '땅 24', 'empty_land', 560, 112, NULL),
(26, '두바이', 'empty_land', 580, 116, NULL),
(27, '바르셀로나', 'empty_land', 600, 120, NULL),
(28, '산토리니', 'empty_land', 620, 124, NULL),
(29, '부산', 'empty_land', 640, 128, NULL),
(30, '땅 29', 'empty_land', 660, 132, NULL),
(31, '베를린', 'empty_land', 680, 136, NULL),
(32, '로마', 'empty_land', 700, 140, NULL),
(33, '도쿄', 'empty_land', 720, 144, NULL),
(34, '파리', 'empty_land', 740, 148, NULL),
(35, '땅 34', 'empty_land', 760, 152, NULL),
(36, '런던', 'empty_land', 780, 156, NULL),
(37, '뉴욕', 'empty_land', 800, 160, NULL),
(38, '나이아가라', 'empty_land', 820, 164, NULL),
(39, '서울', 'empty_land', 840, 168, NULL)
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

-- RLS 강화: 게임 상태(rooms/players/ownerships) 쓰기는 이제 game-action Edge Function
-- (서비스 롤 키, RLS를 항상 우회함)만 할 수 있게 잠근다. 로비 CRUD(방 생성/참가/나가기/
-- 준비토글/턴시간설정)는 그대로 anon 키로 직접 처리하므로 그 부분 권한은 열어둔다.
alter table rooms enable row level security;
alter table players enable row level security;
alter table ownerships enable row level security;

-- 읽기는 전부 허용 (로비/게임 화면 렌더링 + Postgres Changes 구독에 필요).
drop policy if exists rooms_select_anon on rooms;
create policy rooms_select_anon on rooms for select using (true);

drop policy if exists players_select_anon on players;
create policy players_select_anon on players for select using (true);

drop policy if exists ownerships_select_anon on ownerships;
create policy ownerships_select_anon on ownerships for select using (true);

-- 로비 CRUD용 insert/delete/update 정책 (rooms/players만 — ownerships는 정책이 아예
-- 없어서 anon은 insert/update/delete를 전혀 못 하고, Edge Function(서비스 롤)만 가능).
drop policy if exists rooms_insert_anon on rooms;
create policy rooms_insert_anon on rooms for insert with check (true);
drop policy if exists rooms_delete_anon on rooms;
create policy rooms_delete_anon on rooms for delete using (true);
drop policy if exists rooms_update_anon on rooms;
create policy rooms_update_anon on rooms for update using (true) with check (true);

drop policy if exists players_insert_anon on players;
create policy players_insert_anon on players for insert with check (true);
drop policy if exists players_delete_anon on players;
create policy players_delete_anon on players for delete using (true);
drop policy if exists players_update_anon on players;
create policy players_update_anon on players for update using (true) with check (true);

-- 위 update 정책은 "어느 행을 고칠 수 있는지"만 허용하는 것 — 실제로 "어느 컬럼을
-- 고칠 수 있는지"는 RLS가 아니라 컬럼 단위 GRANT로 잠근다. 게임 상태 컬럼(balance,
-- position, phase, version 등)은 이제 anon 키로는 아예 못 쓰고 Edge Function만 쓸 수 있다.
revoke update on rooms from anon;
grant update (turn_time_sec, host_client_id) on rooms to anon; -- 턴시간설정/방장위임(나가기)만 허용

revoke update on players from anon;
grant update (is_ready) on players to anon; -- 준비 토글만 허용

-- 3단계 황금열쇠: 안 뽑은 카드 순서(셔플 결과)를 서버가 들고 있어야 클라이언트가
-- 다음 카드를 미리 못 본다. rooms는 이미 위에서 컬럼 단위로 잠갔으니 새 컬럼도
-- 자동으로 anon이 못 건드림(Edge Function만 가능) — 별도 GRANT 불필요.
alter table rooms add column if not exists event_deck jsonb;

-- 3단계 사회복지기금: 적립액. 위와 동일한 이유로 별도 GRANT 불필요(Edge Function만 씀).
alter table rooms add column if not exists welfare_pool int not null default 0;

-- 3단계 무인도 확장: 남은 대기 턴 수(0=무인도 아님, 3부터 카운트다운). 기존 skip_next_turn
-- (1턴 스킵)을 대체 — 컬럼은 되돌리기 어려운 DROP 대신 그대로 두고 코드에서만 새 컬럼을 쓴다.
alter table players add column if not exists jail_turns_left int not null default 0;

-- 3단계 더블 3연속 판정용. 턴이 실제로 다음 사람에게 넘어갈 때마다 0으로 리셋.
alter table rooms add column if not exists consecutive_doubles int not null default 0;

-- 주사위를 실제로 굴릴 때만 +1 되는 카운터. 클라이언트가 "새 굴림"을 정확히 식별해 말 이동
-- 애니메이션을 주사위가 멈춘 뒤로 미루는 데 쓴다(lastRoll 눈만으로는 직전과 눈이 같으면 구분
-- 불가). 위 컬럼들과 동일하게 anon은 못 쓰고 Edge Function만 갱신(별도 GRANT 불필요).
alter table rooms add column if not exists roll_seq int not null default 0;

-- 3단계 원작 재분석: 땅 이름을 실제 지역명으로 교체(CLAUDE.md "보드 칸 구성" 표 그대로).
-- 가격/타입/인덱스는 이번 단계에서 안 건드림 — name 컬럼만 바뀐다.
-- idx 5/10/15/18/25/30/35는 board.ts 기준 황금열쇠/기금/우주여행 특수칸이라 여기서 제외
-- (이 테이블 시드 자체가 그 특수칸들 도입 전에 만들어져서 지금도 'empty_land'로 잘못 들어있는
-- 상태 — 이번 이름 교체 범위 밖이라 그대로 둠, 위 INSERT 블록 주석 참고).
-- 이미 방을 만들어봐서 tiles가 예전 INSERT로 채워져 있는 DB에는 위 INSERT가
-- `on conflict do nothing`이라 적용 안 되므로, 기존 행은 이 UPDATE로 갱신한다.
update tiles as t set name = v.name
from (values
  (1, '하노이'), (2, '자카르타'), (3, '마닐라'), (4, '방콕'),
  (6, '쿠알라룸푸르'), (7, '타이베이'), (8, '마카오'), (9, '제주도'),
  (11, '아테네'), (12, '프라하'), (13, '리스본'), (14, '바르샤바'),
  (16, '코펜하겐'), (17, '스톡홀름'), (19, '하와이'),
  (21, '부에노스아이레스'), (22, '상파울루'), (23, '시드니'), (24, '멜버른'),
  (26, '두바이'), (27, '바르셀로나'), (28, '산토리니'), (29, '부산'),
  (31, '베를린'), (32, '로마'), (33, '도쿄'), (34, '파리'),
  (36, '런던'), (37, '뉴욕'), (38, '나이아가라'), (39, '서울')
) as v(idx, name)
where t.idx = v.idx;
