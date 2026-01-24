// Supabase 客戶端服務
class SupabaseService {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.datasetGroup = null; // Default null until login
    }

    setDatasetGroup(group) {
        this.datasetGroup = group;
        console.log('Dataset group set to:', group);
    }

    init() {
        if (typeof supabase === 'undefined') {
            console.error('Supabase SDK not loaded');
            return;
        }

        if (SUPABASE_CONFIG.URL === 'YOUR_SUPABASE_URL' || SUPABASE_CONFIG.ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
            console.warn('Supabase credentials not configured');
            return;
        }

        this.client = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
        this.isInitialized = true;
        console.log('Supabase client initialized');
    }

    // 將 Base64 轉換為 File 物件
    base64ToFile(base64, filename) {
        try {
            const arr = base64.split(',');
            if (arr.length < 2) throw new Error('Invalid base64 format');
            
            const mimeMatch = arr[0].match(/:(.*?);/);
            if (!mimeMatch) throw new Error('Invalid mime type in base64');
            
            const mime = mimeMatch[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], filename, { type: mime });
        } catch (error) {
            console.error('base64ToFile conversion failed:', error);
            return null;
        }
    }

    // 上傳圖片
    async uploadImage(base64Image, markerId, index) {
        if (!this.isInitialized) return null;

        try {
            const timestamp = Date.now();
            const filename = `${markerId}_${index}_${timestamp}.jpg`;
            const file = this.base64ToFile(base64Image, filename);
            
            if (!file) {
                console.error('Failed to convert base64 to file');
                return null;
            }

            console.log(`Uploading image ${filename} (${file.size} bytes) to ${SUPABASE_CONFIG.BUCKET_NAME}...`);

            const { data, error } = await this.client.storage
                .from(SUPABASE_CONFIG.BUCKET_NAME)
                .upload(filename, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Supabase storage upload error details:', error);
                throw error;
            }

            // 獲取公開連結
            const { data: { publicUrl } } = this.client.storage
                .from(SUPABASE_CONFIG.BUCKET_NAME)
                .getPublicUrl(filename);

            console.log('Image uploaded successfully, public URL:', publicUrl);
            return publicUrl;
        } catch (error) {
            console.error('Image upload failed:', error);
            // 嘗試顯示更多錯誤細節
            if (error.message) console.error('Error message:', error.message);
            if (error.statusCode) console.error('Status code:', error.statusCode);
            return null;
        }
    }

    // 上傳標註點數據
    async uploadMarker(marker) {
        if (!this.isInitialized) return null;

        console.log(`[Supabase] Starting upload for marker ${marker.id}`);

        try {
            // 處理圖片：如果是 Base64，先上傳到 Storage
            let imageUrls = [];
            if (marker.imageData) {
                const images = Array.isArray(marker.imageData) ? marker.imageData : [marker.imageData];
                console.log(`[Supabase] Processing ${images.length} images for marker ${marker.id}`);
                
                for (let i = 0; i < images.length; i++) {
                    const img = images[i];
                    const isBase64 = typeof img === 'string' && img.startsWith('data:image/');
                    console.log(`[Supabase] Image ${i}: type=${typeof img}, isBase64=${isBase64}, length=${img ? img.length : 0}`);

                    if (isBase64) {
                        console.log(`[Supabase] Uploading base64 image ${i}...`);
                        const url = await this.uploadImage(img, marker.id, i);
                        if (url) {
                            console.log(`[Supabase] Image ${i} uploaded successfully: ${url}`);
                            imageUrls.push(url);
                        } else {
                            console.error(`[Supabase] Failed to upload image ${i}`);
                        }
                    } else {
                        // 如果已經是 URL，直接保留
                        console.log(`[Supabase] Image ${i} is already a URL, keeping it.`);
                        imageUrls.push(img);
                    }
                }
            }

            // 準備要上傳的資料
            const markerData = {
                id: marker.id,
                name: marker.name,
                description: marker.description,
                lat: marker.lat,
                lng: marker.lng,
                group_id: marker.groupId,
                subgroup_id: marker.subgroupId,
                color: marker.color,
                icon: marker.icon,
                image_data: imageUrls, // 儲存 URL 陣列
                route_records: marker.routeRecords,
                dataset_group: this.datasetGroup,
                updated_at: new Date().toISOString()
            };

            console.log('[Supabase] Upserting marker data:', markerData);

            const { data, error } = await this.client
                .from(SUPABASE_CONFIG.TABLE_NAME)
                .upsert(markerData, { onConflict: 'id' })
                .select();

            if (error) {
                console.error('[Supabase] Marker upsert error:', error);
                throw error;
            }

            console.log('[Supabase] Marker uploaded successfully:', data);
            return data;
        } catch (error) {
            console.error('[Supabase] Marker upload failed:', error);
            throw error;
        }
    }

    // --- Group Methods ---

    async uploadGroup(group) {
        if (!this.isInitialized) return null;
        
        console.log(`[Supabase] Uploading group: ${group.name} (${group.id})`);
        
        const groupData = {
            id: group.id,
            name: group.name,
            description: group.description || '',
            dataset_group: this.datasetGroup
        };

        try {
            const { data, error } = await this.client
                .from('groups')
                .upsert(groupData, { onConflict: 'id' })
                .select();

            if (error) throw error;
            console.log('[Supabase] Group uploaded successfully');
            return data;
        } catch (error) {
            console.error('[Supabase] Error uploading group:', error);
            // Don't throw to avoid blocking UI, just log
            return null;
        }
    }

    async deleteGroup(groupId) {
        if (!this.isInitialized) return null;
        
        try {
            const { error } = await this.client
                .from('groups')
                .delete()
                .eq('id', groupId);

            if (error) throw error;
            console.log('[Supabase] Group deleted:', groupId);
            return true;
        } catch (error) {
            console.error('[Supabase] Error deleting group:', error);
            return false;
        }
    }

    async fetchGroups() {
        if (!this.isInitialized) return [];
        
        try {
            let query = this.client.from('groups').select('*');
            if (this.datasetGroup) {
                query = query.eq('dataset_group', this.datasetGroup);
            }
            const { data, error } = await query;

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('[Supabase] Error fetching groups:', error);
            return [];
        }
    }

    // --- Subgroup Methods ---

    async uploadSubgroup(subgroup) {
        if (!this.isInitialized) return null;

        console.log(`[Supabase] Uploading subgroup: ${subgroup.name} (${subgroup.id})`);

        const subgroupData = {
            id: subgroup.id,
            name: subgroup.name,
            group_id: subgroup.groupId,
            dataset_group: this.datasetGroup
        };

        try {
            const { data, error } = await this.client
                .from('subgroups')
                .upsert(subgroupData, { onConflict: 'id' })
                .select();

            if (error) throw error;
            console.log('[Supabase] Subgroup uploaded successfully');
            return data;
        } catch (error) {
            console.error('[Supabase] Error uploading subgroup:', error);
            return null;
        }
    }

    async deleteSubgroup(subgroupId) {
        if (!this.isInitialized) return null;
        
        try {
            const { error } = await this.client
                .from('subgroups')
                .delete()
                .eq('id', subgroupId);

            if (error) throw error;
            console.log('[Supabase] Subgroup deleted:', subgroupId);
            return true;
        } catch (error) {
            console.error('[Supabase] Error deleting subgroup:', error);
            return false;
        }
    }

    async fetchSubgroups() {
        if (!this.isInitialized) return [];
        
        try {
            let query = this.client.from('subgroups').select('*');
            if (this.datasetGroup) {
                query = query.eq('dataset_group', this.datasetGroup);
            }
            const { data, error } = await query;

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('[Supabase] Error fetching subgroups:', error);
            return [];
        }
    }

    // 從 Supabase 獲取所有標註點
    async fetchMarkers() {
        if (!this.isInitialized) return null;

        try {
            let query = this.client.from(SUPABASE_CONFIG.TABLE_NAME).select('*');
            if (this.datasetGroup) {
                query = query.eq('dataset_group', this.datasetGroup);
            }
            const { data, error } = await query;

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching markers:', error);
            return null;
        }
    }

    // 批量上傳所有標註點
    async syncAllMarkers(markers) {
        if (!this.isInitialized) return;
        
        console.log(`Starting sync for ${markers.length} markers...`);
        let successCount = 0;
        let failCount = 0;

        for (const marker of markers) {
            try {
                await this.uploadMarker(marker);
                successCount++;
            } catch (error) {
                failCount++;
            }
        }

        return { success: successCount, failed: failCount };
    }

    // 批量上傳所有組別和子群組
    async syncAllGroups(groups) {
        if (!this.isInitialized) return { success: 0, failed: 0 };
        
        console.log(`Starting sync for ${groups.length} groups...`);
        let successCount = 0;
        let failCount = 0;

        for (const group of groups) {
            try {
                // 上傳組別
                await this.uploadGroup(group);
                
                // 上傳該組別下的所有子群組
                if (group.subgroups && group.subgroups.length > 0) {
                    for (const subgroup of group.subgroups) {
                        // 確保 groupId 正確
                        if (!subgroup.groupId) subgroup.groupId = group.id;
                        await this.uploadSubgroup(subgroup);
                    }
                }
                successCount++;
            } catch (error) {
                console.error(`Failed to sync group ${group.name}:`, error);
                failCount++;
            }
        }

        return { success: successCount, failed: failCount };
    }

    // 刪除標註點
    async deleteMarker(markerId) {
        if (!this.isInitialized) return null;

        try {
            // 注意：我們暫時不刪除關聯的圖片，因為圖片可能被其他邏輯引用，
            // 或者如果需要刪除圖片，需要先獲取圖片路徑。
            // 為了簡化，這裡只刪除資料庫記錄。

            const { error } = await this.client
                .from(SUPABASE_CONFIG.TABLE_NAME)
                .delete()
                .eq('id', markerId);

            if (error) throw error;

            console.log('Marker deleted successfully:', markerId);
            return true;
        } catch (error) {
            console.error('Marker deletion failed:', error);
            throw error;
        }
    }

    // --- Realtime Tracking Methods ---

    // 上傳即時位置 (強制寫入 tracking 群組)
    async uploadRealtimeLocation(groupId, lat, lng) {
        if (!this.isInitialized) return null;

        // 定義不同組別的樣式
        const groupStyles = {
            '1': { color: 'red', icon: '1' },
            '2': { color: 'blue', icon: '2' },
            '3': { color: 'green', icon: '3' },
            'default': { color: 'orange', icon: '?' }
        };

        const style = groupStyles[groupId] || groupStyles['default'];

        const markerId = `realtime_${groupId}`;
        const markerData = {
            id: markerId,
            name: `即時定位 - 組別 ${groupId}`,
            description: `最後更新: ${new Date().toLocaleTimeString()}`,
            lat: lat,
            lng: lng,
            group_id: groupId,
            subgroup_id: 'tracking',
            color: style.color, 
            icon: style.icon,
            dataset_group: 'realtime_tracking', // 強制使用 tracking 群組
            updated_at: new Date().toISOString()
        };

        try {
            const { data, error } = await this.client
                .from(SUPABASE_CONFIG.TABLE_NAME)
                .upsert(markerData, { onConflict: 'id' })
                .select();

            if (error) throw error;
            console.log(`[Supabase] Realtime location uploaded for group ${groupId}`);
            return data;
        } catch (error) {
            console.error('[Supabase] Realtime location upload failed:', error);
            return null;
        }
    }

    // 獲取即時位置 (僅 Admin 使用)
    async fetchRealtimeLocations() {
        if (!this.isInitialized) return [];

        try {
            const { data, error } = await this.client
                .from(SUPABASE_CONFIG.TABLE_NAME)
                .select('*')
                .eq('dataset_group', 'realtime_tracking');

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('[Supabase] Error fetching realtime locations:', error);
            return [];
        }
    }
}

const supabaseService = new SupabaseService();
