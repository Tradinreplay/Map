-- Supabase Storage RLS 修復腳本
-- 請將此腳本複製到 Supabase Dashboard 的 SQL Editor 中執行

BEGIN;

-- 1. 確保 'marker-images' bucket 存在且設定為公開 (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('marker-images', 'marker-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 清理針對此 bucket 的舊策略，避免衝突
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Access to marker-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Select" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;

-- 3. 建立新的寬鬆策略 (允許匿名用戶進行所有操作)

-- 允許所有用戶檢視 (SELECT) 圖片
CREATE POLICY "Public Select"
ON storage.objects FOR SELECT
USING ( bucket_id = 'marker-images' );

-- 允許所有用戶上傳 (INSERT) 圖片
CREATE POLICY "Public Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'marker-images' );

-- 允許所有用戶更新 (UPDATE) 圖片
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'marker-images' );

-- 允許所有用戶刪除 (DELETE) 圖片
CREATE POLICY "Public Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'marker-images' );

COMMIT;

-- 4. 驗證設定 (可選)
SELECT * FROM storage.buckets WHERE name = 'marker-images';
