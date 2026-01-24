# Supabase Setup Instructions

To make the map application work with Supabase, follow these steps:

## 1. Create a Supabase Project
Go to [Supabase](https://supabase.com/) and create a new project.

## 2. Database Setup
Run the following SQL in the Supabase SQL Editor to create the `markers` table:

```sql
create table markers (
  id text primary key,
  name text,
  description text,
  lat double precision,
  lng double precision,
  group_id text,
  subgroup_id text,
  color text,
  icon text,
  image_data jsonb,
  route_records jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
alter table markers enable row level security;

-- Create a policy that allows anyone to read/write (for development)
-- WARN: For production, you should restrict this!
create policy "Public Access" on markers
for all using (true) with check (true);
```

### Setup Groups and Subgroups
Run the content of `CREATE_GROUPS_TABLES.sql` or copy below:

```sql
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
  group_id text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table groups enable row level security;
alter table subgroups enable row level security;

-- Policies
create policy "Public Access Groups" on groups for all using (true) with check (true);
create policy "Public Access Subgroups" on subgroups for all using (true) with check (true);
```

## 3. Storage Setup

To fix the "new row violates row-level security policy" error, you need to set up the correct RLS policies.

1. Go to the **SQL Editor** in your Supabase dashboard.
2. Open the file `FIX_STORAGE_RLS.sql` included in this project.
3. Copy the entire content of `FIX_STORAGE_RLS.sql` and paste it into the Supabase SQL Editor.
4. Click **Run**.

This script will:
- Ensure the `marker-images` bucket exists and is set to **Public**.
- Create policies to allow anyone (including anonymous users) to View, Upload, Update, and Delete images in this bucket.

### Alternative Manual Setup (if not using SQL)
1. Go to "Storage" in the Supabase dashboard.
2. Ensure a bucket named `marker-images` exists.
3. Click on the bucket settings (three dots) -> **Edit bucket**.
4. Make sure "Public bucket" is **ON**.
5. Go to the **Configuration** -> **Policies** tab for Storage.
6. Under `marker-images`, click "New Policy".
7. Choose "For full customization".
8. Create a policy for "SELECT", "INSERT", "UPDATE", "DELETE" operations, ensuring both `USING` and `WITH CHECK` expressions are set to `bucket_id = 'marker-images'`.

## 4. Configuration
1. Open `config.js` in the project root.
2. Replace `YOUR_SUPABASE_URL` with your project URL (found in Settings > API).
3. Replace `YOUR_SUPABASE_ANON_KEY` with your `anon` public key (found in Settings > API).

## 5. Usage
- **Auto Upload**: When you add or edit a marker, it will be automatically uploaded to Supabase.
- **Sync**: Open the settings menu (⚙️) and click the "Sync to Cloud" (☁️) button to upload all existing markers.
