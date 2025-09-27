// 簡化版功能說明系統 - 專為Android優化
console.log('🎯 簡化版功能說明系統啟動');

// 功能說明內容
const FEATURE_CONTENT = `
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 15px; margin: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
    <h2 style="text-align: center; margin: 0 0 20px 0; font-size: 24px;">🎯 地圖標註系統功能說明</h2>
    
    <div style="display: grid; gap: 15px;">
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;">
            <h3 style="margin: 0 0 10px 0; color: #ffd700;">📍 標註點管理</h3>
            <p style="margin: 5px 0; font-size: 14px;">🎯 新增標註點：點擊地圖任意位置即可新增標註點</p>
            <p style="margin: 5px 0; font-size: 14px;">✏️ 編輯標註點：點擊標註點可進行編輯、移動或刪除</p>
            <p style="margin: 5px 0; font-size: 14px;">🔍 搜尋標註點：使用搜尋功能快速找到特定標註點</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;">
            <h3 style="margin: 0 0 10px 0; color: #90ee90;">👥 組別與群組管理</h3>
            <p style="margin: 5px 0; font-size: 14px;">📁 建立群組：將相關的標註點組織成群組</p>
            <p style="margin: 5px 0; font-size: 14px;">🎨 自定義顏色：為不同群組設定不同顏色</p>
            <p style="margin: 5px 0; font-size: 14px;">👁️ 顯示/隱藏：可選擇性顯示或隱藏特定群組</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;">
            <h3 style="margin: 0 0 10px 0; color: #ffa500;">⏰ 智能提醒系統</h3>
            <p style="margin: 5px 0; font-size: 14px;">📍 位置提醒：當接近特定標註點時自動提醒</p>
            <p style="margin: 5px 0; font-size: 14px;">⏰ 時間提醒：設定特定時間的提醒通知</p>
            <p style="margin: 5px 0; font-size: 14px;">🔔 自定義提醒：根據需求設定個人化提醒條件</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;">
            <h3 style="margin: 0 0 10px 0; color: #ff6b6b;">💾 資料管理</h3>
            <p style="margin: 5px 0; font-size: 14px;">📤 匯出資料：將標註點資料匯出為JSON格式</p>
            <p style="margin: 5px 0; font-size: 14px;">📥 匯入資料：從檔案匯入之前儲存的標註點資料</p>
            <p style="margin: 5px 0; font-size: 14px;">🔄 同步備份：自動備份資料，確保資料安全</p>
        </div>
    </div>
    
    <div style="text-align: center; margin-top: 20px;">
        <button onclick="hideSimpleFeatureGuide()" style="background: #ff4757; color: white; border: none; padding: 12px 24px; border-radius: 25px; font-size: 16px; cursor: pointer; box-shadow: 0 4px 15px rgba(255,71,87,0.4);">
            ✖️ 關閉說明
        </button>
    </div>
</div>
`;

// 顯示功能說明
function showSimpleFeatureGuide() {
    console.log('顯示簡化版功能說明');
    
    // 移除現有的模態視窗
    const existing = document.getElementById('simple-feature-modal');
    if (existing) existing.remove();
    
    // 創建模態視窗
    const modal = document.createElement('div');
    modal.id = 'simple-feature-modal';
    modal.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background-color: rgba(0, 0, 0, 0.9) !important;
        z-index: 2000000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 10px !important;
        box-sizing: border-box !important;
        overflow-y: auto !important;
    `;
    
    modal.innerHTML = FEATURE_CONTENT;
    
    // 點擊背景關閉
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            hideSimpleFeatureGuide();
        }
    });
    
    document.body.appendChild(modal);
}

// 隱藏功能說明
function hideSimpleFeatureGuide() {
    console.log('隱藏簡化版功能說明');
    const modal = document.getElementById('simple-feature-modal');
    if (modal) {
        modal.remove();
    }
}

// 暴露到全域
window.showSimpleFeatureGuide = showSimpleFeatureGuide;
window.hideSimpleFeatureGuide = hideSimpleFeatureGuide;

console.log('✅ 簡化版功能說明系統已加載');