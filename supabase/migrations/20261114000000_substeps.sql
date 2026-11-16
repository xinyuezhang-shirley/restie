-- Steps can hold a small checklist of substeps (A8 heuristic-eval fixes).
-- [{ "id": "…", "title": "Tune the low E", "done": false }, …]
alter table public.tasks
  add column if not exists substeps jsonb not null default '[]'::jsonb;

-- Milestones are now marked done by the person, and their progress counts
-- their real steps. steps_target stays for older clients but is unused.
comment on column public.milestones.steps_target is 'deprecated: progress counts real steps';
