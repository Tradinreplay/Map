-- Add dataset_group column to markers table
-- This column is used to isolate data between different login groups (1, 2, 3)
-- Default is '3' because the user specified current data belongs to group 3
ALTER TABLE markers ADD COLUMN dataset_group text DEFAULT '3';

-- Add dataset_group column to groups table
ALTER TABLE groups ADD COLUMN dataset_group text DEFAULT '3';

-- Add dataset_group column to subgroups table
ALTER TABLE subgroups ADD COLUMN dataset_group text DEFAULT '3';

-- Update existing records just in case the default didn't apply retrospectively (Postgres ADD COLUMN with DEFAULT usually does, but good to be safe)
UPDATE markers SET dataset_group = '3' WHERE dataset_group IS NULL;
UPDATE groups SET dataset_group = '3' WHERE dataset_group IS NULL;
UPDATE subgroups SET dataset_group = '3' WHERE dataset_group IS NULL;

-- Enable RLS policies if needed, but for now we rely on the client-side filtering + backend column
-- If RLS was strict, we would need to authenticate with Supabase Auth Users corresponding to these groups,
-- but since we are using a custom login system with hardcoded credentials, we'll likely stick to 
-- client-side filtering or a simple RLS using a header if we were advanced, but for now, 
-- just adding the column is the first step.
