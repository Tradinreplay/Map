// 獨立功能說明系統
console.log('=== 獨立功能說明系統啟動 ===');

// 功能說明內容
const featureGuideData = {
    title: "🎯 地圖標註系統功能說明",
    categories: [
        {
            icon: "📍",
            title: "標註點管理",
            color: "#007bff",
            features: [
                { icon: "🎯", title: "新增標註點", desc: "點擊地圖任意位置即可新增標註點，支援自定義名稱和描述" },
                { icon: "✏️", title: "編輯標註點", desc: "點擊標註點可進行編輯、移動或刪除操作" },
                { icon: "🔍", title: "搜尋標註點", desc: "使用搜尋功能快速找到特定的標註點" }
            ]
        },
        {
            icon: "👥",
            title: "組別與群組管理",
            color: "#28a745",
            features: [
                { icon: "📁", title: "建立群組", desc: "將相關的標註點組織成群組，便於管理" },
                { icon: "🎨", title: "自定義顏色", desc: "為不同群組設定不同顏色，視覺化管理" },
                { icon: "👁️", title: "顯示/隱藏", desc: "可選擇性顯示或隱藏特定群組的標註點" }
            ]
        },
        {
            icon: "⏰",
            title: "智能提醒系統",
            color: "#ffc107",
            features: [
                { icon: "📍", title: "位置提醒", desc: "當接近特定標註點時自動提醒" },
                { icon: "⏰", title: "時間提醒", desc: "設定特定時間的提醒通知" },
                { icon: "🔔", title: "自定義提醒", desc: "根據需求設定個人化提醒條件" }
            ]
        },
        {
            icon: "💾",
            title: "資料管理",
            color: "#dc3545",
            features: [
                { icon: "📤", title: "匯出資料", desc: "將標註點資料匯出為JSON或其他格式" },
                { icon: "📥", title: "匯入資料", desc: "從檔案匯入之前儲存的標註點資料" },
                { icon: "🔄", title: "同步備份", desc: "自動備份資料，確保資料安全" }
            ]
        }
    ]
};

// 創建功能說明按鈕
function createFeatureGuideButton() {
    const button = document.createElement('div');
    button.id = 'standalone-feature-guide-btn';
    button.innerHTML = '🎯<br>說明';
    
    // 從localStorage讀取保存的位置
    const savedPosition = localStorage.getItem('featureGuideButtonPosition');
    let buttonPosition = { top: 120, right: 20 };
    
    if (savedPosition) {
        try {
            buttonPosition = JSON.parse(savedPosition);
        } catch (e) {
            console.log('無法解析保存的按鈕位置，使用預設位置');
        }
    }
    
    // 按鈕樣式
    Object.assign(button.style, {
        position: 'fixed',
        top: buttonPosition.top + 'px',
        right: buttonPosition.right + 'px',
        width: '60px',
        height: '60px',
        backgroundColor: '#007bff',
        color: 'white',
        borderRadius: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'move',
        zIndex: '999999', // 提高z-index確保在全螢幕狀態下也能顯示
        boxShadow: '0 4px 12px rgba(0, 123, 255, 0.4)',
        border: '3px solid white',
        textAlign: 'center',
        lineHeight: '1.2',
        transition: 'all 0.3s ease',
        userSelect: 'none',
        touchAction: 'none' // 防止觸控滾動干擾拖拽
    });
    
    // 拖拽相關變數
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let buttonStartX = 0;
    let buttonStartY = 0;
    let clickStartTime = 0;
    let hasMoved = false;
    
    // 滑鼠/觸控事件處理
    function handleStart(e) {
        isDragging = true;
        hasMoved = false;
        clickStartTime = Date.now();
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        dragStartX = clientX;
        dragStartY = clientY;
        
        const rect = button.getBoundingClientRect();
        buttonStartX = rect.left;
        buttonStartY = rect.top;
        
        button.style.transition = 'none';
        button.style.transform = 'scale(1.1)';
        button.style.backgroundColor = '#0056b3';
        
        e.preventDefault();
    }
    
    function handleMove(e) {
        if (!isDragging) return;
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;
        
        // 如果移動距離超過5px，標記為已移動
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            hasMoved = true;
        }
        
        const newX = buttonStartX + deltaX;
        const newY = buttonStartY + deltaY;
        
        // 限制按鈕在螢幕範圍內
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;
        
        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));
        
        button.style.left = constrainedX + 'px';
        button.style.top = constrainedY + 'px';
        button.style.right = 'auto';
        
        e.preventDefault();
    }
    
    function handleEnd(e) {
        if (!isDragging) return;
        
        isDragging = false;
        button.style.transition = 'all 0.3s ease';
        button.style.transform = 'scale(1)';
        button.style.backgroundColor = '#007bff';
        
        // 保存新位置到localStorage
        const rect = button.getBoundingClientRect();
        const newPosition = {
            top: rect.top,
            right: window.innerWidth - rect.right
        };
        localStorage.setItem('featureGuideButtonPosition', JSON.stringify(newPosition));
        
        // 如果沒有移動且點擊時間短，則視為點擊事件
        const clickDuration = Date.now() - clickStartTime;
        if (!hasMoved && clickDuration < 300) {
            setTimeout(() => showFeatureGuide(), 100);
        }
        
        e.preventDefault();
    }
    
    // 添加事件監聽器
    button.addEventListener('mousedown', handleStart);
    button.addEventListener('touchstart', handleStart, { passive: false });
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false });
    
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd, { passive: false });
    
    // 懸停效果（僅限非觸控設備）
    if (!('ontouchstart' in window)) {
        button.addEventListener('mouseenter', () => {
            if (!isDragging) {
                button.style.transform = 'scale(1.1)';
                button.style.backgroundColor = '#0056b3';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!isDragging) {
                button.style.transform = 'scale(1)';
                button.style.backgroundColor = '#007bff';
            }
        });
    }
    
    return button;
}

// 創建功能說明彈出視窗
function createFeatureGuideModal() {
    const modal = document.createElement('div');
    modal.id = 'standalone-feature-guide-modal';
    
    // 模態視窗樣式
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: '1000000', // 提高z-index確保在全螢幕狀態下也能顯示
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
    });
    
    // 內容容器
    const content = document.createElement('div');
    Object.assign(content.style, {
        backgroundColor: 'white',
        borderRadius: '15px',
        maxWidth: '90%',
        maxHeight: '90%',
        overflow: 'auto',
        position: 'relative',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
    });
    
    // 標題區域
    const header = document.createElement('div');
    Object.assign(header.style, {
        background: 'linear-gradient(135deg, #007bff, #0056b3)',
        color: 'white',
        padding: '20px',
        borderRadius: '15px 15px 0 0',
        position: 'relative'
    });
    
    const title = document.createElement('h2');
    title.textContent = featureGuideData.title;
    Object.assign(title.style, {
        margin: '0',
        fontSize: '24px',
        fontWeight: 'bold',
        textAlign: 'center'
    });
    
    // 關閉按鈕
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    Object.assign(closeBtn.style, {
        position: 'absolute',
        top: '15px',
        right: '15px',
        background: 'rgba(255, 255, 255, 0.2)',
        border: 'none',
        color: 'white',
        fontSize: '24px',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    });
    
    closeBtn.addEventListener('click', hideFeatureGuide);
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // 內容區域
    const body = document.createElement('div');
    Object.assign(body.style, {
        padding: '20px'
    });
    
    // 生成功能分類
    featureGuideData.categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        Object.assign(categoryDiv.style, {
            marginBottom: '25px',
            border: '2px solid #e9ecef',
            borderRadius: '10px',
            overflow: 'hidden'
        });
        
        // 分類標題
        const categoryHeader = document.createElement('div');
        Object.assign(categoryHeader.style, {
            backgroundColor: category.color,
            color: 'white',
            padding: '15px',
            fontSize: '18px',
            fontWeight: 'bold'
        });
        categoryHeader.innerHTML = `${category.icon} ${category.title}`;
        
        // 功能列表
        const featureList = document.createElement('div');
        Object.assign(featureList.style, {
            padding: '15px'
        });
        
        category.features.forEach(feature => {
            const featureItem = document.createElement('div');
            Object.assign(featureItem.style, {
                marginBottom: '15px',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                borderLeft: `4px solid ${category.color}`
            });
            
            const featureTitle = document.createElement('div');
            Object.assign(featureTitle.style, {
                fontSize: '16px',
                fontWeight: 'bold',
                color: category.color,
                marginBottom: '5px'
            });
            featureTitle.innerHTML = `${feature.icon} ${feature.title}`;
            
            const featureDesc = document.createElement('div');
            Object.assign(featureDesc.style, {
                fontSize: '14px',
                color: '#6c757d',
                lineHeight: '1.4'
            });
            featureDesc.textContent = feature.desc;
            
            featureItem.appendChild(featureTitle);
            featureItem.appendChild(featureDesc);
            featureList.appendChild(featureItem);
        });
        
        categoryDiv.appendChild(categoryHeader);
        categoryDiv.appendChild(featureList);
        body.appendChild(categoryDiv);
    });
    
    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);
    
    // 點擊背景關閉
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideFeatureGuide();
        }
    });
    
    return modal;
}

// 顯示功能說明
function showFeatureGuide() {
    console.log('顯示功能說明');
    const modal = document.getElementById('standalone-feature-guide-modal');
    if (modal) {
        modal.style.display = 'flex';
        // 添加淡入動畫
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.transition = 'opacity 0.3s ease';
            modal.style.opacity = '1';
        }, 10);
    }
}

// 隱藏功能說明
function hideFeatureGuide() {
    console.log('隱藏功能說明');
    const modal = document.getElementById('standalone-feature-guide-modal');
    if (modal) {
        modal.style.transition = 'opacity 0.3s ease';
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// 初始化獨立功能說明系統
function initStandaloneFeatureGuide() {
    console.log('初始化獨立功能說明系統');
    
    // 等待DOM加載完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStandaloneFeatureGuide);
        return;
    }
    
    // 移除現有的元素（如果存在）
    const existingBtn = document.getElementById('standalone-feature-guide-btn');
    const existingModal = document.getElementById('standalone-feature-guide-modal');
    if (existingBtn) existingBtn.remove();
    if (existingModal) existingModal.remove();
    
    // 創建並添加按鈕
    const button = createFeatureGuideButton();
    document.body.appendChild(button);
    
    // 創建並添加模態視窗
    const modal = createFeatureGuideModal();
    document.body.appendChild(modal);
    
    console.log('✅ 獨立功能說明系統初始化完成');
    
    // 添加閃爍效果提醒用戶
    let blinkCount = 0;
    const blinkInterval = setInterval(() => {
        button.style.backgroundColor = blinkCount % 2 === 0 ? '#ff6b6b' : '#007bff';
        blinkCount++;
        if (blinkCount >= 6) {
            clearInterval(blinkInterval);
            button.style.backgroundColor = '#007bff';
        }
    }, 500);
}

// 立即初始化
initStandaloneFeatureGuide();

// 暴露到全域
window.showFeatureGuide = showFeatureGuide;
window.hideFeatureGuide = hideFeatureGuide;

console.log('獨立功能說明系統腳本已加載');