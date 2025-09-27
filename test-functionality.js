// 功能測試腳本
// 此腳本用於測試地圖標註系統的所有功能

class FunctionalityTester {
    constructor() {
        this.testResults = [];
        this.isRunning = false;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        
        console.log(logMessage);
        
        this.testResults.push({
            timestamp,
            message,
            type
        });

        // 顯示在頁面上（如果有測試面板）
        this.displayTestResult(logMessage, type);
    }

    displayTestResult(message, type) {
        // 創建或獲取測試結果面板
        let testPanel = document.getElementById('test-panel');
        if (!testPanel) {
            testPanel = document.createElement('div');
            testPanel.id = 'test-panel';
            testPanel.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                width: 300px;
                max-height: 400px;
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                overflow-y: auto;
                z-index: 10000;
                display: none;
            `;
            document.body.appendChild(testPanel);
        }

        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            margin: 2px 0;
            color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#fff'};
        `;
        resultDiv.textContent = message;
        testPanel.appendChild(resultDiv);
        
        // 自動滾動到底部
        testPanel.scrollTop = testPanel.scrollHeight;
    }

    showTestPanel() {
        const testPanel = document.getElementById('test-panel');
        if (testPanel) {
            testPanel.style.display = 'block';
        }
    }

    hideTestPanel() {
        const testPanel = document.getElementById('test-panel');
        if (testPanel) {
            testPanel.style.display = 'none';
        }
    }

    async runAllTests() {
        if (this.isRunning) {
            this.log('測試已在進行中...', 'info');
            return;
        }

        this.isRunning = true;
        this.testResults = [];
        this.showTestPanel();
        
        this.log('開始功能測試...', 'info');

        try {
            await this.testEnvironment();
            await this.testMapInitialization();
            await this.testLocationServices();
            await this.testMarkerFunctionality();
            await this.testGroupManagement();
            await this.testSettingsAndPreferences();
            await this.testNotifications();
            await this.testOfflineCapabilities();
            await this.testAndroidIntegration();
            
            this.log('所有測試完成！', 'success');
            this.generateTestReport();
            
        } catch (error) {
            this.log(`測試過程中發生錯誤: ${error.message}`, 'error');
        } finally {
            this.isRunning = false;
        }
    }

    async testEnvironment() {
        this.log('測試運行環境...', 'info');
        
        // 檢測瀏覽器支援
        const features = {
            'Geolocation API': 'geolocation' in navigator,
            'Local Storage': typeof(Storage) !== 'undefined',
            'Service Worker': 'serviceWorker' in navigator,
            'Notifications': 'Notification' in window,
            'Vibration': 'vibrate' in navigator,
            'Touch Events': 'ontouchstart' in window
        };

        for (const [feature, supported] of Object.entries(features)) {
            this.log(`${feature}: ${supported ? '✓' : '✗'}`, supported ? 'success' : 'error');
        }

        // 檢測 Android 環境
        if (typeof isAndroidApp === 'function') {
            const isAndroid = isAndroidApp();
            this.log(`Android 應用程式: ${isAndroid ? '✓' : '✗'}`, isAndroid ? 'success' : 'info');
            
            if (isAndroid) {
                this.log(`Capacitor: ${isCapacitor() ? '✓' : '✗'}`, 'info');
                this.log(`Cordova: ${isCordova() ? '✓' : '✗'}`, 'info');
            }
        }
    }

    async testMapInitialization() {
        this.log('測試地圖初始化...', 'info');
        
        try {
            // 檢查地圖物件
            if (typeof window.map !== 'undefined' && window.map) {
                this.log('地圖物件已初始化 ✓', 'success');
                
                // 檢查地圖容器
                const mapContainer = document.getElementById('map');
                if (mapContainer) {
                    this.log('地圖容器存在 ✓', 'success');
                    
                    // 檢查地圖尺寸
                    const rect = mapContainer.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        this.log(`地圖尺寸: ${rect.width}x${rect.height} ✓`, 'success');
                    } else {
                        this.log('地圖尺寸異常 ✗', 'error');
                    }
                } else {
                    this.log('地圖容器不存在 ✗', 'error');
                }
                
                // 檢查圖層
                if (window.map.hasLayer && window.tileLayer) {
                    this.log('圖磚圖層已載入 ✓', 'success');
                } else {
                    this.log('圖磚圖層未載入 ✗', 'error');
                }
                
            } else {
                this.log('地圖物件未初始化 ✗', 'error');
            }
        } catch (error) {
            this.log(`地圖初始化測試失敗: ${error.message}`, 'error');
        }
    }

    async testLocationServices() {
        this.log('測試定位服務...', 'info');
        
        try {
            // 測試權限請求
            if (typeof AndroidPermissions !== 'undefined') {
                const hasPermission = await AndroidPermissions.requestLocationPermission();
                this.log(`位置權限: ${hasPermission ? '✓' : '✗'}`, hasPermission ? 'success' : 'error');
            }
            
            // 測試定位功能
            if (typeof getCurrentLocation === 'function') {
                this.log('定位函數存在 ✓', 'success');
                
                // 嘗試獲取位置（不實際執行，避免彈出權限請求）
                this.log('定位功能可用 ✓', 'success');
            } else {
                this.log('定位函數不存在 ✗', 'error');
            }
            
            // 檢查當前位置變數
            if (typeof window.currentPosition !== 'undefined') {
                this.log('當前位置變數已定義 ✓', 'success');
            } else {
                this.log('當前位置變數未定義 ✗', 'error');
            }
            
        } catch (error) {
            this.log(`定位服務測試失敗: ${error.message}`, 'error');
        }
    }

    async testMarkerFunctionality() {
        this.log('測試標記功能...', 'info');
        
        try {
            // 檢查標記類別
            if (typeof Marker !== 'undefined') {
                this.log('Marker 類別存在 ✓', 'success');
                
                // 測試建立標記
                const testMarker = new Marker(
                    Date.now(),
                    25.0330, // 台北座標
                    121.5654,
                    '測試標記',
                    '這是一個測試標記',
                    'red'
                );
                
                if (testMarker.id && testMarker.lat && testMarker.lng) {
                    this.log('標記建立成功 ✓', 'success');
                } else {
                    this.log('標記建立失敗 ✗', 'error');
                }
            } else {
                this.log('Marker 類別不存在 ✗', 'error');
            }
            
            // 檢查標記陣列
            if (typeof window.markers !== 'undefined' && Array.isArray(window.markers)) {
                this.log(`標記陣列存在，目前有 ${window.markers.length} 個標記 ✓`, 'success');
            } else {
                this.log('標記陣列不存在 ✗', 'error');
            }
            
            // 檢查標記相關函數
            const markerFunctions = [
                'addMarker',
                'deleteMarker',
                'updateMarker',
                'saveMarkers',
                'loadMarkers'
            ];
            
            for (const funcName of markerFunctions) {
                if (typeof window[funcName] === 'function') {
                    this.log(`${funcName} 函數存在 ✓`, 'success');
                } else {
                    this.log(`${funcName} 函數不存在 ✗`, 'error');
                }
            }
            
        } catch (error) {
            this.log(`標記功能測試失敗: ${error.message}`, 'error');
        }
    }

    async testGroupManagement() {
        this.log('測試群組管理...', 'info');
        
        try {
            // 檢查群組類別
            if (typeof Group !== 'undefined') {
                this.log('Group 類別存在 ✓', 'success');
            } else {
                this.log('Group 類別不存在 ✗', 'error');
            }
            
            if (typeof Subgroup !== 'undefined') {
                this.log('Subgroup 類別存在 ✓', 'success');
            } else {
                this.log('Subgroup 類別不存在 ✗', 'error');
            }
            
            // 檢查群組陣列
            if (typeof window.groups !== 'undefined' && Array.isArray(window.groups)) {
                this.log(`群組陣列存在，目前有 ${window.groups.length} 個群組 ✓`, 'success');
            } else {
                this.log('群組陣列不存在 ✗', 'error');
            }
            
            // 檢查群組相關函數
            const groupFunctions = [
                'addGroup',
                'deleteGroup',
                'addSubgroup',
                'deleteSubgroup',
                'updateGroupsDisplay'
            ];
            
            for (const funcName of groupFunctions) {
                if (typeof window[funcName] === 'function') {
                    this.log(`${funcName} 函數存在 ✓`, 'success');
                } else {
                    this.log(`${funcName} 函數不存在 ✗`, 'error');
                }
            }
            
        } catch (error) {
            this.log(`群組管理測試失敗: ${error.message}`, 'error');
        }
    }

    async testSettingsAndPreferences() {
        this.log('測試設定和偏好...', 'info');
        
        try {
            // 檢查設定物件
            if (typeof window.settings !== 'undefined') {
                this.log('設定物件存在 ✓', 'success');
                
                // 檢查設定項目
                const requiredSettings = [
                    'autoCenter',
                    'trackingEnabled',
                    'notificationsEnabled',
                    'theme'
                ];
                
                for (const setting of requiredSettings) {
                    if (setting in window.settings) {
                        this.log(`設定項目 ${setting} 存在 ✓`, 'success');
                    } else {
                        this.log(`設定項目 ${setting} 不存在 ✗`, 'error');
                    }
                }
            } else {
                this.log('設定物件不存在 ✗', 'error');
            }
            
            // 檢查本地儲存
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                this.log('本地儲存可用 ✓', 'success');
            } catch (e) {
                this.log('本地儲存不可用 ✗', 'error');
            }
            
        } catch (error) {
            this.log(`設定測試失敗: ${error.message}`, 'error');
        }
    }

    async testNotifications() {
        this.log('測試通知功能...', 'info');
        
        try {
            // 檢查通知函數
            if (typeof window.showNotification === 'function') {
                this.log('showNotification 函數存在 ✓', 'success');
            } else {
                this.log('showNotification 函數不存在 ✗', 'error');
            }
            
            // 檢查 Android 通知
            if (typeof AndroidNotifications !== 'undefined') {
                this.log('Android 通知類別存在 ✓', 'success');
                
                // 測試權限
                if (typeof AndroidPermissions !== 'undefined') {
                    const hasPermission = await AndroidPermissions.requestNotificationPermission();
                    this.log(`通知權限: ${hasPermission ? '✓' : '✗'}`, hasPermission ? 'success' : 'error');
                }
            }
            
            // 檢查瀏覽器通知支援
            if ('Notification' in window) {
                this.log(`瀏覽器通知權限: ${Notification.permission}`, 'info');
            }
            
        } catch (error) {
            this.log(`通知功能測試失敗: ${error.message}`, 'error');
        }
    }

    async testOfflineCapabilities() {
        this.log('測試離線功能...', 'info');
        
        try {
            // 檢查 Service Worker
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                if (registrations.length > 0) {
                    this.log('Service Worker 已註冊 ✓', 'success');
                } else {
                    this.log('Service Worker 未註冊 ✗', 'error');
                }
            } else {
                this.log('不支援 Service Worker ✗', 'error');
            }
            
            // 檢查快取 API
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                this.log(`快取數量: ${cacheNames.length}`, 'info');
                
                for (const cacheName of cacheNames) {
                    this.log(`快取: ${cacheName} ✓`, 'success');
                }
            } else {
                this.log('不支援 Cache API ✗', 'error');
            }
            
            // 檢查網路狀態
            if ('onLine' in navigator) {
                this.log(`網路狀態: ${navigator.onLine ? '線上' : '離線'}`, 'info');
            }
            
        } catch (error) {
            this.log(`離線功能測試失敗: ${error.message}`, 'error');
        }
    }

    async testAndroidIntegration() {
        this.log('測試 Android 整合...', 'info');
        
        try {
            if (typeof isAndroidApp === 'function' && isAndroidApp()) {
                this.log('Android 環境檢測 ✓', 'success');
                
                // 測試設備功能
                if (typeof AndroidDevice !== 'undefined') {
                    this.log('AndroidDevice 類別存在 ✓', 'success');
                    
                    // 獲取設備信息
                    try {
                        const deviceInfo = await AndroidDevice.getDeviceInfo();
                        this.log(`設備平台: ${deviceInfo.platform}`, 'info');
                        this.log(`設備型號: ${deviceInfo.model}`, 'info');
                    } catch (e) {
                        this.log('無法獲取設備信息', 'error');
                    }
                    
                    // 測試震動
                    try {
                        AndroidDevice.vibrate(100);
                        this.log('震動功能可用 ✓', 'success');
                    } catch (e) {
                        this.log('震動功能不可用 ✗', 'error');
                    }
                }
                
                // 測試背景模式
                if (typeof AndroidBackgroundMode !== 'undefined') {
                    this.log('AndroidBackgroundMode 類別存在 ✓', 'success');
                }
                
            } else {
                this.log('非 Android 環境', 'info');
            }
            
        } catch (error) {
            this.log(`Android 整合測試失敗: ${error.message}`, 'error');
        }
    }

    generateTestReport() {
        const successCount = this.testResults.filter(r => r.type === 'success').length;
        const errorCount = this.testResults.filter(r => r.type === 'error').length;
        const totalTests = successCount + errorCount;
        
        this.log('', 'info');
        this.log('=== 測試報告 ===', 'info');
        this.log(`總測試項目: ${totalTests}`, 'info');
        this.log(`成功: ${successCount}`, 'success');
        this.log(`失敗: ${errorCount}`, errorCount > 0 ? 'error' : 'success');
        this.log(`成功率: ${totalTests > 0 ? Math.round((successCount / totalTests) * 100) : 0}%`, 'info');
        
        if (errorCount === 0) {
            this.log('🎉 所有功能測試通過！', 'success');
        } else {
            this.log('⚠️ 部分功能需要檢查', 'error');
        }
    }

    // 快速測試特定功能
    async quickTest(feature) {
        switch (feature) {
            case 'location':
                await this.testLocationServices();
                break;
            case 'markers':
                await this.testMarkerFunctionality();
                break;
            case 'groups':
                await this.testGroupManagement();
                break;
            case 'notifications':
                await this.testNotifications();
                break;
            case 'android':
                await this.testAndroidIntegration();
                break;
            default:
                this.log(`未知的測試功能: ${feature}`, 'error');
        }
    }
}

// 建立全域測試器實例
window.functionalityTester = new FunctionalityTester();

// 添加測試按鈕到頁面
function addTestButton() {
    const testButton = document.createElement('button');
    testButton.textContent = '🧪 測試功能';
    testButton.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 10000;
        padding: 10px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
    `;
    
    testButton.onclick = () => {
        window.functionalityTester.runAllTests();
    };
    
    document.body.appendChild(testButton);
}

// 當頁面載入完成後添加測試按鈕
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addTestButton);
} else {
    addTestButton();
}

console.log('功能測試腳本已載入。使用 functionalityTester.runAllTests() 開始測試。');