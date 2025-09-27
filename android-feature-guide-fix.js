// Android環境功能說明面板修復腳本
console.log('=== Android功能說明面板修復腳本開始 ===');

// 功能說明面板的HTML內容
const featureGuideHTML = `
<div class="setting-group android-feature-guide-fix" style="display: block !important; visibility: visible !important; opacity: 1 !important;">
    <div id="featureGuidePanel" class="feature-guide-panel" style="display: block !important; visibility: visible !important; opacity: 1 !important; background: #f8f9fa; border: 2px solid #007bff; border-radius: 8px; padding: 15px; margin: 10px 0;">
        <div class="feature-guide-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #007bff; color: white; padding: 10px; border-radius: 5px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: bold;">🎯 功能說明</h3>
            <button id="toggleGuideBtn" class="toggle-guide-btn" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                <span id="toggleGuideIcon">📖</span>
            </button>
        </div>
        
        <div id="featureGuideContent" class="feature-guide-content" style="display: block !important; visibility: visible !important; opacity: 1 !important;">
            <div class="feature-categories" style="display: block !important;">
                
                <!-- 標註點管理 -->
                <div class="feature-category" style="margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 5px; overflow: hidden;">
                    <div class="category-header" style="background: #e9ecef; padding: 10px; border-bottom: 1px solid #dee2e6;">
                        <h4 style="margin: 0; color: #495057; font-size: 16px;">📍 標註點管理</h4>
                    </div>
                    <div class="category-content" style="padding: 10px;">
                        <div class="feature-info" style="margin-bottom: 10px;">
                            <h5 style="margin: 0 0 5px 0; color: #007bff; font-size: 14px;">🎯 新增標註點</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">點擊地圖任意位置即可新增標註點，支援自定義名稱和描述</p>
                        </div>
                        <div class="feature-info" style="margin-bottom: 10px;">
                            <h5 style="margin: 0 0 5px 0; color: #007bff; font-size: 14px;">✏️ 編輯標註點</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">點擊標註點可進行編輯、移動或刪除操作</p>
                        </div>
                        <div class="feature-info">
                            <h5 style="margin: 0 0 5px 0; color: #007bff; font-size: 14px;">🔍 搜尋標註點</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">使用搜尋功能快速找到特定的標註點</p>
                        </div>
                    </div>
                </div>

                <!-- 組別與群組管理 -->
                <div class="feature-category" style="margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 5px; overflow: hidden;">
                    <div class="category-header" style="background: #e9ecef; padding: 10px; border-bottom: 1px solid #dee2e6;">
                        <h4 style="margin: 0; color: #495057; font-size: 16px;">👥 組別與群組管理</h4>
                    </div>
                    <div class="category-content" style="padding: 10px;">
                        <div class="feature-info" style="margin-bottom: 10px;">
                            <h5 style="margin: 0 0 5px 0; color: #28a745; font-size: 14px;">📁 建立群組</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">將相關的標註點組織成群組，便於管理</p>
                        </div>
                        <div class="feature-info" style="margin-bottom: 10px;">
                            <h5 style="margin: 0 0 5px 0; color: #28a745; font-size: 14px;">🎨 自定義顏色</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">為不同群組設定不同顏色，視覺化管理</p>
                        </div>
                        <div class="feature-info">
                            <h5 style="margin: 0 0 5px 0; color: #28a745; font-size: 14px;">👁️ 顯示/隱藏</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">可選擇性顯示或隱藏特定群組的標註點</p>
                        </div>
                    </div>
                </div>

                <!-- 智能提醒系統 -->
                <div class="feature-category" style="margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 5px; overflow: hidden;">
                    <div class="category-header" style="background: #e9ecef; padding: 10px; border-bottom: 1px solid #dee2e6;">
                        <h4 style="margin: 0; color: #495057; font-size: 16px;">⏰ 智能提醒系統</h4>
                    </div>
                    <div class="category-content" style="padding: 10px;">
                        <div class="feature-info" style="margin-bottom: 10px;">
                            <h5 style="margin: 0 0 5px 0; color: #ffc107; font-size: 14px;">📍 位置提醒</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">當接近特定標註點時自動提醒</p>
                        </div>
                        <div class="feature-info" style="margin-bottom: 10px;">
                            <h5 style="margin: 0 0 5px 0; color: #ffc107; font-size: 14px;">⏰ 時間提醒</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">設定特定時間的提醒通知</p>
                        </div>
                        <div class="feature-info">
                            <h5 style="margin: 0 0 5px 0; color: #ffc107; font-size: 14px;">🔔 自定義提醒</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">根據需求設定個人化提醒條件</p>
                        </div>
                    </div>
                </div>

                <!-- 資料管理 -->
                <div class="feature-category" style="margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 5px; overflow: hidden;">
                    <div class="category-header" style="background: #e9ecef; padding: 10px; border-bottom: 1px solid #dee2e6;">
                        <h4 style="margin: 0; color: #495057; font-size: 16px;">💾 資料管理</h4>
                    </div>
                    <div class="category-content" style="padding: 10px;">
                        <div class="feature-info" style="margin-bottom: 10px;">
                            <h5 style="margin: 0 0 5px 0; color: #dc3545; font-size: 14px;">📤 匯出資料</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">將標註點資料匯出為JSON或其他格式</p>
                        </div>
                        <div class="feature-info" style="margin-bottom: 10px;">
                            <h5 style="margin: 0 0 5px 0; color: #dc3545; font-size: 14px;">📥 匯入資料</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">從檔案匯入之前儲存的標註點資料</p>
                        </div>
                        <div class="feature-info">
                            <h5 style="margin: 0 0 5px 0; color: #dc3545; font-size: 14px;">🔄 同步備份</h5>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">自動備份資料，確保資料安全</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
</div>
`;

// 修復功能說明面板的主函數
function fixFeatureGuideForAndroid() {
    console.log('開始修復Android環境下的功能說明面板...');
    
    // 檢查是否為Capacitor環境
    const isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
    console.log('是否為Capacitor環境:', isCapacitor);
    
    if (!isCapacitor) {
        console.log('非Capacitor環境，跳過修復');
        return;
    }
    
    // 等待DOM完全加載
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixFeatureGuideForAndroid);
        return;
    }
    
    // 等待一段時間確保所有初始化完成
    setTimeout(() => {
        const floatingSettingsBody = document.querySelector('.floating-settings-body');
        const existingFeatureGuide = document.getElementById('featureGuidePanel');
        
        console.log('浮動設定視窗:', floatingSettingsBody);
        console.log('現有功能說明面板:', existingFeatureGuide);
        
        if (floatingSettingsBody) {
            // 如果現有的功能說明面板不可見，則插入新的
            if (!existingFeatureGuide || !isElementVisible(existingFeatureGuide)) {
                console.log('插入新的功能說明面板...');
                
                // 創建臨時容器
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = featureGuideHTML;
                const newFeatureGuide = tempDiv.firstElementChild;
                
                // 插入到浮動設定視窗的開頭
                floatingSettingsBody.insertBefore(newFeatureGuide, floatingSettingsBody.firstChild);
                
                // 綁定切換功能
                const toggleBtn = document.getElementById('toggleGuideBtn');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', function() {
                        const content = document.getElementById('featureGuideContent');
                        const icon = document.getElementById('toggleGuideIcon');
                        
                        if (content && icon) {
                            if (content.style.display === 'none') {
                                content.style.display = 'block';
                                icon.textContent = '📖';
                            } else {
                                content.style.display = 'none';
                                icon.textContent = '📕';
                            }
                        }
                    });
                }
                
                console.log('✅ 功能說明面板修復完成');
                
                // 添加醒目的提示
                setTimeout(() => {
                    const panel = document.getElementById('featureGuidePanel');
                    if (panel) {
                        panel.style.animation = 'pulse 2s infinite';
                        panel.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.5)';
                        
                        // 添加CSS動畫
                        const style = document.createElement('style');
                        style.textContent = `
                            @keyframes pulse {
                                0% { transform: scale(1); }
                                50% { transform: scale(1.02); }
                                100% { transform: scale(1); }
                            }
                        `;
                        document.head.appendChild(style);
                        
                        // 3秒後移除動畫
                        setTimeout(() => {
                            panel.style.animation = '';
                            panel.style.boxShadow = '';
                        }, 3000);
                    }
                }, 500);
                
            } else {
                console.log('現有功能說明面板可見，無需修復');
            }
        } else {
            console.error('找不到浮動設定視窗');
        }
    }, 2000);
}

// 檢查元素是否可見
function isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           rect.width > 0 && 
           rect.height > 0;
}

// 立即執行修復
fixFeatureGuideForAndroid();

// 也在設定視窗打開時執行修復
document.addEventListener('click', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('floating-settings-btn')) {
        setTimeout(fixFeatureGuideForAndroid, 500);
    }
});

console.log('Android功能說明面板修復腳本已加載');