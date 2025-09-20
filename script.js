// 全域變數
let map;
let currentPosition = null;
let currentLocationMarker = null; // 當前位置標記
let watchId = null;
let isAddingMarker = false;
let isTracking = false;
let markers = [];
let groups = [];
let currentGroup = null;
let currentSubgroup = null;
let alertDistance = 100; // 預設提醒距離（公尺）
let alertInterval = 30; // 預設提醒間隔時間（秒）
let lastAlerts = new Set(); // 記錄已經提醒過的標註點
let lastAlertTimes = new Map(); // 記錄每個標註點的最後提醒時間
let alertTimers = new Map(); // 記錄每個標註點的定時器
let markersInRange = new Set(); // 記錄當前在範圍內的標註點
let trackingTarget = null; // 當前追蹤的目標標註點
let currentFilter = null; // 當前過濾設定 { type: 'marker'|'group'|'subgroup', id: string }

// 資料結構
class Group {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.subgroups = [];
        this.markers = [];
    }
    
    addSubgroup(subgroup) {
        this.subgroups.push(subgroup);
    }
    
    removeSubgroup(subgroupId) {
        this.subgroups = this.subgroups.filter(sg => sg.id !== subgroupId);
    }
    
    addMarker(marker) {
        this.markers.push(marker);
    }
    
    removeMarker(markerId) {
        this.markers = this.markers.filter(m => m.id !== markerId);
    }
}

class Subgroup {
    constructor(id, name, groupId) {
        this.id = id;
        this.name = name;
        this.groupId = groupId;
        this.markers = [];
    }
    
    addMarker(marker) {
        this.markers.push(marker);
    }
    
    removeMarker(markerId) {
        this.markers = this.markers.filter(m => m.id !== markerId);
    }
}

class Marker {
    constructor(id, name, description, lat, lng, groupId, subgroupId = null, color = 'red', icon = '📍') {
        this.id = id;
        this.name = name;
        this.description = description;
        this.lat = lat;
        this.lng = lng;
        this.groupId = groupId;
        this.subgroupId = subgroupId;
        this.color = color;
        this.icon = icon;
        this.leafletMarker = null;
    }
}

// 初始化應用程式
function initializeApp() {
    initMap();
    loadData();
    updateGroupsList();
    updateMarkersList();
    
    // 檢查是否是第一次使用
    const hasSeenSetup = localStorage.getItem('hasSeenSetup');
    if (!hasSeenSetup) {
        showInitialSetup();
    } else {
        requestLocationPermission();
        requestNotificationPermission();
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    initializeApp();
});

// 初始化地圖
function initMap() {
    // 預設位置（台北101）
    const defaultLat = 25.0330;
    const defaultLng = 121.5654;
    
    map = L.map('map').setView([defaultLat, defaultLng], 16);
    
    // 添加地圖圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 20,
        minZoom: 8
    }).addTo(map);
    
    // 地圖點擊事件
    map.on('click', function(e) {
        if (isAddingMarker) {
            showMarkerModal(e.latlng.lat, e.latlng.lng);
        }
    });
}

// 創建當前位置圖示
function createCurrentLocationIcon() {
    return L.divIcon({
        className: 'current-location-marker',
        html: `
            <div class="location-pulse">
                <div class="location-dot"></div>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

// 創建自定義標示點圖示
function createCustomMarkerIcon(color, icon) {
    const colorMap = {
        red: '#ef4444',
        blue: '#3b82f6',
        green: '#10b981',
        orange: '#f97316',
        purple: '#8b5cf6',
        yellow: '#eab308'
    };
    
    const bgColor = colorMap[color] || colorMap.red;
    
    return L.divIcon({
        html: `<div style="
            background-color: ${bgColor}; 
            width: 24px; 
            height: 24px; 
            border-radius: 50%; 
            border: 2px solid white; 
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        ">${icon}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: 'custom-marker-icon',
    });
}

// 初始化事件監聽器
function initEventListeners() {
    // 新增組別按鈕
    document.getElementById('addGroupBtn').addEventListener('click', addGroup);
    
    // 顯示所有標記按鈕
    document.getElementById('showAllMarkersBtn').addEventListener('click', function() {
        clearFilter();
        selectGroup(null); // 重置群組選擇
    });
    document.getElementById('groupNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addGroup();
    });
    
    // 控制按鈕
    document.getElementById('addMarkerBtn').addEventListener('click', toggleAddMarkerMode);
    document.getElementById('trackingBtn').addEventListener('click', toggleTracking);
    document.getElementById('centerMapBtn').addEventListener('click', centerMapToCurrentLocation);
    
    // 提醒設定
    document.getElementById('enableNotifications').addEventListener('change', function(e) {
        if (e.target.checked) {
            requestNotificationPermission();
        }
    });
    
    document.getElementById('alertDistance').addEventListener('change', function(e) {
        alertDistance = parseInt(e.target.value);
        saveData();
    });
    
    // 提醒間隔設定
    document.getElementById('alertInterval').addEventListener('change', function(e) {
        alertInterval = parseInt(e.target.value);
        saveData();
    });
    
    // 彈窗控制
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            
            // 如果是初始設定彈窗，關閉時也要標記為已看過
            if (modal.id === 'initialSetupModal') {
                localStorage.setItem('hasSeenSetup', 'true');
                requestLocationPermission();
                requestNotificationPermission();
            }
            
            modal.style.display = 'none';
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                // 如果是初始設定彈窗，關閉時也要標記為已看過
                if (this.id === 'initialSetupModal') {
                    localStorage.setItem('hasSeenSetup', 'true');
                    requestLocationPermission();
                    requestNotificationPermission();
                }
                
                this.style.display = 'none';
            }
        });
    });
    
    // 取消按鈕事件
    document.querySelectorAll('.cancel').forEach(cancelBtn => {
        cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                
                // 如果是標記模態視窗，重置添加標記模式
                if (modal.id === 'markerModal') {
                    isAddingMarker = false;
                    toggleAddMarkerMode();
                }
            }
        });
    });
    
    // 標註表單
    document.getElementById('markerForm').addEventListener('submit', saveMarker);
    document.getElementById('deleteMarkerBtn').addEventListener('click', deleteCurrentMarker);
    
    // 初始設定相關事件
    document.getElementById('startUsingBtn').addEventListener('click', handleInitialSetup);
    document.getElementById('skipSetupBtn').addEventListener('click', skipInitialSetup);
    document.getElementById('createFirstGroupBtn').addEventListener('click', showCreateGroupModal);
    
    // 建立組別表單
document.getElementById('createGroupForm').addEventListener('submit', handleCreateGroup);

// 測試通知按鈕
document.getElementById('testNotificationBtn').addEventListener('click', testNotification);

// 添加重置功能（用於測試）
window.resetSetup = function() {
    localStorage.removeItem('hasSeenSetup');
    location.reload();
};

// 切換設定區域顯示/隱藏
window.toggleSection = function(sectionName) {
    const section = document.querySelector(`.${sectionName}-section`);
    const content = section.querySelector('.section-content');
    const icon = section.querySelector('.toggle-icon');
    
    if (section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
        content.style.display = 'block';
        icon.textContent = '▲';
    } else {
        section.classList.add('collapsed');
        content.style.display = 'none';
        icon.textContent = '▼';
    }
};
}

// 請求位置權限
function requestLocationPermission() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                updateLocationDisplay();
                updateCurrentLocationMarker();
                map.setView([currentPosition.lat, currentPosition.lng], 18);
                
                // 顯示定位精度信息
                if (position.coords.accuracy) {
                    showNotification(`定位成功，精度: ${Math.round(position.coords.accuracy)}公尺`, 'success');
                }
            },
            function(error) {
                console.error('無法獲取位置:', error);
                let errorMessage = '無法獲取您的位置';
                let detailedMessage = '';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '位置權限被拒絕';
                        detailedMessage = '請點擊瀏覽器地址欄的鎖頭圖標，將位置權限設為"允許"，然後重新整理頁面';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '位置信息不可用';
                        detailedMessage = '請確認設備的位置服務已開啟，並檢查網路連線';
                        break;
                    case error.TIMEOUT:
                        errorMessage = '定位請求超時';
                        detailedMessage = '定位時間過長，請檢查網路連線或稍後再試';
                        break;
                    default:
                        detailedMessage = '請檢查瀏覽器權限設定和設備位置服務';
                }
                
                showNotification(errorMessage + '。' + detailedMessage, 'error');
                
                // 提供手動設定位置的選項
                setTimeout(() => {
                    if (confirm('無法自動獲取位置。是否要手動設定地圖中心位置？')) {
                        // 設定為台北市中心作為預設位置
                        const defaultLat = 25.0330;
                        const defaultLng = 121.5654;
                        map.setView([defaultLat, defaultLng], 16);
                        showNotification('已設定為台北市中心。您可以點擊地圖來添加標記。', 'info');
                    }
                }, 2000);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );
    } else {
        showNotification('您的瀏覽器不支援地理位置功能', 'error');
    }
}

// 請求通知權限
function requestNotificationPermission() {
    if ('Notification' in window) {
        // 檢查當前權限狀態
        if (Notification.permission === 'granted') {
            showNotification('通知權限已啟用');
            return Promise.resolve('granted');
        } else if (Notification.permission === 'denied') {
            showNotification('通知權限被拒絕，請在瀏覽器設定中手動啟用', 'warning');
            return Promise.resolve('denied');
        } else {
            // 請求權限
            return Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    showNotification('通知權限已啟用');
                    // 註冊Service Worker推送通知
                    registerPushNotification();
                } else {
                    showNotification('通知權限被拒絕，部分功能可能無法正常使用', 'warning');
                }
                return permission;
            });
        }
    } else {
        showNotification('您的瀏覽器不支援通知功能', 'error');
        return Promise.resolve('unsupported');
    }
}

// 註冊推送通知
function registerPushNotification() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(function(registration) {
            // 檢查是否已經訂閱
            return registration.pushManager.getSubscription();
        }).then(function(subscription) {
            if (!subscription) {
                // 如果沒有訂閱，創建新的訂閱
                console.log('Push notification ready for mobile devices');
            }
        }).catch(function(error) {
            console.log('Push notification setup failed:', error);
        });
    }
}

// 顯示初始設定彈窗
function showInitialSetup() {
    const modal = document.getElementById('initialSetupModal');
    const defaultGroupSelect = document.getElementById('defaultGroupSelect');
    
    // 填充現有組別到選擇器
    updateDefaultGroupSelect();
    
    modal.style.display = 'block';
}

// 更新預設組別選擇器
function updateDefaultGroupSelect() {
    const select = document.getElementById('defaultGroupSelect');
    select.innerHTML = '<option value="">不選擇預設組別</option>';
    
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        select.appendChild(option);
    });
}

// 處理初始設定完成
function handleInitialSetup() {
    const defaultGroupId = document.getElementById('defaultGroupSelect').value;
    const alertDistanceValue = document.getElementById('setupAlertDistance').value;
    const alertIntervalValue = document.getElementById('setupAlertInterval').value;
    const enableLocation = document.getElementById('setupEnableLocation').checked;
    const enableNotifications = document.getElementById('setupEnableNotifications').checked;
    
    // 保存設定
    alertDistance = parseInt(alertDistanceValue);
    alertInterval = parseInt(alertIntervalValue);
    
    // 更新UI中的設定值
    document.getElementById('alertDistance').value = alertDistance;
    document.getElementById('alertInterval').value = alertInterval;
    document.getElementById('enableNotifications').checked = enableNotifications;
    
    // 設定預設組別
    if (defaultGroupId) {
        currentGroup = groups.find(g => g.id === defaultGroupId);
        updateGroupsList();
    }
    
    // 標記已經看過設定
    localStorage.setItem('hasSeenSetup', 'true');
    
    // 關閉彈窗
    document.getElementById('initialSetupModal').style.display = 'none';
    
    // 請求權限
    const permissionPromises = [];
    
    if (enableLocation) {
        permissionPromises.push(requestLocationPermission());
    }
    
    if (enableNotifications) {
        permissionPromises.push(requestNotificationPermission());
    }
    
    // 等待所有權限請求完成
    Promise.all(permissionPromises).then(() => {
        if (enableNotifications && Notification.permission === 'granted') {
            showNotification('🎉 所有權限設定完成！您現在可以接收位置提醒了', 'success');
        } else if (enableLocation) {
            showNotification('✅ 位置權限已設定，您可以開始使用地圖功能', 'success');
        }
    }).catch((error) => {
        console.log('Permission setup error:', error);
        showNotification('⚠️ 部分權限設定失敗，您可以稍後在設定中重新啟用', 'warning');
    });
    
    saveData();
}

// 跳過初始設定
function skipInitialSetup() {
    localStorage.setItem('hasSeenSetup', 'true');
    document.getElementById('initialSetupModal').style.display = 'none';
    requestLocationPermission();
    requestNotificationPermission();
}

// 顯示建立組別彈窗
function showCreateGroupModal() {
    document.getElementById('createGroupModal').style.display = 'block';
}

// 處理建立新組別
function handleCreateGroup(event) {
    event.preventDefault();
    
    const name = document.getElementById('newGroupName').value.trim();
    const description = document.getElementById('newGroupDescription').value.trim();
    
    if (!name) return;
    
    const newGroup = new Group(name, description);
    groups.push(newGroup);
    
    // 更新預設組別選擇器
    updateDefaultGroupSelect();
    
    // 清空表單
    document.getElementById('newGroupName').value = '';
    document.getElementById('newGroupDescription').value = '';
    
    // 關閉彈窗
    document.getElementById('createGroupModal').style.display = 'none';
    
    saveData();
}

// 更新當前位置標記
function updateCurrentLocationMarker() {
    if (!currentPosition) return;
    
    // 移除舊的位置標記
    if (currentLocationMarker) {
        map.removeLayer(currentLocationMarker);
    }
    
    // 創建新的位置標記
    currentLocationMarker = L.marker([currentPosition.lat, currentPosition.lng], {
        icon: createCurrentLocationIcon(),
        zIndexOffset: 1000 // 確保當前位置標記在最上層
    }).addTo(map);
    
    // 添加彈出視窗
    currentLocationMarker.bindPopup(`
        <div class="current-location-popup">
            <strong>📍 您的當前位置</strong><br>
            緯度: ${currentPosition.lat.toFixed(6)}<br>
            經度: ${currentPosition.lng.toFixed(6)}<br>
            <small>點擊地圖其他位置可添加標註</small>
        </div>
    `);
}

// 組別管理功能
function addGroup() {
    const groupNameInput = document.getElementById('groupNameInput');
    const groupName = groupNameInput.value.trim();
    
    if (!groupName) {
        showNotification('請輸入組別名稱', 'warning');
        return;
    }
    
    const group = new Group(Date.now().toString(), groupName);
    groups.push(group);
    groupNameInput.value = '';
    
    updateGroupsList();
    saveData();
    showNotification(`組別 "${groupName}" 已建立`);
}

function deleteGroup(groupId) {
    if (confirm('確定要刪除此組別嗎？這將同時刪除所有相關的標註點。')) {
        // 刪除地圖上的標記
        const group = groups.find(g => g.id === groupId);
        if (group) {
            group.markers.forEach(marker => {
                if (marker.leafletMarker) {
                    map.removeLayer(marker.leafletMarker);
                }
            });
            
            // 刪除子群組的標記
            group.subgroups.forEach(subgroup => {
                subgroup.markers.forEach(marker => {
                    if (marker.leafletMarker) {
                        map.removeLayer(marker.leafletMarker);
                    }
                });
            });
        }
        
        groups = groups.filter(g => g.id !== groupId);
        markers = markers.filter(m => m.groupId !== groupId);
        
        updateGroupsList();
        updateMarkersList();
        saveData();
        showNotification('組別已刪除');
    }
}

function addSubgroup(groupId) {
    const subgroupName = prompt('請輸入群組名稱:');
    if (!subgroupName) return;
    
    const group = groups.find(g => g.id === groupId);
    if (group) {
        const subgroup = new Subgroup(Date.now().toString(), subgroupName, groupId);
        group.addSubgroup(subgroup);
        
        updateGroupsList();
        saveData();
        showNotification(`群組 "${subgroupName}" 已建立`);
    }
}

function deleteSubgroup(groupId, subgroupId) {
    if (confirm('確定要刪除此群組嗎？這將同時刪除所有相關的標註點。')) {
        const group = groups.find(g => g.id === groupId);
        if (group) {
            const subgroup = group.subgroups.find(sg => sg.id === subgroupId);
            if (subgroup) {
                // 刪除地圖上的標記
                subgroup.markers.forEach(marker => {
                    if (marker.leafletMarker) {
                        map.removeLayer(marker.leafletMarker);
                    }
                });
            }
            
            group.removeSubgroup(subgroupId);
            markers = markers.filter(m => m.subgroupId !== subgroupId);
        }
        
        updateGroupsList();
        updateMarkersList();
        saveData();
        showNotification('群組已刪除');
    }
}

function selectGroup(groupId, subgroupId = null) {
    // 找到對應的組別對象
    if (groupId === null) {
        currentGroup = null;
        currentSubgroup = null;
        clearFilter(); // 清除過濾條件，顯示所有標記
    } else {
        currentGroup = groups.find(g => g.id === groupId) || null;
        
        // 找到對應的子群組對象
        if (subgroupId && currentGroup) {
            currentSubgroup = currentGroup.subgroups.find(sg => sg.id === subgroupId) || null;
            setFilter('subgroup', subgroupId); // 設定子群組過濾
        } else {
            currentSubgroup = null;
            setFilter('group', groupId); // 設定群組過濾
        }
    }
    
    // 更新UI顯示
    document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (groupId === null) {
        // 顯示所有標註點時，激活第一個選項
        document.querySelector('.group-item')?.classList.add('active');
    } else if (subgroupId) {
        document.querySelector(`[data-subgroup-id="${subgroupId}"]`)?.classList.add('active');
    } else {
        document.querySelector(`[data-group-id="${groupId}"]`)?.classList.add('active');
    }
    
    updateMarkersList();
}

// 標註功能
function toggleAddMarkerMode() {
    isAddingMarker = !isAddingMarker;
    const btn = document.getElementById('addMarkerBtn');
    
    if (isAddingMarker) {
        btn.classList.add('active');
        btn.innerHTML = '<span>📍</span>點擊地圖標註';
        map.getContainer().style.cursor = 'crosshair';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<span>📍</span>標註模式';
        map.getContainer().style.cursor = '';
    }
}

function showMarkerModal(lat, lng, existingMarker = null) {
    const modal = document.getElementById('markerModal');
    const form = document.getElementById('markerForm');
    const groupSelect = document.getElementById('markerGroup');
    const subgroupSelect = document.getElementById('markerSubgroup');
    
    // 清空並填充組別選項
    groupSelect.innerHTML = '<option value="">選擇組別</option>';
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        groupSelect.appendChild(option);
    });
    
    // 組別變更時更新子群組選項
    groupSelect.addEventListener('change', function() {
        updateSubgroupOptions(this.value);
    });
    
    if (existingMarker) {
        // 編輯現有標記
        document.getElementById('markerName').value = existingMarker.name;
        document.getElementById('markerDescription').value = existingMarker.description;
        groupSelect.value = existingMarker.groupId;
        updateSubgroupOptions(existingMarker.groupId);
        subgroupSelect.value = existingMarker.subgroupId || '';
        
        // 設定顏色和圖案
        const colorRadio = document.querySelector(`input[name="markerColor"][value="${existingMarker.color || 'red'}"]`);
        if (colorRadio) colorRadio.checked = true;
        
        const iconRadio = document.querySelector(`input[name="markerIcon"][value="${existingMarker.icon || '📍'}"]`);
        if (iconRadio) iconRadio.checked = true;
        
        document.getElementById('deleteMarkerBtn').style.display = 'block';
        
        form.dataset.markerId = existingMarker.id;
    } else {
        // 新增標記
        form.reset();
        document.getElementById('deleteMarkerBtn').style.display = 'none';
        
        // 如果有選定的組別，自動設定為默認值
        if (currentGroup) {
            groupSelect.value = currentGroup.id;
            updateSubgroupOptions(currentGroup.id);
            
            // 如果有選定的子群組，也自動設定
            if (currentSubgroup) {
                subgroupSelect.value = currentSubgroup.id;
            }
        } else {
            updateSubgroupOptions('');
        }
        
        form.dataset.lat = lat;
        form.dataset.lng = lng;
        delete form.dataset.markerId;
    }
    
    modal.style.display = 'block';
}

function updateSubgroupOptions(groupId) {
    const subgroupSelect = document.getElementById('markerSubgroup');
    subgroupSelect.innerHTML = '<option value="">選擇群組（可選）</option>';
    
    if (groupId) {
        const group = groups.find(g => g.id === groupId);
        if (group) {
            group.subgroups.forEach(subgroup => {
                const option = document.createElement('option');
                option.value = subgroup.id;
                option.textContent = subgroup.name;
                subgroupSelect.appendChild(option);
            });
        }
    }
}

function saveMarker(e) {
    e.preventDefault();
    
    const form = e.target;
    const name = document.getElementById('markerName').value.trim();
    const description = document.getElementById('markerDescription').value.trim();
    const groupId = document.getElementById('markerGroup').value;
    const subgroupId = document.getElementById('markerSubgroup').value || null;
    const color = document.querySelector('input[name="markerColor"]:checked').value;
    const icon = document.querySelector('input[name="markerIcon"]:checked').value;
    
    if (!name) {
        showNotification('請填寫標記名稱', 'warning');
        return;
    }
    
    let group;
    if (!groupId) {
        // 如果沒有選擇組別，創建默認組別
        if (groups.length === 0) {
            const defaultGroup = new Group('default', '默認組別');
            groups.push(defaultGroup);
            updateGroupsList();
            showNotification('已自動創建默認組別', 'info');
        }
        group = groups[0];
        document.getElementById('markerGroup').value = group.id;
    } else {
        group = groups.find(g => g.id === groupId);
        if (!group) {
            showNotification('選擇的組別不存在', 'error');
            return;
        }
    }
    
    if (form.dataset.markerId) {
        // 編輯現有標記
        const markerId = form.dataset.markerId;
        const marker = markers.find(m => m.id === markerId);
        
        if (marker) {
            // 從舊的組別/群組中移除
            const oldGroup = groups.find(g => g.id === marker.groupId);
            if (oldGroup) {
                oldGroup.removeMarker(markerId);
                if (marker.subgroupId) {
                    const oldSubgroup = oldGroup.subgroups.find(sg => sg.id === marker.subgroupId);
                    if (oldSubgroup) {
                        oldSubgroup.removeMarker(markerId);
                    }
                }
            }
            
            // 更新標記資訊
            marker.name = name;
            marker.description = description;
            marker.groupId = groupId;
            marker.subgroupId = subgroupId;
            marker.color = color;
            marker.icon = icon;
            
            // 添加到新的組別/群組
            group.addMarker(marker);
            if (subgroupId) {
                const subgroup = group.subgroups.find(sg => sg.id === subgroupId);
                if (subgroup) {
                    subgroup.addMarker(marker);
                }
            }
            
            // 更新地圖標記
            if (marker.leafletMarker) {
                // 移除舊標記
                map.removeLayer(marker.leafletMarker);
                
                // 創建新標記
                marker.leafletMarker = L.marker([marker.lat, marker.lng], {
                    icon: createCustomMarkerIcon(marker.color, marker.icon)
                }).addTo(map);
                
                marker.leafletMarker.bindPopup(`
                    <strong>${marker.name}</strong><br>
                    ${marker.description}<br>
                    <button onclick="editMarker('${marker.id}')">編輯</button>
                `);
                
                marker.leafletMarker.on('click', function() {
                    selectGroup(marker.groupId, marker.subgroupId);
                });
            }
        }
    } else {
        // 新增標記
        const lat = parseFloat(form.dataset.lat);
        const lng = parseFloat(form.dataset.lng);
        
        const marker = new Marker(
            Date.now().toString(),
            name,
            description,
            lat,
            lng,
            group.id,
            subgroupId,
            color,
            icon
        );
        
        markers.push(marker);
        group.addMarker(marker);
        
        if (subgroupId) {
            const subgroup = group.subgroups.find(sg => sg.id === subgroupId);
            if (subgroup) {
                subgroup.addMarker(marker);
            }
        }
        
        // 在地圖上添加標記
        addMarkerToMap(marker);
    }
    
    updateMarkersList();
    updateGroupsList();
    saveData();
    
    document.getElementById('markerModal').style.display = 'none';
    
    // 關閉標註模式
    isAddingMarker = false;
    const btn = document.getElementById('addMarkerBtn');
    btn.classList.remove('active');
    btn.innerHTML = '<span>📍</span>標註模式';
    map.getContainer().style.cursor = '';
    
    // 顯示提示並自動關閉
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = '標記已保存';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000); // 2秒後自動關閉
}

function addMarkerToMap(marker) {
    // 如果已經有 leaflet 標記，先移除
    if (marker.leafletMarker) {
        map.removeLayer(marker.leafletMarker);
        marker.leafletMarker = null;
    }
    
    // 創建自定義圖標
    const customIcon = createCustomMarkerIcon(marker.color || 'red', marker.icon || '📍');
    const leafletMarker = L.marker([marker.lat, marker.lng], { icon: customIcon }).addTo(map);
    
    leafletMarker.bindPopup(`
        <strong>${marker.name}</strong><br>
        ${marker.description}<br>
        <button onclick="editMarker('${marker.id}')">編輯</button>
        <button onclick="setTrackingTarget('${marker.id}')" style="margin-left: 5px;">設為追蹤目標</button>
        <button onclick="showOnlyThisMarker('${marker.id}')" style="margin-left: 5px;">只顯示此標記</button>
    `);
    
    // 添加標記點擊事件
    leafletMarker.on('click', function() {
        setFilter('marker', marker.id);
    });
    
    marker.leafletMarker = leafletMarker;
}

function editMarker(markerId) {
    const marker = markers.find(m => m.id === markerId);
    if (marker) {
        showMarkerModal(marker.lat, marker.lng, marker);
    }
}

function setTrackingTarget(markerId) {
    const marker = markers.find(m => m.id === markerId);
    if (marker) {
        // 清除之前的追蹤目標提醒
        if (trackingTarget) {
            stopRepeatedAlert(trackingTarget.id);
        }
        
        trackingTarget = marker;
        showNotification(`已設定 "${marker.name}" 為追蹤目標`);
        
        // 如果正在追蹤位置，立即檢查新目標的距離
        if (isTracking && currentPosition) {
            checkProximityAlerts();
        }
    }
}

function deleteCurrentMarker() {
    const form = document.getElementById('markerForm');
    const markerId = form.dataset.markerId;
    
    if (markerId) {
        const marker = markers.find(m => m.id === markerId);
        
        if (marker) {
            // 從地圖移除並清理引用
            if (marker.leafletMarker) {
                map.removeLayer(marker.leafletMarker);
                marker.leafletMarker = null; // 清理引用
            }
            
            // 從組別/群組移除
            const group = groups.find(g => g.id === marker.groupId);
            if (group) {
                group.removeMarker(markerId);
                if (marker.subgroupId) {
                    const subgroup = group.subgroups.find(sg => sg.id === marker.subgroupId);
                    if (subgroup) {
                        subgroup.removeMarker(markerId);
                    }
                }
            }
            
            // 從全域陣列移除
            markers = markers.filter(m => m.id !== markerId);
        }
        
        updateMarkersList();
        updateGroupsList();
        updateMapMarkers(); // 這會重新渲染地圖上的標記
        saveData();
        
        document.getElementById('markerModal').style.display = 'none';
        
        // 顯示提示並自動關閉
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = '標記已刪除';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000); // 2秒後自動關閉
    }
}

// 位置追蹤功能
function toggleTracking() {
    const btn = document.getElementById('trackingBtn');
    
    if (isTracking) {
        stopTracking();
        btn.classList.remove('active');
        btn.innerHTML = '<span>📍</span>開始追蹤';
    } else {
        startTracking();
        btn.classList.add('active');
        btn.innerHTML = '<span>⏹️</span>停止追蹤';
    }
    
    isTracking = !isTracking;
}

function startTracking() {
    if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
            function(position) {
                currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                
                updateLocationDisplay();
                updateCurrentLocationMarker();
                checkProximityAlerts();
                
                // 如果精度較差，顯示警告
                if (position.coords.accuracy > 50) {
                    console.warn(`定位精度較差: ${Math.round(position.coords.accuracy)}公尺`);
                }
            },
            function(error) {
                console.error('位置追蹤錯誤:', error);
                let errorMessage = '位置追蹤失敗';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '位置權限被拒絕';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '位置信息不可用';
                        break;
                    case error.TIMEOUT:
                        errorMessage = '定位超時，請檢查GPS信號';
                        break;
                }
                showNotification(errorMessage, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 10000
            }
        );
        
        showNotification('位置追蹤已啟動');
    } else {
        showNotification('您的瀏覽器不支援位置追蹤', 'error');
    }
}

function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        
        // 清除所有提醒定時器
        alertTimers.forEach((timer, markerId) => {
            clearInterval(timer);
        });
        alertTimers.clear();
        markersInRange.clear();
        lastAlerts.clear();
        lastAlertTimes.clear();
        
        // 清除追蹤目標
        trackingTarget = null;
        
        showNotification('位置追蹤已停止，所有提醒已取消');
    }
}

function centerMapToCurrentLocation() {
    if (currentPosition) {
        map.setView([currentPosition.lat, currentPosition.lng], 18);
        updateCurrentLocationMarker();
        // 顯示當前位置標記的彈出視窗
        if (currentLocationMarker) {
            currentLocationMarker.openPopup();
        }
    } else {
        requestLocationPermission();
    }
}

// 距離計算
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // 地球半徑（公尺）
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // 距離（公尺）
}

// 接近提醒檢查
function checkProximityAlerts() {
    if (!currentPosition || !document.getElementById('enableNotifications').checked || !trackingTarget) {
        return;
    }
    
    // 只檢查追蹤目標
    const distance = calculateDistance(
        currentPosition.lat,
        currentPosition.lng,
        trackingTarget.lat,
        trackingTarget.lng
    );
    
    if (distance <= alertDistance) {
        // 如果追蹤目標進入範圍
        if (!markersInRange.has(trackingTarget.id)) {
            markersInRange.add(trackingTarget.id);
            
            // 立即顯示第一次通知
            showLocationAlert(trackingTarget, distance);
            lastAlertTimes.set(trackingTarget.id, Date.now());
            
            // 設定定時器進行重複通知
            startRepeatedAlert(trackingTarget.id, trackingTarget);
        }
    } else {
        // 如果追蹤目標離開範圍
        if (markersInRange.has(trackingTarget.id)) {
            markersInRange.delete(trackingTarget.id);
            stopRepeatedAlert(trackingTarget.id);
        }
    }
}

// 開始重複通知
function startRepeatedAlert(markerId, marker) {
    // 清除可能存在的舊定時器
    stopRepeatedAlert(markerId);
    
    // 設定新的定時器
    const timer = setInterval(() => {
        if (!currentPosition || !document.getElementById('enableNotifications').checked) {
            stopRepeatedAlert(markerId);
            return;
        }
        
        // 重新計算距離，確保仍在範圍內
        const distance = calculateDistance(
            currentPosition.lat, currentPosition.lng,
            marker.lat, marker.lng
        );
        
        if (distance <= alertDistance) {
            showLocationAlert(marker, distance);
            lastAlertTimes.set(markerId, Date.now());
        } else {
            // 如果已經離開範圍，停止定時器
            stopRepeatedAlert(markerId);
        }
    }, alertInterval * 1000);
    
    alertTimers.set(markerId, timer);
}

// 停止重複通知
function stopRepeatedAlert(markerId) {
    const timer = alertTimers.get(markerId);
    if (timer) {
        clearInterval(timer);
        alertTimers.delete(markerId);
    }
    markersInRange.delete(markerId);
    lastAlerts.delete(markerId);
    lastAlertTimes.delete(markerId);
}

function showLocationAlert(marker, distance) {
    const message = `您已接近標記點 "${marker.name}"，距離約 ${Math.round(distance)} 公尺`;
    
    // 嘗試多種通知方式以確保手機瀏覽器能收到通知
    
    // 1. Service Worker 通知 (最適合手機)
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(function(registration) {
            registration.showNotification('位置提醒', {
                body: message,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
                badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red"><circle cx="12" cy="12" r="10"/></svg>',
                vibrate: [200, 100, 200, 100, 200],
                tag: 'location-alert-' + marker.id,
                requireInteraction: true,
                silent: false,
                actions: [
                    {
                        action: 'view',
                        title: '查看位置'
                    }
                ]
            });
        }).catch(function(error) {
            console.log('Service Worker notification failed:', error);
            // 降級到普通通知
            fallbackNotification();
        });
    } else {
        fallbackNotification();
    }
    
    function fallbackNotification() {
        // 2. 普通瀏覽器通知
        if (Notification.permission === 'granted') {
            try {
                const notification = new Notification('位置提醒', {
                    body: message,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
                    vibrate: [200, 100, 200],
                    tag: 'location-alert',
                    requireInteraction: true
                });
                
                // 點擊通知時的處理
                notification.onclick = function() {
                    window.focus();
                    if (marker.leafletMarker) {
                        marker.leafletMarker.openPopup();
                        map.setView([marker.lat, marker.lng], 18);
                    }
                    notification.close();
                };
            } catch (error) {
                console.log('Standard notification failed:', error);
            }
        }
    }
    
    // 3. 手機震動 (如果支援)
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
    }
    
    // 4. 顯示彈窗提醒 (確保一定有視覺提醒)
    document.getElementById('notificationMessage').textContent = message;
    document.getElementById('notificationModal').style.display = 'block';
    
    // 5秒後自動關閉通知彈窗 (手機上給更多時間)
    setTimeout(() => {
        document.getElementById('notificationModal').style.display = 'none';
    }, 5000);
    
    // 5. 在地圖上高亮標記
    if (marker.leafletMarker) {
        marker.leafletMarker.openPopup();
        // 將地圖中心移到標記位置
        map.setView([marker.lat, marker.lng], Math.max(map.getZoom(), 18));
    }
    
    // 6. 音效提醒 (如果可能)
    try {
        // 創建簡單的音效
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        // 音效失敗不影響其他功能
        console.log('Audio notification failed:', error);
    }
}

// UI更新函數
function updateLocationDisplay() {
    const locationDiv = document.getElementById('currentLocation');
    if (currentPosition) {
        let accuracyText = '';
        let timeText = '';
        
        if (currentPosition.accuracy) {
            const accuracy = Math.round(currentPosition.accuracy);
            let accuracyColor = '#00ffff';
            if (accuracy > 100) accuracyColor = '#ff6b6b';
            else if (accuracy > 50) accuracyColor = '#ffa500';
            
            accuracyText = `<br><span style="color: ${accuracyColor}">精度: ±${accuracy}公尺</span>`;
        }
        
        if (currentPosition.timestamp) {
            const updateTime = new Date(currentPosition.timestamp);
            timeText = `<br><span style="color: #888; font-size: 12px;">更新: ${updateTime.toLocaleTimeString()}</span>`;
        }
        
        locationDiv.innerHTML = `
            緯度: ${currentPosition.lat.toFixed(6)}<br>
            經度: ${currentPosition.lng.toFixed(6)}${accuracyText}${timeText}
        `;
    } else {
        locationDiv.textContent = '位置未知';
    }
}

function updateGroupsList() {
    const groupsList = document.getElementById('groupsList');
    groupsList.innerHTML = '';
    
    // 添加"顯示所有標註點"選項
    const allMarkersDiv = document.createElement('div');
    allMarkersDiv.className = 'group-item';
    if (!currentGroup) {
        allMarkersDiv.classList.add('active');
    }
    
    allMarkersDiv.innerHTML = `
        <div class="group-name" onclick="selectGroup(null)">📍 顯示所有標註點</div>
    `;
    
    groupsList.appendChild(allMarkersDiv);
    
    groups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group-item';
        groupDiv.dataset.groupId = group.id;
        
        groupDiv.innerHTML = `
            <div class="group-name" onclick="selectGroup('${group.id}')">${group.name}</div>
            <div class="group-actions">
                <button onclick="addSubgroup('${group.id}')">新增群組</button>
                <button onclick="deleteGroup('${group.id}')">刪除</button>
            </div>
        `;
        
        // 添加子群組
        group.subgroups.forEach(subgroup => {
            const subgroupDiv = document.createElement('div');
            subgroupDiv.className = 'subgroup-item';
            subgroupDiv.dataset.subgroupId = subgroup.id;
            
            subgroupDiv.innerHTML = `
                <div class="subgroup-name" onclick="selectGroup('${group.id}', '${subgroup.id}')">${subgroup.name}</div>
                <div class="subgroup-actions">
                    <button onclick="deleteSubgroup('${group.id}', '${subgroup.id}')">刪除</button>
                </div>
            `;
            
            groupDiv.appendChild(subgroupDiv);
        });
        
        groupsList.appendChild(groupDiv);
    });
}

function updateMarkersList() {
    const markersList = document.getElementById('markersList');
    markersList.innerHTML = '';
    
    let displayMarkers = [];
    
    if (currentGroup && currentSubgroup) {
        // 顯示選中子群組的標記
        displayMarkers = markers.filter(m => m.groupId === currentGroup.id && m.subgroupId === currentSubgroup.id);
    } else if (currentGroup) {
        // 顯示選中群組的所有標記（包括子群組的標記）
        displayMarkers = markers.filter(m => m.groupId === currentGroup.id);
    } else {
        // 顯示所有標記
        displayMarkers = markers;
    }
    
    displayMarkers.forEach(marker => {
        const markerDiv = document.createElement('div');
        markerDiv.className = 'marker-item';
        
        markerDiv.innerHTML = `
            <div class="marker-name" onclick="focusMarker('${marker.id}')">${marker.name}</div>
            <div class="marker-description">${marker.description}</div>
        `;
        
        markersList.appendChild(markerDiv);
    });
}

function updateMapMarkers() {
    // 清除所有標記
    markers.forEach(marker => {
        if (marker.leafletMarker) {
            map.removeLayer(marker.leafletMarker);
            marker.leafletMarker = null; // 清理引用
        }
    });
    
    // 根據過濾條件重新添加標記
    const filteredMarkers = getFilteredMarkers();
    filteredMarkers.forEach(marker => {
        addMarkerToMap(marker);
    });
}

// 根據當前過濾條件獲取要顯示的標記
function getFilteredMarkers() {
    if (!currentFilter) {
        // 沒有過濾條件時，使用原有的邏輯
        if (currentGroup && currentSubgroup) {
            // 顯示選中子群組的標記
            return markers.filter(m => m.groupId === currentGroup.id && m.subgroupId === currentSubgroup.id);
        } else if (currentGroup) {
            // 顯示選中群組的所有標記（包括子群組的標記）
            return markers.filter(m => m.groupId === currentGroup.id);
        } else {
            // 顯示所有標記
            return markers;
        }
    }
    
    switch (currentFilter.type) {
        case 'marker':
            return markers.filter(marker => marker.id === currentFilter.id);
        case 'group':
            return markers.filter(marker => marker.groupId === currentFilter.id);
        case 'subgroup':
            return markers.filter(marker => marker.subgroupId === currentFilter.id);
        default:
            return markers;
    }
}

// 設定過濾條件
function setFilter(type, id) {
    currentFilter = { type, id };
    updateMapMarkers();
    updateMarkersList(); // 更新標記列表以反映過濾狀態
}

// 清除過濾條件
function clearFilter() {
    currentFilter = null;
    updateMapMarkers();
    updateMarkersList();
}

// 只顯示指定標記
function showOnlyThisMarker(markerId) {
    setFilter('marker', markerId);
}

function focusMarker(markerId) {
    const marker = markers.find(m => m.id === markerId);
    if (marker && marker.leafletMarker) {
        map.setView([marker.lat, marker.lng], 18);
        marker.leafletMarker.openPopup();
    }
}

// 通知系統
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function testNotification() {
    // 創建測試標記
    const testMarker = {
        id: 'test-marker',
        name: '測試標記',
        description: '這是一個測試通知的標記',
        lat: currentPosition ? currentPosition.lat : 25.0330,
        lng: currentPosition ? currentPosition.lng : 121.5654
    };
    
    // 測試距離提醒
    showLocationAlert(testMarker, 50);
    
    // 顯示測試訊息
    showNotification('🔔 測試通知已發送！請檢查您的瀏覽器通知', 'info');
}

// 資料持久化
function saveData() {
    // 創建不包含 leafletMarker 的標記副本
    const markersToSave = markers.map(marker => ({
        id: marker.id,
        name: marker.name,
        description: marker.description,
        lat: marker.lat,
        lng: marker.lng,
        groupId: marker.groupId,
        subgroupId: marker.subgroupId
        // 不包含 leafletMarker 屬性
    }));
    
    // 創建不包含 markers 屬性的群組副本
    const groupsToSave = groups.map(group => ({
        id: group.id,
        name: group.name,
        subgroups: group.subgroups.map(subgroup => ({
            id: subgroup.id,
            name: subgroup.name,
            groupId: subgroup.groupId
            // 不包含 markers 屬性
        }))
        // 不包含 markers 屬性
    }));
    
    const data = {
        groups: groupsToSave,
        markers: markersToSave,
        alertDistance: alertDistance,
        alertInterval: alertInterval,
        currentGroup: currentGroup ? { id: currentGroup.id, name: currentGroup.name } : null,
        currentSubgroup: currentSubgroup ? { id: currentSubgroup.id, name: currentSubgroup.name, groupId: currentSubgroup.groupId } : null
    };
    
    localStorage.setItem('mapAnnotationData', JSON.stringify(data));
}

function loadData() {
    const savedData = localStorage.getItem('mapAnnotationData');
    
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            
            // 重建組別
            groups = data.groups.map(groupData => {
                const group = new Group(groupData.id, groupData.name);
                group.subgroups = groupData.subgroups.map(subgroupData => 
                    new Subgroup(subgroupData.id, subgroupData.name, subgroupData.groupId)
                );
                return group;
            });
            
            // 重建標記
            markers = data.markers.map(markerData => 
                new Marker(
                    markerData.id,
                    markerData.name,
                    markerData.description,
                    markerData.lat,
                    markerData.lng,
                    markerData.groupId,
                    markerData.subgroupId
                )
            );
            
            // 重建關聯關係
            markers.forEach(marker => {
                const group = groups.find(g => g.id === marker.groupId);
                if (group) {
                    group.addMarker(marker);
                    if (marker.subgroupId) {
                        const subgroup = group.subgroups.find(sg => sg.id === marker.subgroupId);
                        if (subgroup) {
                            subgroup.addMarker(marker);
                        }
                    }
                }
            });
            
            // 恢復設定
            alertDistance = data.alertDistance || 100;
            alertInterval = data.alertInterval || 30;
            currentGroup = data.currentGroup;
            currentSubgroup = data.currentSubgroup;
            
            document.getElementById('alertDistance').value = alertDistance;
            document.getElementById('alertInterval').value = alertInterval;
            
            // 更新UI
            updateGroupsList();
            updateMarkersList();
            
            // 在地圖上顯示標記
            markers.forEach(marker => {
                addMarkerToMap(marker);
            });
            
        } catch (error) {
            console.error('載入資料失敗:', error);
            showNotification('載入儲存的資料失敗', 'error');
        }
    }
}

// 全域函數（供HTML調用）
window.editMarker = editMarker;
window.selectGroup = selectGroup;
window.addSubgroup = addSubgroup;
window.deleteGroup = deleteGroup;
window.deleteSubgroup = deleteSubgroup;
window.focusMarker = focusMarker;
window.setTrackingTarget = setTrackingTarget;
window.showOnlyThisMarker = showOnlyThisMarker;