// Map rotation toggle and scale logic
let mapRotationEnabled = false;
let mapRotationDeg = 0; // fallback if currentBearing is unavailable

function toggleMapRotation() {
  const container = document.querySelector('.map-container');
  const mapEl = document.getElementById('map');
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
  } else {
    container.classList.remove('map-rotated');
    container.style.setProperty('--map-rotation-deg', '0deg');
    container.style.setProperty('--map-rotation-scale', '1');
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

  const rad = (deg * Math.PI) / 180;
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  // Bounding box of rotated rectangle
  const wPrime = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const hPrime = Math.abs(h * Math.cos(rad)) + Math.abs(w * Math.sin(rad));
  const scale = Math.max(wPrime / w, hPrime / h);

  container.style.setProperty('--map-rotation-deg', `${deg}deg`);
  container.style.setProperty('--map-rotation-scale', `${scale}`);
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
  }
});