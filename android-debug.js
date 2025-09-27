// Android Capacitor環境調試腳本
console.log('=== Android Capacitor 環境調試開始 ===');

// 檢測Capacitor環境
function detectCapacitorEnvironment() {
    console.log('User Agent:', navigator.userAgent);
    console.log('是否為Capacitor環境:', window.Capacitor ? 'Yes' : 'No');
    console.log('平台:', window.Capacitor ? window.Capacitor.getPlatform() : 'Unknown');
    
    if (window.Capacitor) {
        console.log('Capacitor版本:', window.Capacitor.version || 'Unknown');
        console.log('原生平台:', window.Capacitor.isNativePlatform());
    }
}

// 強制顯示功能說明面板的函數
function forceShowFeatureGuide() {
    console.log('=== 強制顯示功能說明面板 ===');
    
    const featureGuidePanel = document.getElementById('featureGuidePanel');
    const settingGroup = featureGuidePanel ? featureGuidePanel.closest('.setting-group') : null;
    const floatingSettingsBody = document.querySelector('.floating-settings-body');
    
    console.log('featureGuidePanel元素:', featureGuidePanel);
    console.log('settingGroup元素:', settingGroup);
    console.log('floatingSettingsBody元素:', floatingSettingsBody);
    
    if (featureGuidePanel) {
        // 移除所有可能隱藏的樣式
        featureGuidePanel.style.cssText = `
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: relative !important;
            z-index: 999 !important;
            width: 100% !important;
            min-height: 80px !important;
            background: #ffffff !important;
            border: 4px solid #ff0000 !important;
            margin: 20px 0 !important;
            padding: 10px !important;
            box-sizing: border-box !important;
        `;
        
        // 確保父容器也顯示
        if (settingGroup) {
            settingGroup.style.cssText = `
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: 100% !important;
            `;
        }
        
        // 確保浮動設定視窗有足夠空間
        if (floatingSettingsBody) {
            floatingSettingsBody.style.cssText += `
                max-height: 90vh !important;
                overflow-y: auto !important;
            `;
        }
        
        console.log('已應用強制顯示樣式');
        
        // 檢查應用後的計算樣式
        const computedStyle = window.getComputedStyle(featureGuidePanel);
        console.log('應用後的計算樣式:');
        console.log('- display:', computedStyle.display);
        console.log('- visibility:', computedStyle.visibility);
        console.log('- opacity:', computedStyle.opacity);
        console.log('- position:', computedStyle.position);
        console.log('- z-index:', computedStyle.zIndex);
        console.log('- width:', computedStyle.width);
        console.log('- height:', computedStyle.height);
        console.log('- border:', computedStyle.border);
        
    } else {
        console.error('找不到featureGuidePanel元素！');
    }
}

// 檢查CSS文件是否正確加載
function checkCSSLoading() {
    console.log('=== 檢查CSS文件加載狀態 ===');
    
    const styleSheets = document.styleSheets;
    console.log('已加載的樣式表數量:', styleSheets.length);
    
    for (let i = 0; i < styleSheets.length; i++) {
        const sheet = styleSheets[i];
        console.log(`樣式表 ${i + 1}:`, sheet.href || '內聯樣式');
        
        if (sheet.href && sheet.href.includes('feature-guide-styles.css')) {
            console.log('✓ feature-guide-styles.css 已加載');
            
            try {
                const rules = sheet.cssRules || sheet.rules;
                console.log('CSS規則數量:', rules ? rules.length : '無法訪問');
            } catch (e) {
                console.log('無法訪問CSS規則:', e.message);
            }
        }
    }
}

// 添加紅色邊框測試函數
function addRedBorderTest() {
    console.log('=== 添加紅色邊框測試 ===');
    
    // 為所有可能相關的元素添加紅色邊框
    const selectors = [
        '#featureGuidePanel',
        '.feature-guide-panel',
        '.setting-group',
        '.floating-settings-body',
        '.floating-settings-content'
    ];
    
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`${selector}: 找到 ${elements.length} 個元素`);
        
        elements.forEach((element, index) => {
            element.style.border = '3px solid red';
            element.style.background = 'yellow';
            element.style.minHeight = '50px';
            console.log(`已為 ${selector}[${index}] 添加紅色邊框`);
        });
    });
}

// 主要調試函數
function runAndroidDebug() {
    console.log('=== 開始Android環境調試 ===');
    
    // 等待DOM完全加載
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAndroidDebug);
        return;
    }
    
    detectCapacitorEnvironment();
    checkCSSLoading();
    
    // 延遲執行強制顯示，確保所有初始化完成
    setTimeout(() => {
        forceShowFeatureGuide();
        addRedBorderTest();
        
        // 再次延遲檢查
        setTimeout(() => {
            console.log('=== 最終檢查 ===');
            const panel = document.getElementById('featureGuidePanel');
            if (panel) {
                const rect = panel.getBoundingClientRect();
                console.log('面板位置和大小:', {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    visible: rect.width > 0 && rect.height > 0
                });
            }
        }, 2000);
        
    }, 1000);
}

// 立即執行調試
runAndroidDebug();

// 將調試函數暴露到全域
window.runAndroidDebug = runAndroidDebug;
window.forceShowFeatureGuide = forceShowFeatureGuide;

console.log('Android調試腳本已加載');