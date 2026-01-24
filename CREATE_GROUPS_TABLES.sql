-- Create groups table
create table groups (
  id text primary key,
  name text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create subgroups table
create table subgroups (
  id text primary key,
  name text,
  group_id text, -- We can add foreign key constraint if we want strict integrity, but for loose sync sometimes it's easier without strict FK if sync order varies. Let's keep it simple.
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table groups enable row level security;
alter table subgroups enable row level security;

-- Policies (Public access for now, similar to markers)
create policy "Public Access Groups" on groups for all using (true) with check (true);
create policy "Public Access Subgroups" on subgroups for all using (true) with check (true);
