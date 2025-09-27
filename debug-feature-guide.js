// 功能說明頁面調試腳本
console.log('=== 功能說明頁面調試開始 ===');

function debugFeatureGuide() {
    console.log('1. 檢查DOM元素...');
    
    const featureGuidePanel = document.getElementById('featureGuidePanel');
    const toggleGuideBtn = document.getElementById('toggleFeatureGuide');
    const featureGuideContent = document.getElementById('featureGuideContent');
    const toggleIcon = document.getElementById('guideToggleIcon');
    
    console.log('featureGuidePanel:', featureGuidePanel);
    console.log('toggleGuideBtn:', toggleGuideBtn);
    console.log('featureGuideContent:', featureGuideContent);
    console.log('toggleIcon:', toggleIcon);
    
    if (featureGuideContent) {
        console.log('2. 檢查CSS樣式...');
        const computedStyle = window.getComputedStyle(featureGuideContent);
        console.log('display:', computedStyle.display);
        console.log('visibility:', computedStyle.visibility);
        console.log('opacity:', computedStyle.opacity);
        console.log('height:', computedStyle.height);
        console.log('overflow:', computedStyle.overflow);
    }
    
    console.log('3. 檢查JavaScript變數...');
    console.log('isFeatureGuideCollapsed:', window.isFeatureGuideCollapsed);
    
    console.log('4. 檢查事件監聽器...');
    if (toggleGuideBtn) {
        console.log('toggleGuideBtn有事件監聽器:', toggleGuideBtn.onclick !== null);
    }
    
    console.log('5. 測試點擊功能...');
    if (typeof window.toggleFeatureGuide === 'function') {
        console.log('toggleFeatureGuide函數存在');
        // 測試展開
        window.toggleFeatureGuide();
        console.log('展開後 - isFeatureGuideCollapsed:', window.isFeatureGuideCollapsed);
        if (featureGuideContent) {
            console.log('展開後 - display:', featureGuideContent.style.display);
        }
        
        // 測試收合
        window.toggleFeatureGuide();
        console.log('收合後 - isFeatureGuideCollapsed:', window.isFeatureGuideCollapsed);
        if (featureGuideContent) {
            console.log('收合後 - display:', featureGuideContent.style.display);
        }
    } else {
        console.log('toggleFeatureGuide函數不存在');
    }
}

// 等待DOM載入完成後執行調試
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(debugFeatureGuide, 1000);
    });
} else {
    setTimeout(debugFeatureGuide, 1000);
}

console.log('=== 功能說明頁面調試腳本載入完成 ===');