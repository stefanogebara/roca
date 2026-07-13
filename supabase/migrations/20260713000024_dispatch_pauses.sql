-- Number-health pause events. Two pauses within 21 days LATCH dispatch off
-- until a human clears this table for the window — pause-decay-resume
-- oscillation is Meta telling us something the ramp can't fix (red-team F1).
-- Unlatch: delete from dispatch_pauses where paused_at >= now() - interval '21 days';
create table if not exists dispatch_pauses (
  id uuid primary key default gen_random_uuid(),
  paused_at timestamptz not null default now(),
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table dispatch_pauses enable row level security;
