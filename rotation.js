// Map rotation toggle and scale logic
let mapRotationEnabled = false;
let mapRotationDeg = 0; // fallback if currentBearing is unavailable
// 超採樣縮放比例，用於旋轉時覆蓋四角缺口與提升可視範圍
const MAP_ROTATION_OVERSCAN = (typeof window !== 'undefined' && typeof window.rotationOverscanScale === 'number' && isFinite(window.rotationOverscanScale))
  ? window.rotationOverscanScale
  : 1.25;

// 抖動抑制與平滑參數
const HEADING_SMOOTHING_ALPHA = 0.9   // 越大越平滑（0.8~0.92 建議值）
const HEADING_DEADZONE_DEG = 5        // 小於此角度變化則忽略更新
const MIN_ROTATION_INTERVAL_MS = 150; // 最小更新間隔，避免過於頻繁

let displayRotationDeg = 0;           // 平滑後實際套用的角度
let lastRotationUpdateTs = 0;         // 最後一次更新時間戳

function normalizeAngle(angle) {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

function shortestAngleDelta(from, to) {
  const a = normalizeAngle(to) - normalizeAngle(from);
  return normalizeAngle(a);
}

function toggleMapRotation() {
  const container = document.querySelector('.map-container');
  const mapEl = document.getElementById('map');
  const btn = document.getElementById('rotateBtn');
  if (!container || !mapEl) return;

  mapRotationEnabled = !mapRotationEnabled;

  if (mapRotationEnabled) {
    container.classList.add('map-rotated');
    // 若沒有可用方位或為 0，給一個預設角度以提供視覺回饋
    const hasBearing = (typeof window.currentBearing === 'number' && isFinite(window.currentBearing));
    if (!hasBearing || window.currentBearing === 0) {
      mapRotationDeg = 30; // 預設 30 度
    }
    updateMapRotation();
    if (btn) btn.classList.add('active');
  } else {
    container.classList.remove('map-rotated');
    container.style.setProperty('--map-rotation-deg', '0deg');
    container.style.setProperty('--map-rotation-scale', '1');
    if (btn) btn.classList.remove('active');
  }
}

function updateMapRotation() {
  if (!mapRotationEnabled) return;
  const container = document.querySelector('.map-container');
  const mapEl = document.getElementById('map');
  if (!container || !mapEl) return;

  let deg = (typeof window.currentBearing === 'number' && isFinite(window.currentBearing))
    ? window.currentBearing
    : mapRotationDeg;

  if (!isFinite(deg)) deg = 0;
  mapRotationDeg = deg;

  // 抑制抖動：角度平滑 + 死區 + 節流
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (now - lastRotationUpdateTs < MIN_ROTATION_INTERVAL_MS) {
    return; // 節流：太快則略過本次更新
  }

  const delta = shortestAngleDelta(displayRotationDeg, deg);
  if (Math.abs(delta) < HEADING_DEADZONE_DEG) {
    // 死區：變化太小不更新，避免晃動
    return;
  }

  // 指數平滑：向目標角度逼近，避免瞬間跳動
  const smoothFactor = 1 - HEADING_SMOOTHING_ALPHA; // 例如 0.15
  displayRotationDeg = normalizeAngle(displayRotationDeg + delta * smoothFactor);
  lastRotationUpdateTs = now;

  const rad = (deg * Math.PI) / 180;
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  // Bounding box of rotated rectangle
  const wPrime = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const hPrime = Math.abs(h * Math.cos(rad)) + Math.abs(w * Math.sin(rad));
  const baseScale = Math.max(wPrime / w, hPrime / h);
  const scale = baseScale * MAP_ROTATION_OVERSCAN;

  // 設定地圖旋轉與縮放（覆蓋四角缺口），並提供反向縮放給內部控制項使用
  container.style.setProperty('--map-rotation-deg', `${displayRotationDeg}deg`);
  container.style.setProperty('--map-rotation-scale', `${scale}`);
  container.style.setProperty('--inverse-map-rotation-scale', `${1 / scale}`);
}

// Recompute on viewport changes
window.addEventListener('resize', () => {
  if (mapRotationEnabled) updateMapRotation();
});

window.addEventListener('orientationchange', () => {
  if (mapRotationEnabled) setTimeout(updateMapRotation, 300);
});

// Optional: if other code updates currentBearing, refresh rotation
document.addEventListener('bearingUpdated', () => {
  if (mapRotationEnabled) updateMapRotation();
});

// 保證全域可呼叫，並在 DOM 準備好後綁定按鈕事件
window.toggleMapRotation = toggleMapRotation;
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('rotateBtn');
  if (btn) {
    btn.addEventListener('click', toggleMapRotation);
    // 在部分手機瀏覽器上，使用 touchend 可提升點擊反應可靠度
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      toggleMapRotation();
    }, { passive: false });
  }
});