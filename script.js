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

// 即時定位設定
let enableHighAccuracy = true; // 高精度模式
let autoStartTracking = false; // 自動開始追蹤
let keepMapCentered = false; // 保持地圖中央
let locationUpdateFrequency = 3000; // 定位更新頻率（毫秒）
let locationTimeout = 20000; // 定位超時時間（毫秒）
let lastLocationUpdate = null; // 最後一次定位更新時間
let locationUpdateTimer = null; // 定位更新定時器

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
    constructor(id, name, description, lat, lng, groupId, subgroupId = null, color = 'red', icon = '📍', imageData = null) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.lat = lat;
        this.lng = lng;
        this.groupId = groupId;
        this.subgroupId = subgroupId;
        this.color = color;
        this.icon = icon;
        this.imageData = imageData; // base64編碼的圖片數據
        this.leafletMarker = null;
    }
}

// 初始化控制按鈕


// 初始化應用程式
function initializeApp() {
    console.log('=== 應用程式初始化開始 - 版本 2024.01.20 ===');
    initMap();
    loadData();
    updateGroupsList();
    updateMarkersList();
    
    // 初始化Service Worker消息監聽
    initServiceWorkerMessaging();
    
    // 初始化設定按鈕
    initSettingsButtons();
    
    // 檢查是否是第一次使用
    const hasSeenSetup = localStorage.getItem('hasSeenSetup');
    if (!hasSeenSetup) {
        showInitialSetup();
    } else {
        requestNotificationPermission();
        
        // 如果啟用自動開始追蹤，延遲一秒後開始追蹤
        if (autoStartTracking) {
            setTimeout(() => {
                if (!isTracking) {
                    startTracking();
                    showNotification('🎯 自動開始即時定位追蹤', 'info');
                }
            }, 1000);
        }
    }
}

// 自動獲取當前位置函數
function autoGetCurrentLocation() {
    if ('geolocation' in navigator) {
        // 顯示定位中的提示
        showNotification('📍 正在獲取您的位置...', 'info');
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                
                // 移動地圖到當前位置
                map.setView([currentPosition.lat, currentPosition.lng], 15);
                
                // 更新位置顯示
                updateLocationDisplay();
                
                // 更新當前位置標記
                updateCurrentLocationMarker();
                
                // 顯示成功通知
                const accuracy = Math.round(currentPosition.accuracy);
                showNotification(`🎯 定位成功！精度: ±${accuracy}公尺`, 'success');
                
                console.log('自動定位成功:', currentPosition);
            },
            function(error) {
                console.log('自動定位失敗:', error);
                
                // 根據錯誤類型顯示不同的提示
                let errorMessage = '📍 無法獲取位置';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '❌ 位置權限被拒絕，請在瀏覽器設定中允許位置存取';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '📍 位置信息不可用，請檢查GPS或網路連接';
                        break;
                    case error.TIMEOUT:
                        errorMessage = '⏰ 定位超時，請稍後再試';
                        break;
                    default:
                        errorMessage = '📍 定位失敗，請手動點擊定位按鈕重試';
                        break;
                }
                
                showNotification(errorMessage, 'warning');
                
                // 立即設定為預設位置（台北市中心）
                const defaultLat = 25.0330;
                const defaultLng = 121.5654;
                map.setView([defaultLat, defaultLng], 16);
                showNotification('已自動設定為台北市中心。您可以點擊地圖來添加標記。', 'info');
            },
            {
                enableHighAccuracy: true,
                timeout: 15000, // 增加超時時間到15秒
                maximumAge: 300000 // 5分鐘內的緩存位置可接受
            }
        );
    } else {
        showNotification('❌ 您的瀏覽器不支援地理定位功能', 'error');
    }
}

// 初始化Service Worker消息傳遞
function initServiceWorkerMessaging() {
    if ('serviceWorker' in navigator) {
        // 監聽來自Service Worker的消息
        navigator.serviceWorker.addEventListener('message', function(event) {
            console.log('Received message from Service Worker:', event.data);
            
            if (event.data && event.data.type === 'FOCUS_MARKER') {
                const markerId = event.data.markerId;
                focusMarker(markerId);
            }
            
            if (event.data && event.data.type === 'BACKGROUND_LOCATION_CHECK') {
                // 執行背景位置檢查
                if (isTracking && currentPosition) {
                    checkProximityAlerts();
                }
            }
        });
        
        // 定期向Service Worker發送保持活躍信號
        setInterval(() => {
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'KEEP_ALIVE',
                    timestamp: Date.now()
                });
            }
        }, 25000); // 每25秒發送一次
        
        // 當頁面即將關閉時，嘗試註冊背景同步
        window.addEventListener('beforeunload', function() {
            if (navigator.serviceWorker.controller && 'sync' in window.ServiceWorkerRegistration.prototype) {
                navigator.serviceWorker.ready.then(function(registration) {
                    return registration.sync.register('location-check');
                }).catch(function(error) {
                    console.log('Background sync registration failed:', error);
                });
            }
        });
        
        // 當頁面變為隱藏時，增加保持活躍頻率並啟動後台位置檢查
        let backgroundCheckInterval = null;
        
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                console.log('Page hidden, increasing Service Worker keep-alive frequency');
                
                // 頁面隱藏時，更頻繁地發送保持活躍信號
                const hiddenInterval = setInterval(() => {
                    if (navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({
                            type: 'KEEP_ALIVE',
                            timestamp: Date.now(),
                            hidden: true
                        });
                    }
                }, 10000); // 每10秒發送一次
                
                // 啟動後台位置檢查機制
                if (isTracking && currentPosition && trackingTarget) {
                    // 清除可能存在的舊間隔
                    if (backgroundCheckInterval) {
                        clearInterval(backgroundCheckInterval);
                    }
                    
                    // 設定後台檢查間隔，頻率較低以節省電池
                    backgroundCheckInterval = setInterval(() => {
                        if (!document.hidden) {
                            clearInterval(backgroundCheckInterval);
                            backgroundCheckInterval = null;
                            return;
                        }
                        
                        // 在後台模式下進行位置檢查
                        console.log('後台位置檢查');
                        checkProximityAlerts();
                        
                        // 向Service Worker發送後台位置檢查信號
                        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                            navigator.serviceWorker.controller.postMessage({
                                type: 'BACKGROUND_LOCATION_CHECK',
                                timestamp: Date.now(),
                                trackingTarget: trackingTarget ? {
                                    id: trackingTarget.id,
                                    name: trackingTarget.name,
                                    lat: trackingTarget.lat,
                                    lng: trackingTarget.lng
                                } : null,
                                currentPosition: currentPosition
                            });
                        }
                    }, 15000); // 每15秒檢查一次，平衡效能和電池消耗
                }
                
                // 當頁面重新可見時，清除高頻率間隔
                const visibilityHandler = function() {
                    if (!document.hidden) {
                        console.log('Page visible, reducing Service Worker keep-alive frequency');
                        clearInterval(hiddenInterval);
                        
                        // 清除後台檢查間隔
                        if (backgroundCheckInterval) {
                            clearInterval(backgroundCheckInterval);
                            backgroundCheckInterval = null;
                        }
                        
                        document.removeEventListener('visibilitychange', visibilityHandler);
                    }
                };
                document.addEventListener('visibilitychange', visibilityHandler);
            }
        });
    }
}



// 初始化地圖
function initMap() {
    // 預設位置（台北101）
    const defaultLat = 25.0330;
    const defaultLng = 121.5654;
    
    // 設定地圖初始縮放級別為18，適合查看建築物和街道細節
    map = L.map('map', {
        maxZoom: 22,  // 設定地圖最大縮放級別，符合Google地圖標準
        minZoom: 3    // 設定地圖最小縮放級別，允許查看更大範圍
    }).setView([defaultLat, defaultLng], 18);
    
    // 添加地圖圖層 - 使用Google地圖圖資
    // Google街道地圖 (主要圖層)
    const googleStreetLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '© Google',
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 22,  // 街道地圖最大縮放級別22
        minZoom: 3
    }).addTo(map);
    
    // Google衛星圖
    const googleSatelliteLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '© Google',
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 23,  // 衛星圖最大縮放級別23，在某些地區可達到建築物細節
        minZoom: 3
    });
    
    // Google混合圖 (衛星+標籤)
    const googleHybridLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '© Google',
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 23,  // 混合圖最大縮放級別23
        minZoom: 3
    });
    
    // Google地形圖
    const googleTerrainLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        attribution: '© Google',
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,  // 地形圖最大縮放級別20
        minZoom: 3
    });
    
    // 備用圖層 - OpenStreetMap
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,  // OSM最大縮放級別19
        minZoom: 3
    });
    
    // 地圖圖層控制
    const baseMaps = {
        "Google 街道地圖": googleStreetLayer,
        "Google 衛星圖": googleSatelliteLayer,
        "Google 混合圖": googleHybridLayer,
        "Google 地形圖": googleTerrainLayer,
        "OpenStreetMap": osmLayer
    };
    
    // 添加圖層控制器
    L.control.layers(baseMaps).addTo(map);
    
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
    
    // 為新增組別按鈕添加隨機顏色
    applyRandomColorToAddBtn();
    
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
        
        // 如果正在追蹤，重新啟動距離檢查定時器以使用新間隔
        if (trackingTarget && proximityCheckTimer) {
            startProximityCheck();
        }
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
            
            // 如果modal在全螢幕容器中，將其移回body
            const fullscreenContainer = document.querySelector('.map-container.fullscreen');
            if (fullscreenContainer && fullscreenContainer.contains(modal)) {
                document.body.appendChild(modal);
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
                
                // 如果modal在全螢幕容器中，將其移回body
                const fullscreenContainer = document.querySelector('.map-container.fullscreen');
                if (fullscreenContainer && fullscreenContainer.contains(this)) {
                    document.body.appendChild(this);
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
                // 如果modal在全螢幕容器中，將其移回body
                const fullscreenContainer = document.querySelector('.map-container.fullscreen');
                if (fullscreenContainer && fullscreenContainer.contains(modal)) {
                    document.body.appendChild(modal);
                }
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
    
    // 圖片上傳相關事件
    document.getElementById('uploadImageBtn').addEventListener('click', function() {
        document.getElementById('markerImages').click();
    });
    
    document.getElementById('cameraBtn').addEventListener('click', function() {
        document.getElementById('cameraInput').click();
    });
    
    document.getElementById('markerImages').addEventListener('change', handleImageUpload);
    document.getElementById('cameraInput').addEventListener('change', handleImageUpload);
    
    // 初始設定相關事件
    document.getElementById('startUsingBtn').addEventListener('click', handleInitialSetup);
    document.getElementById('skipSetupBtn').addEventListener('click', skipInitialSetup);
    document.getElementById('createFirstGroupBtn').addEventListener('click', showCreateGroupModal);
    
    // 建立組別表單
document.getElementById('createGroupForm').addEventListener('submit', handleCreateGroup);

// 測試通知按鈕
    document.getElementById('testNotificationBtn').addEventListener('click', testNotification);
    
    // 即時定位設定事件監聽器
    document.getElementById('enableHighAccuracy').addEventListener('change', function(e) {
        enableHighAccuracy = e.target.checked;
        saveData();
    });
    
    document.getElementById('autoStartTracking').addEventListener('change', function(e) {
        autoStartTracking = e.target.checked;
        saveData();
    });
    
    document.getElementById('keepMapCentered').addEventListener('change', function(e) {
        keepMapCentered = e.target.checked;
        saveData();
    });
    
    document.getElementById('locationUpdateFrequency').addEventListener('change', function(e) {
        locationUpdateFrequency = parseInt(e.target.value); // 已經是毫秒
        saveData();
    });
    
    document.getElementById('locationTimeout').addEventListener('change', function(e) {
        locationTimeout = parseInt(e.target.value) * 1000; // 轉換為毫秒
        saveData();
    });
    
}

// 圖片處理相關函數
// 圖片壓縮函數
function compressImage(file, maxSizeKB = 50) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // 計算壓縮後的尺寸
            let { width, height } = img;
            const maxDimension = 800; // 最大尺寸
            
            if (width > height && width > maxDimension) {
                height = (height * maxDimension) / width;
                width = maxDimension;
            } else if (height > maxDimension) {
                width = (width * maxDimension) / height;
                height = maxDimension;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 繪製圖片到canvas
            ctx.drawImage(img, 0, 0, width, height);
            
            // 嘗試不同的質量設置來達到目標文件大小
            let quality = 0.8;
            let compressedDataUrl;
            
            const tryCompress = () => {
                compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                const sizeKB = Math.round((compressedDataUrl.length * 3) / 4 / 1024);
                
                if (sizeKB > maxSizeKB && quality > 0.1) {
                    quality -= 0.1;
                    tryCompress();
                } else {
                    resolve(compressedDataUrl);
                }
            };
            
            tryCompress();
        };
        
        // 如果是文件對象，轉換為DataURL
        if (file instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            // 如果已經是DataURL
            img.src = file;
        }
    });
}

function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    
    // 檢查圖片數量限制
    const form = document.getElementById('markerForm');
    const existingImages = JSON.parse(form.dataset.imageData || '[]');
    const totalImages = existingImages.length + files.length;
    
    if (totalImages > 3) {
        showNotification('最多只能上傳3張圖片', 'warning');
        return;
    }
    
    // 處理每個文件
    let processedCount = 0;
    const newImages = [];
    
    files.forEach(file => {
        // 檢查文件類型
        if (!file.type.startsWith('image/')) {
            showNotification('請選擇圖片文件', 'warning');
            return;
        }
        
        // 檢查文件大小（限制為5MB）
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showNotification('圖片文件過大，請選擇小於5MB的圖片', 'warning');
            return;
        }
        
        // 使用壓縮功能處理圖片
        compressImage(file).then(compressedDataUrl => {
            newImages.push(compressedDataUrl);
            processedCount++;
            
            // 當所有圖片都處理完成時，更新預覽
            if (processedCount === files.length) {
                const allImages = [...existingImages, ...newImages];
                displayMultipleImagePreviews(allImages);
                showNotification(`已上傳 ${files.length} 張圖片並自動壓縮`, 'success');
            }
        }).catch(error => {
            console.error('圖片壓縮失敗:', error);
            showNotification('圖片處理失敗', 'error');
        });
    });
}

function displayMultipleImagePreviews(imagesArray) {
    const previewContainer = document.getElementById('imagePreviewContainer');
    const form = document.getElementById('markerForm');
    
    // 清空現有預覽
    previewContainer.innerHTML = '';
    
    // 存儲圖片數據到表單
    form.dataset.imageData = JSON.stringify(imagesArray);
    
    // 為每張圖片創建預覽元素
    imagesArray.forEach((imageData, index) => {
        const imagePreview = document.createElement('div');
        imagePreview.className = 'image-preview';
        imagePreview.dataset.index = index;
        
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = `圖片 ${index + 1}`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.innerHTML = '×';
        removeBtn.title = '刪除圖片';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeImageAtIndex(index);
        };
        
        // 添加點擊預覽功能
        imagePreview.onclick = () => {
            openImageModal(imagesArray, index);
        };
        
        imagePreview.appendChild(img);
        imagePreview.appendChild(removeBtn);
        previewContainer.appendChild(imagePreview);
    });
}

function removeImageAtIndex(index) {
    const form = document.getElementById('markerForm');
    const imagesArray = JSON.parse(form.dataset.imageData || '[]');
    
    // 移除指定索引的圖片
    imagesArray.splice(index, 1);
    
    // 更新預覽
    displayMultipleImagePreviews(imagesArray);
    
    // 清空文件輸入
    document.getElementById('markerImages').value = '';
}

function removeAllMarkerImages() {
    const previewContainer = document.getElementById('imagePreviewContainer');
    const fileInput = document.getElementById('markerImages');
    const form = document.getElementById('markerForm');
    
    // 清除預覽
    previewContainer.innerHTML = '';
    
    // 清除文件輸入
    fileInput.value = '';
    
    // 清除表單數據
    delete form.dataset.imageData;
}

function resetImageUpload() {
    removeAllMarkerImages();
}

// 圖片模態框預覽功能
function openImageModal(imagesArray, startIndex = 0) {
    const modal = document.getElementById('imagePreviewModal');
    const modalImg = document.getElementById('modalPreviewImg');
    const imageCounter = document.getElementById('imageCounter');
    const prevBtn = document.getElementById('prevImageBtn');
    const nextBtn = document.getElementById('nextImageBtn');
    
    let currentIndex = startIndex;
    
    function updateModalImage() {
        modalImg.src = imagesArray[currentIndex];
        imageCounter.textContent = `${currentIndex + 1} / ${imagesArray.length}`;
        
        // 更新按鈕狀態
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === imagesArray.length - 1;
    }
    
    function showPrevImage() {
        if (currentIndex > 0) {
            currentIndex--;
            updateModalImage();
        }
    }
    
    function showNextImage() {
        if (currentIndex < imagesArray.length - 1) {
            currentIndex++;
            updateModalImage();
        }
    }
    
    // 設置事件監聽器
    prevBtn.onclick = showPrevImage;
    nextBtn.onclick = showNextImage;
    
    // 鍵盤導航
    function handleKeyPress(e) {
        if (e.key === 'ArrowLeft') showPrevImage();
        if (e.key === 'ArrowRight') showNextImage();
        if (e.key === 'Escape') closeImageModal();
    }
    
    document.addEventListener('keydown', handleKeyPress);
    
    // 點擊背景關閉模態框
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeImageModal();
        }
    });
    
    // 關閉模態框時清理事件監聽器
    const originalCloseModal = closeImageModal;
    window.closeImageModal = function() {
        document.removeEventListener('keydown', handleKeyPress);
        originalCloseModal();
    };
    
    // 初始化並顯示模態框
    updateModalImage();
    modal.style.display = 'flex';
    
    // 如果處於全螢幕模式，確保modal在正確的容器中
    if (isFullscreen) {
        const fullscreenContainer = document.querySelector('.map-container.fullscreen');
        if (fullscreenContainer) {
            // 強制將modal移到全螢幕容器中
            fullscreenContainer.appendChild(modal);
            
            // 確保modal的樣式正確
            setTimeout(() => {
                modal.style.position = 'fixed';
                modal.style.zIndex = '10002';
                modal.style.left = '0';
                modal.style.top = '0';
                modal.style.width = '100vw';
                modal.style.height = '100vh';
            }, 10);
        }
    }
}

function closeImageModal() {
    const modal = document.getElementById('imagePreviewModal');
    
    // 如果在全屏模式下，將模態框移回原來的位置
    if (isFullscreen) {
        const fullscreenContainer = document.querySelector('.fullscreen');
        if (fullscreenContainer && fullscreenContainer.contains(modal)) {
            document.body.appendChild(modal);
            // 重置樣式
            modal.style.zIndex = '';
            modal.style.position = '';
            modal.style.top = '';
            modal.style.left = '';
            modal.style.width = '';
            modal.style.height = '';
        }
    }
    
    modal.style.display = 'none';
}

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





// 全螢幕功能
let isFullscreen = false;

function toggleFullscreen() {
    const mapContainer = document.querySelector('.map-container');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    
    console.log('toggleFullscreen called, current isFullscreen:', isFullscreen);
    console.log('mapContainer found:', !!mapContainer);
    console.log('fullscreenIcon found:', !!fullscreenIcon);
    
    if (!isFullscreen) {
        // 進入全螢幕模式
        console.log('Attempting to enter fullscreen');
        enterFullscreen(mapContainer);
    } else {
        // 退出全螢幕模式
        console.log('Attempting to exit fullscreen');
        exitFullscreen();
    }
}

function enterFullscreen(element) {
    const mapContainer = document.querySelector('.map-container');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    
    console.log('Entering fullscreen mode');
    
    // 添加全螢幕CSS類
    mapContainer.classList.add('fullscreen');
    
    // 更新按鈕圖標 - 進入全螢幕時顯示退出圖標
    fullscreenIcon.textContent = '⛶';
    
    // 檢測是否為行動裝置
    const isMobile = isMobileDevice();
    const isIOS = isIOSDevice();
    
    // iOS Safari 不支援對非video元素使用全螢幕API，直接使用CSS全螢幕
    if (isIOS) {
        console.log('iOS detected, using CSS fullscreen');
        handleCSSFullscreen();
        return;
    }
    
    // 對於其他行動裝置和桌面，嘗試使用原生全螢幕API
    let fullscreenPromise = null;
    
    if (element.requestFullscreen) {
        fullscreenPromise = element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
        fullscreenPromise = element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
        fullscreenPromise = element.msRequestFullscreen();
    }
    
    if (fullscreenPromise) {
        fullscreenPromise.catch((error) => {
            console.log('Native fullscreen failed, using CSS fullscreen:', error);
            handleCSSFullscreen();
        });
    } else {
        // 瀏覽器不支持原生全螢幕，使用CSS全螢幕
        console.log('Native fullscreen not supported, using CSS fullscreen');
        handleCSSFullscreen();
    }
    
    isFullscreen = true;
    
    // 如果modal已經打開，將其移到全螢幕容器中
    const modal = document.getElementById('markerModal');
    if (modal && modal.style.display === 'block') {
        mapContainer.appendChild(modal);
        
        // 確保modal的樣式正確
        setTimeout(() => {
            modal.style.position = 'fixed';
            modal.style.zIndex = '10001';
            modal.style.left = '0';
            modal.style.top = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
        }, 10);
    }
    

    
    // 重新調整地圖大小
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 100);
}

function exitFullscreen() {
    const mapContainer = document.querySelector('.map-container');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    
    console.log('Exiting fullscreen mode');
    
    // 移除全螢幕CSS類
    mapContainer.classList.remove('fullscreen');
    
    // 清理CSS全螢幕樣式
    mapContainer.style.position = '';
    mapContainer.style.top = '';
    mapContainer.style.left = '';
    mapContainer.style.width = '';
    mapContainer.style.height = '';
    mapContainer.style.minHeight = '';
    mapContainer.style.zIndex = '';
    mapContainer.style.backgroundColor = '';
    
    // 恢復頁面滾動條
    document.body.style.overflow = '';
    
    // 更新按鈕圖標 - 退出全螢幕時顯示進入圖標
    fullscreenIcon.textContent = '⛶';
    
    // 嘗試退出瀏覽器原生全螢幕
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen().catch(() => {});
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen().catch(() => {});
    }
    
    isFullscreen = false;
    
    // 將modal移回body（如果它在全螢幕容器中）
    const modal = document.getElementById('markerModal');
    if (modal && mapContainer.contains(modal)) {
        document.body.appendChild(modal);
        
        // 重置modal的樣式
        modal.style.position = '';
        modal.style.zIndex = '';
        modal.style.left = '';
        modal.style.top = '';
        modal.style.width = '';
        modal.style.height = '';
    }
    

    
    // 重新調整地圖大小
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 100);
}

function handleCSSFullscreen() {
    // 純CSS全螢幕實現，適用於不支持原生API的情況
    const mapContainer = document.querySelector('.map-container');
    const isIOS = isIOSDevice();
    
    mapContainer.style.position = 'fixed';
    mapContainer.style.top = '0';
    mapContainer.style.left = '0';
    mapContainer.style.width = '100vw';
    mapContainer.style.height = '100vh';
    mapContainer.style.zIndex = '9999';
    mapContainer.style.backgroundColor = '#000';
    
    // 行動裝置特殊處理
    if (isIOS) {
        // iOS Safari 特殊處理，隱藏地址欄
        mapContainer.style.height = '100vh';
        mapContainer.style.minHeight = '100vh';
        
        // 嘗試隱藏Safari的地址欄
        setTimeout(() => {
            window.scrollTo(0, 1);
            mapContainer.style.height = window.innerHeight + 'px';
        }, 100);
        
        // 監聽方向變化
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                mapContainer.style.height = window.innerHeight + 'px';
                if (map) {
                    map.invalidateSize();
                }
            }, 500);
        });
    }
    
    // 隱藏頁面滾動條
    document.body.style.overflow = 'hidden';
    
    console.log('CSS fullscreen activated for mobile device');
}

// 按鈕點擊處理函數
function handleFullscreenClick() {
    console.log('Fullscreen button clicked');
    toggleFullscreen();
}

function handleLocationClick() {
    console.log('Location button clicked');
    centerMapToCurrentLocation();
}

// 將函數暴露到全局作用域，讓HTML的onclick可以訪問
window.handleFullscreenClick = handleFullscreenClick;
window.handleLocationClick = handleLocationClick;

// 行動裝置檢測函數
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// 初始化控制按鈕
function initControlButtons() {
    // 拖曳功能
    initDragFunctionality();
    
    // 為行動裝置添加特殊提示
    if (isMobileDevice()) {
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            // 更新行動裝置的提示文字
            if (isIOSDevice()) {
                fullscreenBtn.title = '全螢幕顯示 (iOS使用CSS全螢幕)';
            } else {
                fullscreenBtn.title = '全螢幕顯示 (行動裝置)';
            }
        }
        
        console.log('Mobile device detected, fullscreen optimized for mobile');
    }
}

// 監聽全螢幕狀態變化
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('msfullscreenchange', handleFullscreenChange);

function handleFullscreenChange() {
    const isCurrentlyFullscreen = !!(document.fullscreenElement || 
                                    document.webkitFullscreenElement || 
                                    document.msFullscreenElement);
    
    if (!isCurrentlyFullscreen && isFullscreen) {
        // 用戶通過ESC或其他方式退出了全螢幕
        exitFullscreen();
    }
}

// 定位點功能
function getCurrentLocation() {
    const locationBtn = document.getElementById('locationBtn');
    const locationIcon = document.getElementById('locationIcon');
    
    // 檢查是否支持地理位置
    if (!navigator.geolocation) {
        showNotification('您的瀏覽器不支持地理位置功能', 'error');
        return;
    }
    
    // 設置按鈕為載入狀態
    locationBtn.classList.add('locating');
    locationBtn.disabled = true;
    locationIcon.textContent = '🔄';
    
    // 獲取當前位置
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // 更新當前位置
            currentPosition = { lat, lng };
            
            // 移動地圖到當前位置
            map.setView([lat, lng], 16);
            
            // 更新當前位置標記
            updateCurrentLocationMarker();
            
            // 恢復按鈕狀態
            locationBtn.classList.remove('locating');
            locationBtn.disabled = false;
            locationIcon.textContent = '📍';
            
            showNotification('已定位到您的位置', 'success');
        },
        function(error) {
            // 處理錯誤
            let errorMessage = '無法獲取位置';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = '位置權限被拒絕，請在瀏覽器設定中允許位置存取';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = '位置資訊無法取得';
                    break;
                case error.TIMEOUT:
                    errorMessage = '位置請求逾時';
                    break;
            }
            
            // 恢復按鈕狀態
            locationBtn.classList.remove('locating');
            locationBtn.disabled = false;
            locationIcon.textContent = '📍';
            
            showNotification(errorMessage, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

// 拖曳功能實現
function initDragFunctionality() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const locationBtn = document.getElementById('locationBtn');
    
    // 載入保存的按鈕位置
    loadButtonPositions();
    
    // 為每個按鈕添加拖曳功能
    makeDraggable(fullscreenBtn);
    makeDraggable(locationBtn);
    
    // 為手機添加額外的觸控事件處理
    addMobileTouchSupport(fullscreenBtn, 'handleFullscreenClick');
    addMobileTouchSupport(locationBtn, 'handleLocationClick');
}

// 為手機添加觸控事件支持
function addMobileTouchSupport(element, functionName) {
    let touchStartTime = 0;
    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;
    
    element.addEventListener('touchstart', function(e) {
        touchStartTime = Date.now();
        touchMoved = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        
        // 防止預設行為，確保觸控事件正確處理
        e.preventDefault();
    }, { passive: false });
    
    element.addEventListener('touchmove', function(e) {
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const moveDistance = Math.sqrt(
            Math.pow(touchX - touchStartX, 2) + Math.pow(touchY - touchStartY, 2)
        );
        
        // 如果移動距離超過10像素，視為移動
        if (moveDistance > 10) {
            touchMoved = true;
        }
    }, { passive: true });
    
    element.addEventListener('touchend', function(e) {
        const touchDuration = Date.now() - touchStartTime;
        
        // 防止預設行為
        e.preventDefault();
        
        // 如果是短時間觸控且沒有移動，且沒有被拖曳功能標記為已拖曳
        if (touchDuration < 500 && !touchMoved && !element.hasDragged) {
            console.log('Mobile touch click for:', element.id);
            
            // 立即調用對應的函數，不延遲（確保在用戶手勢事件中執行）
            if (functionName === 'handleFullscreenClick' && typeof window.handleFullscreenClick === 'function') {
                window.handleFullscreenClick();
            } else if (functionName === 'handleLocationClick' && typeof window.handleLocationClick === 'function') {
                window.handleLocationClick();
            }
        }
        
        // 重置拖曳標記
        setTimeout(() => {
            element.hasDragged = false;
        }, 50);
    }, { passive: false });
}

function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    let currentX = 0, currentY = 0;
    let dragStartTime = 0;
    
    // 明確初始化hasDragged為false
    element.hasDragged = false;
    
    // 獲取初始位置
    const computedStyle = window.getComputedStyle(element);
    initialX = parseInt(computedStyle.left) || 0;
    initialY = parseInt(computedStyle.top) || 0;
    
    // 只綁定開始事件到元素本身
    element.addEventListener('mousedown', dragStart);
    element.addEventListener('touchstart', dragStart, { passive: false });
    
    function dragStart(e) {
        dragStartTime = Date.now();
        element.hasDragged = false;
        
        if (e.type === 'touchstart') {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            // 綁定觸摸事件
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('touchend', dragEnd);
        } else {
            startX = e.clientX;
            startY = e.clientY;
            // 綁定滑鼠事件
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
        }
        
        isDragging = false;
        
        // 設置初始偏移
        const rect = element.getBoundingClientRect();
        currentX = rect.left - initialX;
        currentY = rect.top - initialY;
        
        // 只在滑鼠事件時preventDefault，觸控事件延遲處理
        if (e.type !== 'touchstart') {
            e.preventDefault();
        }
    }
    
    function drag(e) {
        let clientX, clientY;
        if (e.type === 'touchmove') {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        // 計算移動距離
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 如果移動距離超過5像素，開始拖曳
        if (!isDragging && distance > 5) {
            isDragging = true;
            element.hasDragged = true;
            element.classList.add('dragging');
            // 現在才阻止默認行為，確保真正開始拖曳
            e.preventDefault();
        }
        
        if (!isDragging) return;
        
        // 只在真正拖曳時阻止默認行為
        e.preventDefault();
        
        const newX = initialX + currentX + deltaX;
        const newY = initialY + currentY + deltaY;
        
        // 獲取視窗和元素尺寸
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const elementWidth = element.offsetWidth;
        const elementHeight = element.offsetHeight;
        
        // 限制在視窗範圍內
        const constrainedX = Math.max(0, Math.min(newX, windowWidth - elementWidth));
        const constrainedY = Math.max(0, Math.min(newY, windowHeight - elementHeight));
        
        // 應用新位置
        element.style.left = constrainedX + 'px';
        element.style.top = constrainedY + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
    }
    
    function dragEnd(e) {
        // 移除事件監聽器
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', dragEnd);
        
        // 總是重置拖曳狀態
        isDragging = false;
        element.classList.remove('dragging');
        
        if (element.hasDragged) {
            // 更新初始位置
            const computedStyle = window.getComputedStyle(element);
            initialX = parseInt(computedStyle.left) || 0;
            initialY = parseInt(computedStyle.top) || 0;
            currentX = 0;
            currentY = 0;
            
            // 保存位置到localStorage
            saveButtonPosition(element.id, initialX, initialY);
        }
        
        // 短暫延遲後重置hasDragged，避免立即觸發點擊
        setTimeout(() => {
            element.hasDragged = false;
        }, 10);
    }
    
    // 阻止拖曳時觸發點擊事件
    element.addEventListener('click', function(e) {
        // 只有在真正發生拖曳時才阻止點擊
        if (element.hasDragged) {
            console.log('Preventing click due to drag for element:', element.id);
            e.preventDefault();
            e.stopPropagation();
            return false;
        } else {
            console.log('Allowing click for element:', element.id);
        }
    }, false);
}

function saveButtonPosition(buttonId, x, y) {
    const positions = JSON.parse(localStorage.getItem('buttonPositions') || '{}');
    positions[buttonId] = { x, y };
    localStorage.setItem('buttonPositions', JSON.stringify(positions));
}

function loadButtonPositions() {
    const positions = JSON.parse(localStorage.getItem('buttonPositions') || '{}');
    
    Object.keys(positions).forEach(buttonId => {
        const element = document.getElementById(buttonId);
        if (element) {
            const { x, y } = positions[buttonId];
            element.style.left = x + 'px';
            element.style.top = y + 'px';
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }
    });
}

// 請求位置權限
function requestLocationPermission() {
    console.log('開始請求位置權限...');
    
    return new Promise((resolve, reject) => {
        // 檢查是否為HTTPS或localhost
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (!isSecure) {
            console.warn('警告：非安全連線可能影響定位功能');
            showNotification('提示：建議使用HTTPS以獲得更好的定位體驗', 'warning');
        }
        
        if ('geolocation' in navigator) {
        console.log('瀏覽器支援地理位置功能，正在請求位置...');
        navigator.geolocation.getCurrentPosition(
            function(position) {
                console.log('定位成功！', position);
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
                } else {
                    showNotification('定位成功！', 'success');
                }
                
                resolve(position);
            },
            function(error) {
                console.error('無法獲取位置:', error);
                console.log('錯誤詳情 - 代碼:', error.code, '訊息:', error.message);
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
                
                showNotification(errorMessage + '。' + detailedMessage, 'warning');
                
                // 立即設定為預設位置（台北市中心）
                const defaultLat = 25.0330;
                const defaultLng = 121.5654;
                map.setView([defaultLat, defaultLng], 16);
                showNotification('已自動設定為台北市中心。您可以點擊地圖來添加標記。', 'info');
                
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );
        } else {
            showNotification('您的瀏覽器不支援地理位置功能', 'error');
            reject(new Error('瀏覽器不支援地理位置功能'));
        }
    });
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
    
    // 確保modal在全螢幕模式下也能正確顯示
    modal.style.display = 'block';
    
    // 如果處於全螢幕模式，確保modal在正確的容器中
    if (isFullscreen) {
        const fullscreenContainer = document.querySelector('.map-container.fullscreen');
        if (fullscreenContainer) {
            // 強制將modal移到全螢幕容器中
            fullscreenContainer.appendChild(modal);
            
            // 確保modal的樣式正確
            setTimeout(() => {
                modal.style.position = 'fixed';
                modal.style.zIndex = '10001';
                modal.style.left = '0';
                modal.style.top = '0';
                modal.style.width = '100vw';
                modal.style.height = '100vh';
            }, 10);
        }
    }
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
    
    // 請求權限（位置權限已在initializeApp中調用）
    const permissionPromises = [];
    
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
    
    // 如果啟用保持地圖中央功能，自動將地圖中心移動到當前位置
    if (keepMapCentered) {
        map.setView([currentPosition.lat, currentPosition.lng], map.getZoom());
    }
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
        
        // 處理圖片顯示
        if (existingMarker.imageData) {
            let imageData = existingMarker.imageData;
            
            // 如果是字符串，嘗試解析為數組
            if (typeof imageData === 'string') {
                try {
                    imageData = JSON.parse(imageData);
                } catch (e) {
                    // 如果解析失敗，轉換為數組格式
                    imageData = [imageData];
                }
            }
            
            // 確保是數組格式
            if (!Array.isArray(imageData)) {
                imageData = [imageData];
            }
            
            // 設置表單數據並顯示預覽
            form.dataset.imageData = JSON.stringify(imageData);
            displayMultipleImagePreviews(imageData);
        } else {
            resetImageUpload();
        }
        
        document.getElementById('deleteMarkerBtn').style.display = 'block';
        
        form.dataset.markerId = existingMarker.id;
    } else {
        // 新增標記
        form.reset();
        resetImageUpload();
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
    
    // 確保modal在全螢幕模式下也能正確顯示
    modal.style.display = 'block';
    
    // 如果處於全螢幕模式，確保modal在正確的容器中並強制設定樣式
    if (isFullscreen) {
        const fullscreenContainer = document.querySelector('.map-container.fullscreen');
        if (fullscreenContainer) {
            // 強制將modal移到全螢幕容器中
            fullscreenContainer.appendChild(modal);
            
            // 延遲設定樣式確保正確顯示
            setTimeout(() => {
                modal.style.position = 'fixed';
                modal.style.zIndex = '10001';
                modal.style.left = '0';
                modal.style.top = '0';
                modal.style.width = '100vw';
                modal.style.height = '100vh';
                modal.style.display = 'block';
            }, 10);
        }
    }
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
    // 获取图片数据，支持多张图片
    let imageData = form.dataset.imageData || null;
    if (imageData) {
        try {
            // 尝试解析为数组
            imageData = JSON.parse(imageData);
        } catch (e) {
            // 如果解析失败，保持原始格式（兼容旧数据）
            console.log('Image data is not JSON format, keeping as string');
        }
    }
    
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
            marker.imageData = imageData;
            
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
                
                // 重新添加標記到地圖
                addMarkerToMap(marker);
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
            icon,
            imageData
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
    
    marker.leafletMarker = leafletMarker;
    
    // 使用統一的popup更新函數
    updateMarkerPopup(marker);
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
        

        
        // 如果正在追蹤位置，開始距離檢查定時器
        if (isTracking && currentPosition) {
            startProximityCheck();
        }
        
        // 重新渲染所有標記的popup以更新按鈕狀態
        refreshAllMarkerPopups();
    }
}

function clearTrackingTarget() {
    if (trackingTarget) {
        const targetName = trackingTarget.name;
        
        // 停止重複提醒
        stopRepeatedAlert(trackingTarget.id);
        
        // 清除追蹤目標
        trackingTarget = null;
        

        
        // 顯示通知
        showNotification(`已取消追蹤 "${targetName}"`);
        
        // 重新渲染所有標記的popup以更新按鈕狀態
        refreshAllMarkerPopups();
    }
}

function refreshAllMarkerPopups() {
    markers.forEach(marker => {
        if (marker.leafletMarker) {
            updateMarkerPopup(marker);
        }
    });
}

function updateMarkerPopup(marker) {
    const groupName = marker.groupId ? (groups.find(g => g.id === marker.groupId)?.name || '未知群組') : '無群組';
    const subgroupName = marker.subgroupId ? 
        (groups.find(g => g.id === marker.groupId)?.subgroups.find(sg => sg.id === marker.subgroupId)?.name || '未知子群組') : 
        '無子群組';
    
    // 計算距離顯示
    let distanceDisplay = '';
    if (currentPosition) {
        const distance = calculateDistance(
            currentPosition.lat, 
            currentPosition.lng, 
            marker.lat, 
            marker.lng
        );
        
        let distanceText = '';
        let distanceColor = '#666';
        
        if (distance < 1000) {
            distanceText = `${Math.round(distance)}公尺`;
        } else {
            distanceText = `${(distance / 1000).toFixed(1)}公里`;
        }
        
        // 根據距離設置顏色
        if (distance <= alertDistance) {
            distanceColor = '#ff4444'; // 紅色 - 接近目標
        } else if (distance <= alertDistance * 2) {
            distanceColor = '#ffaa00'; // 橙色 - 中等距離
        } else {
            distanceColor = '#4CAF50'; // 綠色 - 較遠距離
        }
        
        // 檢查是否為當前追蹤目標，如果是則添加閃爍效果
        const isTrackingTarget = trackingTarget && trackingTarget.id === marker.id;
        const blinkClass = isTrackingTarget ? ' tracking-distance-blink' : '';
        
        distanceDisplay = `<div class="distance-display${blinkClass}" style="font-size: 13px; color: ${distanceColor}; margin-bottom: 8px; font-weight: 500;">📍 距離: ${distanceText}</div>`;
    }
    
    // 檢查是否為當前追蹤目標
    const isCurrentTarget = trackingTarget && trackingTarget.id === marker.id;
    const trackingButton = isCurrentTarget 
        ? `<button onclick="clearTrackingTarget()" style="padding: 4px 8px; font-size: 12px; background-color: #ef4444; color: white;">取消追蹤</button>`
        : `<button onclick="setTrackingTarget('${marker.id}')" style="padding: 4px 8px; font-size: 12px;">追蹤</button>`;
    
    // 多張圖片顯示
    let imageDisplay = '';
    if (marker.imageData) {
        try {
            // 嘗試解析為數組（新格式）
            const imagesArray = Array.isArray(marker.imageData) ? marker.imageData : JSON.parse(marker.imageData);
            if (imagesArray.length > 0) {
                const imageElements = imagesArray.map((imageData, index) => 
                    `<img src="${imageData}" 
                         style="max-width: 80px; max-height: 80px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 2px; cursor: pointer; object-fit: cover;" 
                         alt="圖片 ${index + 1}"
                         onclick="openImageModal(${JSON.stringify(imagesArray).replace(/"/g, '&quot;')}, ${index})">`
                ).join('');
                
                imageDisplay = `<div style="margin-bottom: 8px; text-align: center;">
                    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;">
                        ${imageElements}
                    </div>
                    <div style="font-size: 11px; color: #888; margin-top: 4px;">點擊圖片預覽 (${imagesArray.length}/3)</div>
                </div>`;
            }
        } catch (e) {
            // 如果解析失敗，當作舊格式（單張圖片）處理
            if (typeof marker.imageData === 'string' && marker.imageData.startsWith('data:image/')) {
                imageDisplay = `<div style="margin-bottom: 8px; text-align: center;">
                    <img src="${marker.imageData}" 
                         style="max-width: 200px; max-height: 150px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;" 
                         alt="標註點圖片"
                         onclick="openImageModal(['${marker.imageData}'], 0)">
                    <div style="font-size: 11px; color: #888; margin-top: 4px;">點擊圖片預覽</div>
                </div>`;
            }
        }
    }
    
    const popupContent = `
        <div style="text-align: center; min-width: 200px;">
            <div style="font-size: 18px; margin-bottom: 8px;">${marker.icon} <strong>${marker.name}</strong></div>
            ${marker.description ? `<div style="font-size: 14px; color: #333; margin-bottom: 8px; text-align: left; padding: 0 10px;">${marker.description}</div>` : ''}
            ${imageDisplay}
            ${distanceDisplay}
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">群組: ${groupName}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 12px;">子群組: ${subgroupName}</div>
            <div style="display: flex; gap: 5px; justify-content: center; flex-wrap: wrap;">
                <button onclick="editMarker('${marker.id}')" style="padding: 4px 8px; font-size: 12px;">編輯</button>
                ${trackingButton}
                <button onclick="showOnlyThisMarker('${marker.id}')" style="padding: 4px 8px; font-size: 12px;">只顯示</button>
            </div>
        </div>
    `;
    
    // 如果還沒有綁定popup，先綁定
    if (!marker.leafletMarker.getPopup()) {
        marker.leafletMarker.bindPopup(popupContent);
    } else {
        marker.leafletMarker.setPopupContent(popupContent);
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
        // 更新狀態顯示
        updateLocationStatus('正在啟動追蹤...');
        
        watchId = navigator.geolocation.watchPosition(
            function(position) {
                const now = Date.now();
                lastLocationUpdate = now;
                
                // 計算速度（如果有前一個位置）
                let speed = null;
                if (currentPosition && position.coords.speed !== null) {
                    speed = position.coords.speed;
                } else if (currentPosition) {
                    const timeDiff = (now - currentPosition.timestamp) / 1000; // 秒
                    const distance = calculateDistance(
                        currentPosition.lat, currentPosition.lng,
                        position.coords.latitude, position.coords.longitude
                    );
                    if (timeDiff > 0) {
                        speed = distance / timeDiff; // 公尺/秒
                    }
                }
                
                currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: now,
                    speed: speed
                };
                
                updateLocationDisplay();
                updateCurrentLocationMarker();
                refreshAllMarkerPopups(); // 更新所有標記的提示窗距離顯示
                updateLocationStatus('追蹤中');
                
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
                        updateLocationStatus('權限被拒絕');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '位置信息不可用';
                        updateLocationStatus('位置不可用');
                        break;
                    case error.TIMEOUT:
                        errorMessage = '定位超時，請檢查GPS信號';
                        updateLocationStatus('定位超時');
                        break;
                }
                showNotification(errorMessage, 'error');
            },
            {
                enableHighAccuracy: enableHighAccuracy,
                timeout: locationTimeout,
                maximumAge: Math.min(locationUpdateFrequency, 10000)
            }
        );
        
        // 如果有追蹤目標，開始距離檢查定時器
        if (trackingTarget) {
            startProximityCheck();
        }
        
        showNotification(`位置追蹤已啟動 (${enableHighAccuracy ? '高精度' : '標準'}模式)`);
    } else {
        showNotification('您的瀏覽器不支援位置追蹤', 'error');
        updateLocationStatus('不支援定位');
    }
}

function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        
        // 停止距離檢查定時器
        stopProximityCheck();
        
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
    // 檢查是否從地圖上的定位按鈕調用，如果是則添加視覺反饋
    const locationBtn = document.getElementById('locationBtn');
    const locationIcon = document.getElementById('locationIcon');
    let isFromMapButton = false;
    
    // 檢查調用堆疊，判斷是否來自handleLocationClick
    const stack = new Error().stack;
    if (stack && stack.includes('handleLocationClick')) {
        isFromMapButton = true;
        // 設置按鈕為載入狀態
        if (locationBtn && locationIcon) {
            locationBtn.classList.add('locating');
            locationBtn.disabled = true;
            locationIcon.textContent = '🔄';
        }
    }
    
    if (currentPosition) {
        map.setView([currentPosition.lat, currentPosition.lng], 18);
        updateCurrentLocationMarker();
        // 顯示當前位置標記的彈出視窗
        if (currentLocationMarker) {
            currentLocationMarker.openPopup();
        }
        
        // 恢復按鈕狀態
        if (isFromMapButton && locationBtn && locationIcon) {
            locationBtn.classList.remove('locating');
            locationBtn.disabled = false;
            locationIcon.textContent = '📍';
        }
        
        showNotification('已回到您的位置', 'success');
    } else {
        // 如果沒有位置資料，請求位置權限
        requestLocationPermission().then(() => {
            // 恢復按鈕狀態
            if (isFromMapButton && locationBtn && locationIcon) {
                locationBtn.classList.remove('locating');
                locationBtn.disabled = false;
                locationIcon.textContent = '📍';
            }
        }).catch(() => {
            // 恢復按鈕狀態
            if (isFromMapButton && locationBtn && locationIcon) {
                locationBtn.classList.remove('locating');
                locationBtn.disabled = false;
                locationIcon.textContent = '📍';
            }
        });
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

// 距離檢查定時器
let proximityCheckTimer = null;

// 開始距離檢查定時器
function startProximityCheck() {
    // 清除現有定時器
    if (proximityCheckTimer) {
        clearInterval(proximityCheckTimer);
    }
    
    // 設定定時器，使用用戶設定的提醒間隔時間檢查距離
    proximityCheckTimer = setInterval(() => {
        checkProximityAlerts();
    }, alertInterval * 1000); // 使用設定的提醒間隔時間
    
    // 立即執行一次檢查
    checkProximityAlerts();
}

// 停止距離檢查定時器
function stopProximityCheck() {
    if (proximityCheckTimer) {
        clearInterval(proximityCheckTimer);
        proximityCheckTimer = null;
    }
}

// 接近提醒檢查（僅用於判斷進入/離開範圍）
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
            console.log(`標註點 "${trackingTarget.name}" 進入範圍 (${Math.round(distance)}m)，開始定時通知`);
        }
        // 如果已經在範圍內，不做任何操作，讓定時器處理後續通知
    } else {
        // 如果追蹤目標離開範圍
        if (markersInRange.has(trackingTarget.id)) {
            markersInRange.delete(trackingTarget.id);
            stopRepeatedAlert(trackingTarget.id);
            console.log(`標註點 "${trackingTarget.name}" 離開範圍 (${Math.round(distance)}m)，停止通知`);
        }
    }
}

// 開始重複通知
function startRepeatedAlert(markerId, marker) {
    // 清除可能存在的舊定時器
    stopRepeatedAlert(markerId);
    
    // 設定新的定時器，直接按照設定的間隔時間進行通知
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
            // 在範圍內，按照設定間隔發送通知（不再檢查上次通知時間）
            showLocationAlert(marker, distance);
            lastAlertTimes.set(markerId, Date.now());
            console.log(`按間隔通知 ${marker.name}，距離 ${Math.round(distance)} 公尺`);
        } else {
            // 如果已經離開範圍，停止定時器
            console.log(`${marker.name} 已離開範圍，停止通知`);
            stopRepeatedAlert(markerId);
        }
    }, alertInterval * 1000); // 直接使用設定的間隔時間
    
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
    
    // 1. 增強的 Service Worker 通知 (最適合背景運作)
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(function(registration) {
            // 使用新的消息傳遞方式
            if (registration.active) {
                registration.active.postMessage({
                    type: 'LOCATION_ALERT',
                    title: '位置提醒',
                    body: message,
                    data: {
                        markerId: marker.id,
                        markerName: marker.name,
                        distance: Math.round(distance),
                        lat: marker.lat,
                        lng: marker.lng,
                        tag: 'location-alert-' + marker.id,
                        timestamp: Date.now()
                    }
                });
            } else {
                // 降級到直接通知
                registration.showNotification('位置提醒', {
                    body: message,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
                    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red"><circle cx="12" cy="12" r="10"/></svg>',
                    vibrate: [200, 100, 200, 100, 200],
                    tag: 'location-alert-' + marker.id,
                    requireInteraction: true,
                    silent: false,
                    data: { markerId: marker.id },
                    actions: [
                        {
                            action: 'view',
                            title: '查看位置'
                        }
                    ]
                });
            }
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

// 更新定位狀態顯示
function updateLocationStatus(status) {
    const statusDiv = document.getElementById('locationStatus');
    if (statusDiv) {
        statusDiv.textContent = status;
    }
}

// 更新速度顯示
function updateSpeedDisplay(speed) {
    const speedDiv = document.getElementById('locationSpeed');
    if (speedDiv && speed !== null && speed !== undefined) {
        const speedKmh = (speed * 3.6).toFixed(1); // 轉換為 km/h
        speedDiv.textContent = `${speedKmh} km/h`;
    } else if (speedDiv) {
        speedDiv.textContent = '-- km/h';
    }
}

// UI更新函數
function updateLocationDisplay() {
    const locationDiv = document.getElementById('currentLocation');
    const accuracyDiv = document.getElementById('locationAccuracy');
    
    if (currentPosition) {
        let timeText = '';
        
        if (currentPosition.timestamp) {
            const updateTime = new Date(currentPosition.timestamp);
            timeText = `<br><span style="color: #888; font-size: 12px;">更新: ${updateTime.toLocaleTimeString()}</span>`;
        }
        
        locationDiv.innerHTML = `
            緯度: ${currentPosition.lat.toFixed(6)}<br>
            經度: ${currentPosition.lng.toFixed(6)}${timeText}
        `;
        
        // 更新精度顯示
        if (currentPosition.accuracy && accuracyDiv) {
            const accuracy = Math.round(currentPosition.accuracy);
            let accuracyClass = 'accuracy-good';
            let accuracyIcon = '🎯';
            
            if (accuracy > 100) {
                accuracyClass = 'accuracy-poor';
                accuracyIcon = '📍';
            } else if (accuracy > 50) {
                accuracyClass = 'accuracy-medium';
                accuracyIcon = '🎯';
            } else {
                accuracyClass = 'accuracy-good';
                accuracyIcon = '🎯';
            }
            
            accuracyDiv.innerHTML = `${accuracyIcon} 精度: ±${accuracy}公尺`;
            accuracyDiv.className = `accuracy-display ${accuracyClass}`;
        } else if (accuracyDiv) {
            accuracyDiv.innerHTML = '📍 精度: --';
            accuracyDiv.className = 'accuracy-display';
        }
    } else {
        locationDiv.textContent = '位置未知';
        if (accuracyDiv) {
            accuracyDiv.innerHTML = '📍 精度: --';
            accuracyDiv.className = 'accuracy-display';
        }
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
    
    // 為新生成的組別按鈕添加隨機顏色動畫
    addRandomColorAnimationToGroupButtons();
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

// 添加測試popup功能
function testPopupFunction() {
    console.log('=== 測試Popup功能 ===');
    
    // 創建測試標記
    const testMarker = new Marker(
        'test-popup-' + Date.now(),
        '測試Popup標記',
        '這是一個測試popup功能的標記',
        25.0330,
        121.5654,
        null,
        null,
        'blue',
        '🧪'
    );
    
    // 添加到markers陣列
    markers.push(testMarker);
    
    // 添加到地圖
    addMarkerToMap(testMarker);
    
    console.log('測試標記已創建:', testMarker);
    console.log('標記的leafletMarker:', testMarker.leafletMarker);
    console.log('Popup是否已綁定:', testMarker.leafletMarker ? testMarker.leafletMarker.getPopup() : 'leafletMarker不存在');
    
    // 顯示通知
    showNotification('🧪 測試標記已添加到地圖！請點擊藍色的🧪圖標查看popup', 'info');
    
    // 將地圖中心移動到測試標記
    if (map) {
        map.setView([testMarker.lat, testMarker.lng], 15);
    }
}

// 將測試函數添加到全局範圍
window.testPopupFunction = testPopupFunction;

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
        subgroupId: marker.subgroupId,
        color: marker.color,
        icon: marker.icon,
        imageData: marker.imageData
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
        currentSubgroup: currentSubgroup ? { id: currentSubgroup.id, name: currentSubgroup.name, groupId: currentSubgroup.groupId } : null,
        // 即時定位設定
        enableHighAccuracy: enableHighAccuracy,
        autoStartTracking: autoStartTracking,
        locationUpdateFrequency: locationUpdateFrequency,
        locationTimeout: locationTimeout
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
                    markerData.subgroupId,
                    markerData.color || 'red',
                    markerData.icon || '📍',
                    markerData.imageData || null
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
            
            // 恢復即時定位設定
            enableHighAccuracy = data.enableHighAccuracy !== undefined ? data.enableHighAccuracy : true;
            autoStartTracking = data.autoStartTracking !== undefined ? data.autoStartTracking : false;
            locationUpdateFrequency = data.locationUpdateFrequency || 3000;
            locationTimeout = data.locationTimeout || 20000;
            
            document.getElementById('alertDistance').value = alertDistance;
            document.getElementById('alertInterval').value = alertInterval;
            
            // 更新即時定位設定UI
            document.getElementById('enableHighAccuracy').checked = enableHighAccuracy;
            document.getElementById('autoStartTracking').checked = autoStartTracking;
            document.getElementById('locationUpdateFrequency').value = locationUpdateFrequency; // 已經是毫秒
            document.getElementById('locationTimeout').value = locationTimeout / 1000; // 轉換為秒
            
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
window.clearTrackingTarget = clearTrackingTarget;
window.showOnlyThisMarker = showOnlyThisMarker;

function saveCurrentSettings() {
    try {
        // 獲取當前設定值，加入安全檢查
        const enableNotificationsEl = document.getElementById('enableNotifications');
        const alertDistanceEl = document.getElementById('alertDistance');
        const alertIntervalEl = document.getElementById('alertInterval');
        
        if (!enableNotificationsEl || !alertDistanceEl || !alertIntervalEl) {
            throw new Error('設定介面元素未找到');
        }
        
        const enableNotifications = enableNotificationsEl.checked;
        const currentAlertDistance = parseInt(alertDistanceEl.value);
        const currentAlertInterval = parseInt(alertIntervalEl.value);
        
        // 驗證數值
        if (isNaN(currentAlertDistance) || currentAlertDistance < 1) {
            throw new Error('提醒距離必須是有效的正數');
        }
        
        if (isNaN(currentAlertInterval) || currentAlertInterval < 1) {
            throw new Error('提醒間隔必須是有效的正數');
        }
        
        // 準備標註點資料（不包含markers屬性的簡化版本）
        const markersToSave = markers.map(marker => ({
            id: marker.id,
            name: marker.name,
            description: marker.description,
            lat: marker.lat,
            lng: marker.lng,
            groupId: marker.groupId,
            subgroupId: marker.subgroupId,
            color: marker.color,
            icon: marker.icon
        }));
        
        // 準備群組資料（不包含markers屬性）
        const groupsToSave = groups.map(group => ({
            id: group.id,
            name: group.name,
            subgroups: group.subgroups.map(subgroup => ({
                id: subgroup.id,
                name: subgroup.name,
                groupId: subgroup.groupId
            }))
        }));
        
        // 建立完整設定物件
        const settings = {
            // 位置提醒設定
            enableNotifications: enableNotifications,
            alertDistance: currentAlertDistance,
            alertInterval: currentAlertInterval,
            
            // 地圖設定
            keepMapCentered: keepMapCentered,
            
            // 標註點和群組資料
            markers: markersToSave,
            groups: groupsToSave,
            currentGroup: currentGroup,
            currentSubgroup: currentSubgroup,
            
            // 儲存時間戳
            savedAt: new Date().toISOString()
        };
        
        // 保存到localStorage
        localStorage.setItem('userSettings', JSON.stringify(settings));
        
        // 更新全域變數
        alertDistance = currentAlertDistance;
        alertInterval = currentAlertInterval;
        
        const savedDate = new Date(settings.savedAt).toLocaleString('zh-TW');
        const markerCount = markersToSave.length;
        const groupCount = groupsToSave.length;
        showNotification(`設定已儲存 (${savedDate})\n包含 ${markerCount} 個標註點，${groupCount} 個群組`, 'success');
        
        console.log('Settings saved:', settings);
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('儲存設定時發生錯誤', 'error');
        return false;
    }
}

function loadSavedSettings() {
    try {
        const savedSettings = localStorage.getItem('userSettings');
        if (!savedSettings) {
            showNotification('沒有找到已儲存的設定', 'info');
            return false;
        }
        
        const settings = JSON.parse(savedSettings);
        
        // 應用位置提醒設定到UI
        if (settings.enableNotifications !== undefined) {
            document.getElementById('enableNotifications').checked = settings.enableNotifications;
        }
        if (settings.alertDistance !== undefined) {
            document.getElementById('alertDistance').value = settings.alertDistance;
            alertDistance = settings.alertDistance;
        }
        if (settings.alertInterval !== undefined) {
            document.getElementById('alertInterval').value = settings.alertInterval;
            alertInterval = settings.alertInterval;
        }
        
        // 應用地圖設定到UI
        if (settings.keepMapCentered !== undefined) {
            document.getElementById('keepMapCentered').checked = settings.keepMapCentered;
            keepMapCentered = settings.keepMapCentered;
        }
        
        // 載入標註點和群組資料（如果存在）
        if (settings.markers && settings.groups) {
            // 清除現有資料
            markers = [];
            groups = [];
            
            // 重建群組結構
            groups = settings.groups.map(groupData => {
                const group = new Group(groupData.id, groupData.name);
                groupData.subgroups.forEach(subgroupData => {
                    const subgroup = new Subgroup(subgroupData.id, subgroupData.name, subgroupData.groupId);
                    group.addSubgroup(subgroup);
                });
                return group;
            });
            
            // 重建標註點
            markers = settings.markers.map(markerData => 
                new Marker(
                    markerData.id,
                    markerData.name,
                    markerData.description,
                    markerData.lat,
                    markerData.lng,
                    markerData.groupId,
                    markerData.subgroupId,
                    markerData.color || 'red',
                    markerData.icon || '📍'
                )
            );
            
            // 將標註點加入對應的群組和子群組
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
            
            // 恢復當前選擇的群組和子群組
            currentGroup = settings.currentGroup;
            currentSubgroup = settings.currentSubgroup;
            
            // 更新UI
            updateGroupsList();
            updateMarkersList();
            
            // 清除地圖上的現有標記並重新顯示
            updateMapMarkers();
        }
        
        const savedDate = new Date(settings.savedAt).toLocaleString('zh-TW');
        const markerCount = settings.markers ? settings.markers.length : 0;
        const groupCount = settings.groups ? settings.groups.length : 0;
        
        if (markerCount > 0 || groupCount > 0) {
            showNotification(`已載入設定 (儲存於: ${savedDate})\n包含 ${markerCount} 個標註點，${groupCount} 個群組`, 'success');
        } else {
            showNotification(`已載入設定 (儲存於: ${savedDate})`, 'success');
        }
        
        console.log('Settings loaded:', settings);
        return true;
    } catch (error) {
        console.error('Error loading settings:', error);
        showNotification('載入設定時發生錯誤', 'error');
        return false;
    }
}

function resetToDefaultSettings() {
    try {
        // 確認是否要清除所有資料
        const confirmReset = confirm('重置設定將會清除所有標註點和群組資料，確定要繼續嗎？');
        if (!confirmReset) {
            return;
        }
        
        // 重置位置提醒設定為預設值
        document.getElementById('enableNotifications').checked = true;
        document.getElementById('alertDistance').value = 100;
        document.getElementById('alertInterval').value = 30;
        
        // 更新全域變數
        alertDistance = 100;
        alertInterval = 30;
        
        // 清除標註點和群組資料
        markers = [];
        groups = [];
        currentGroup = null;
        currentSubgroup = null;
        
        // 停止所有提醒
        lastAlerts.clear();
        lastAlertTimes.clear();
        alertTimers.forEach(timer => clearInterval(timer));
        alertTimers.clear();
        markersInRange.clear();
        
        // 停止追蹤
        trackingTarget = null;
        if (isTracking) {
            stopTracking();
        }
        
        // 清除過濾器
        currentFilter = null;
        
        // 更新UI
        updateGroupsList();
        updateMarkersList();
        updateMapMarkers();
        
        // 清除儲存的設定
        localStorage.removeItem('userSettings');
        
        showNotification('已重置為預設設定，所有標註點和群組已清除', 'success');
        console.log('Settings and data reset to defaults');
    } catch (error) {
        console.error('Error resetting settings:', error);
        showNotification('重置設定時發生錯誤', 'error');
    }
}

// 匯出標註點資料
async function exportMarkerData() {
    try {
        // 準備匯出資料，包含標註點、群組和設定
        const markersToExport = await Promise.all(markers.map(async marker => {
            let compressedImageData = null;
            
            // 如果有圖片資料，進行壓縮處理
            if (marker.imageData) {
                if (Array.isArray(marker.imageData)) {
                    // 處理多張圖片
                    compressedImageData = await Promise.all(
                        marker.imageData.map(async imageData => {
                            if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
                                return await compressImage(imageData, 50);
                            }
                            return imageData;
                        })
                    );
                } else if (typeof marker.imageData === 'string' && marker.imageData.startsWith('data:image/')) {
                    // 處理單張圖片
                    compressedImageData = await compressImage(marker.imageData, 50);
                }
            }
            
            return {
                id: marker.id,
                name: marker.name,
                description: marker.description,
                lat: marker.lat,
                lng: marker.lng,
                groupId: marker.groupId,
                subgroupId: marker.subgroupId,
                color: marker.color || 'red',
                icon: marker.icon || '📍',
                imageData: compressedImageData
            };
        }));
        
        const groupsToExport = groups.map(group => ({
            id: group.id,
            name: group.name,
            subgroups: group.subgroups.map(subgroup => ({
                id: subgroup.id,
                name: subgroup.name,
                groupId: subgroup.groupId
            }))
        }));
        
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            markers: markersToExport,
            groups: groupsToExport,
            settings: {
                alertDistance: alertDistance,
                alertInterval: alertInterval,
                enableNotifications: document.getElementById('enableNotifications').checked
            },
            currentGroup: currentGroup,
            currentSubgroup: currentSubgroup
        };
        
        // 建立下載連結
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        // 建立下載檔案名稱
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `地圖標註資料_${dateStr}_${timeStr}.json`;
        
        // 觸發下載
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // 清理URL物件
        URL.revokeObjectURL(url);
        
        const markerCount = markersToExport.length;
        const groupCount = groupsToExport.length;
        showNotification(`資料匯出成功！\n包含 ${markerCount} 個標註點，${groupCount} 個群組`, 'success');
        
        console.log('Data exported successfully:', exportData);
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('匯出資料時發生錯誤', 'error');
    }
}

// 匯入標註點資料
function importMarkerData(file) {
    try {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importData = JSON.parse(e.target.result);
                
                // 驗證資料格式
                if (!importData.markers || !importData.groups) {
                    throw new Error('無效的資料格式');
                }
                
                // 詢問使用者是否要覆蓋現有資料
                const hasExistingData = markers.length > 0 || groups.length > 0;
                let shouldProceed = true;
                
                if (hasExistingData) {
                    shouldProceed = confirm(
                        `即將匯入 ${importData.markers.length} 個標註點和 ${importData.groups.length} 個群組。\n\n` +
                        '這將會覆蓋目前所有的標註點和群組資料。\n\n' +
                        '確定要繼續嗎？'
                    );
                }
                
                if (!shouldProceed) {
                    return;
                }
                
                // 清除現有資料
                clearAllData();
                
                // 重建群組
                groups = importData.groups.map(groupData => {
                    const group = new Group(groupData.id, groupData.name);
                    groupData.subgroups.forEach(subgroupData => {
                        const subgroup = new Subgroup(subgroupData.id, subgroupData.name, subgroupData.groupId);
                        group.addSubgroup(subgroup);
                    });
                    return group;
                });
                
                // 重建標註點
                markers = importData.markers.map(markerData => 
                    new Marker(
                        markerData.id,
                        markerData.name,
                        markerData.description,
                        markerData.lat,
                        markerData.lng,
                        markerData.groupId,
                        markerData.subgroupId,
                        markerData.color || 'red',
                        markerData.icon || '📍',
                        markerData.imageData || null
                    )
                );
                
                // 將標註點加入對應的群組和子群組
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
                
                // 恢復設定（如果有的話）
                if (importData.settings) {
                    alertDistance = importData.settings.alertDistance || 100;
                    alertInterval = importData.settings.alertInterval || 30;
                    
                    // 更新UI設定
                    document.getElementById('alertDistance').value = alertDistance;
                    document.getElementById('alertInterval').value = alertInterval;
                    if (importData.settings.enableNotifications !== undefined) {
                        document.getElementById('enableNotifications').checked = importData.settings.enableNotifications;
                    }
                }
                
                // 恢復當前選擇的群組和子群組
                currentGroup = importData.currentGroup;
                currentSubgroup = importData.currentSubgroup;
                
                // 更新UI
                updateGroupsList();
                updateMarkersList();
                updateMapMarkers();
                
                // 儲存到localStorage
                saveData();
                
                const markerCount = importData.markers.length;
                const groupCount = importData.groups.length;
                const importDate = importData.exportDate ? 
                    new Date(importData.exportDate).toLocaleString('zh-TW') : '未知';
                
                showNotification(
                    `資料匯入成功！\n` +
                    `包含 ${markerCount} 個標註點，${groupCount} 個群組\n` +
                    `(匯出時間: ${importDate})`, 
                    'success'
                );
                
                console.log('Data imported successfully:', importData);
                
            } catch (parseError) {
                console.error('Error parsing imported data:', parseError);
                showNotification('匯入的檔案格式不正確', 'error');
            }
        };
        
        reader.readAsText(file);
        
        // 清空檔案輸入，允許重複選擇同一檔案
        document.getElementById('importFileInput').value = '';
        
    } catch (error) {
        console.error('Error importing data:', error);
        showNotification('匯入資料時發生錯誤', 'error');
    }
}

// 清除所有資料的輔助函數
function clearAllData() {
    // 清除地圖上的標記
    markers.forEach(marker => {
        if (marker.leafletMarker) {
            map.removeLayer(marker.leafletMarker);
        }
    });
    
    // 清空陣列
    markers = [];
    groups = [];
    currentGroup = null;
    currentSubgroup = null;
    
    // 清除提醒相關的資料
    lastAlerts.clear();
    lastAlertTimes.clear();
    alertTimers.forEach(timer => clearInterval(timer));
    alertTimers.clear();
    markersInRange.clear();
    
    // 停止追蹤
    if (trackingTarget) {
        stopTracking();
    }
    
    // 清除過濾器
    clearFilter();
}

function initSettingsButtons() {
    // 儲存設定按鈕
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentSettings);
    }
    
    // 載入設定按鈕
    const loadBtn = document.getElementById('loadSettingsBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadSavedSettings);
    }
    
    // 重置設定按鈕
    const resetBtn = document.getElementById('resetSettingsBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            if (confirm('確定要重置所有設定為預設值嗎？')) {
                resetToDefaultSettings();
            }
        });
    }
    
    // 匯出資料按鈕
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async function() {
            await exportMarkerData();
        });
    }
    
    // 匯入資料按鈕
    const importBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    if (importBtn && importFileInput) {
        importBtn.addEventListener('click', function() {
            importFileInput.click();
        });
        
        importFileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                importMarkerData(file);
            }
        });
    }
    
    // 監聽設定變更以即時更新全域變數
    const alertDistanceInput = document.getElementById('alertDistance');
    const alertIntervalInput = document.getElementById('alertInterval');
    
    if (alertDistanceInput) {
        alertDistanceInput.addEventListener('change', function() {
            alertDistance = parseInt(this.value);
            console.log('Alert distance updated:', alertDistance);
        });
    }
    
    if (alertIntervalInput) {
        alertIntervalInput.addEventListener('change', function() {
            alertInterval = parseInt(this.value);
            console.log('Alert interval updated:', alertInterval);
            
            // 如果正在追蹤，重新啟動距離檢查定時器以使用新間隔
            if (trackingTarget && proximityCheckTimer) {
                startProximityCheck();
            }
        });
    }
}

// 在應用初始化時載入已儲存的設定
function loadSettingsOnInit() {
    try {
        const savedSettings = localStorage.getItem('userSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            // 應用設定到UI
            document.getElementById('enableNotifications').checked = settings.enableNotifications;
            document.getElementById('alertDistance').value = settings.alertDistance;
            document.getElementById('alertInterval').value = settings.alertInterval;
            
            // 更新全域變數
            alertDistance = settings.alertDistance;
            alertInterval = settings.alertInterval;
            
            console.log('Settings loaded on init:', settings);
        }
    } catch (error) {
        console.error('Error loading settings on init:', error);
    }
}

// 隨機顏色功能
function applyRandomColorToAddBtn() {
    const colors = ['red', 'blue', 'purple', 'orange', 'pink'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const addBtn = document.getElementById('addGroupBtn');
    
    // 移除所有顏色類別
    colors.forEach(color => {
        addBtn.classList.remove(`color-${color}`);
    });
    
    // 添加隨機顏色類別
    addBtn.classList.add(`color-${randomColor}`);
}

// 為組別內的按鈕添加隨機顏色動畫
function addRandomColorAnimationToGroupButtons() {
    const groupButtons = document.querySelectorAll('.group-actions button');
    groupButtons.forEach((button, index) => {
        // 為每個按鈕添加延遲動畫
        button.style.animationDelay = `${index * 0.1}s`;
        
        // 添加點擊時的隨機顏色變化
        button.addEventListener('click', function() {
            const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            
            // 創建臨時的顏色變化效果
            this.style.background = randomColor;
            setTimeout(() => {
                this.style.background = '';
            }, 300);
        });
    });
}

// 初始化 - 在所有函數定義之後
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired');
    
    initEventListeners();
    initializeApp();
    
    // 初始化拖曳功能
    console.log('Initializing drag functionality...');
    try {
        initDragFunctionality();
        console.log('Drag functionality initialized');
    } catch (error) {
        console.error('Error initializing drag functionality:', error);
    }
    
    // 延遲執行其他初始化函數
    setTimeout(() => {
        // 載入設定
        try {
            console.log('Calling loadSettingsOnInit...');
            if (typeof loadSettingsOnInit === 'function') {
                loadSettingsOnInit();
            } else {
                console.warn('loadSettingsOnInit function not found');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        

        
        // 請求定位權限
        try {
            console.log('Calling requestLocationPermission...');
            if (typeof requestLocationPermission === 'function') {
                requestLocationPermission();
            } else {
                console.warn('requestLocationPermission function not found');
            }
        } catch (error) {
            console.error('Error requesting location permission:', error);
        }
    }, 100);
});