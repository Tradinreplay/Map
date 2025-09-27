// 移動設備調試腳本
console.log('=== 移動設備調試開始 ===');

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        console.log('=== 檢查功能說明面板元素 ===');
        
        // 檢查主要元素
        const featureGuidePanel = document.getElementById('featureGuidePanel');
        const toggleBtn = document.getElementById('toggleFeatureGuide');
        const featureContent = document.getElementById('featureGuideContent');
        const settingGroup = featureGuidePanel ? featureGuidePanel.closest('.setting-group') : null;
        
        console.log('featureGuidePanel:', featureGuidePanel);
        console.log('toggleBtn:', toggleBtn);
        console.log('featureContent:', featureContent);
        console.log('settingGroup:', settingGroup);
        
        if (featureGuidePanel) {
            const computedStyle = window.getComputedStyle(featureGuidePanel);
            console.log('featureGuidePanel display:', computedStyle.display);
            console.log('featureGuidePanel visibility:', computedStyle.visibility);
            console.log('featureGuidePanel opacity:', computedStyle.opacity);
            console.log('featureGuidePanel height:', computedStyle.height);
            console.log('featureGuidePanel position:', computedStyle.position);
        }
        
        if (settingGroup) {
            const computedStyle = window.getComputedStyle(settingGroup);
            console.log('settingGroup display:', computedStyle.display);
            console.log('settingGroup visibility:', computedStyle.visibility);
            console.log('settingGroup opacity:', computedStyle.opacity);
            console.log('settingGroup height:', computedStyle.height);
        }
        
        // 檢查浮動設定視窗
        const floatingModal = document.getElementById('floatingSettingsModal');
        const floatingBody = floatingModal ? floatingModal.querySelector('.floating-settings-body') : null;
        
        console.log('floatingModal:', floatingModal);
        console.log('floatingBody:', floatingBody);
        
        // 檢查視窗大小
        console.log('window.innerWidth:', window.innerWidth);
        console.log('window.innerHeight:', window.innerHeight);
        console.log('screen.width:', screen.width);
        console.log('screen.height:', screen.height);
        
        // 檢查媒體查詢
        const mediaQuery768 = window.matchMedia('(max-width: 768px)');
        const mediaQuery480 = window.matchMedia('(max-width: 480px)');
        console.log('媒體查詢 768px:', mediaQuery768.matches);
        console.log('媒體查詢 480px:', mediaQuery480.matches);
        
        console.log('=== 移動設備調試結束 ===');
    }, 1000);
});