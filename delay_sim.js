const CANVAS_SIZE_X = 600;
const CANVAS_SIZE_Y = 400;
const ROOM_MAX_X = 100; // 模擬場地最大寬度 100 米
const ROOM_MAX_Y = 66.67; // 模擬場地最大高度 (100 * 400/600 約 66.67 米)
const CARDIOID_COV = 0.5; // 簡化指向性因子 (F = 0.5 + 0.5*cos(theta_off))
const COVERAGE_ANGLE = 60; // 喇叭繪圖顯示的扇形角度 (+/- 60度)

const canvas = document.getElementById('delayCanvas');
const ctx = canvas.getContext('2d');

// --- DOM 元素引用 (新增 S1 角度) ---
const speedOfSoundInput = document.getElementById('speedOfSoundInput');
const currentSpeedSpan = document.getElementById('currentSpeed');
const modeToggleBtn = document.getElementById('modeToggleBtn');
const s1PosDisplay = document.getElementById('s1PosDisplay');
const s2PosDisplay = document.getElementById('s2PosDisplay');
const listenerPosDisplay = document.getElementById('listenerPosDisplay');
const t1TimeDisplay = document.getElementById('t1TimeDisplay');
const t2TimeDisplay = document.getElementById('t2TimeDisplay');
const compensationValue = document.getElementById('compensationValue');
const delayResultBox = document.getElementById('delayResultBox');
const resultHint = document.getElementById('resultHint');

const s1AngleInput = document.getElementById('s1AngleInput'); // New S1 angle input
const currentS1AngleSpan = document.getElementById('currentS1Angle'); // New S1 angle span
const s2AngleInput = document.getElementById('s2AngleInput');
const currentS2AngleSpan = document.getElementById('currentS2Angle');
const splDifferenceDisplay = document.getElementById('splDifference');

// 狀態變數 (米)
let S1_POS = { x: 10, y: ROOM_MAX_Y / 2 }; 
let S2_POS = { x: 60, y: ROOM_MAX_Y / 2 }; 
let L_POS = { x: 80, y: ROOM_MAX_Y / 2 };  
let isCompensationMode = true; 
let S1_AIM_ANGLE = 0; // S1 指向角度 (度)
let S2_AIM_ANGLE = 0; // S2 指向角度 (度)

// --- 輔助函數 (toCanvas, toReal, calculateDistance, calculateTime 保持不變) ---

function toCanvas(pos) {
    const scaleX = CANVAS_SIZE_X / ROOM_MAX_X;
    const scaleY = CANVAS_SIZE_Y / ROOM_MAX_Y;
    return {
        x: pos.x * scaleX,
        y: pos.y * scaleY
    };
}

function toReal(pos) {
    const scaleX = CANVAS_SIZE_X / ROOM_MAX_X;
    const scaleY = CANVAS_SIZE_Y / ROOM_MAX_Y;
    return {
        x: pos.x / scaleX,
        y: pos.y / scaleY
    };
}

function calculateDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function calculateTime(distance) {
    const v = parseFloat(speedOfSoundInput.value) || 343;
    const timeSec = distance / v;
    return timeSec * 1000; 
}


// --- 核心計算：方向性衰減 ---

/**
 * 計算從喇叭到聆聽點的幾何角度 (度)
 */
function calculateAngle(speakerPos, listenerPos) {
    const dx = listenerPos.x - speakerPos.x;
    const dy = listenerPos.y - speakerPos.y;
    let angleRad = Math.atan2(dy, dx);
    let angleDeg = angleRad * (180 / Math.PI);
    if (angleDeg < 0) {
        angleDeg += 360;
    }
    return angleDeg;
}

/**
 * 計算指向性衰減量 (簡化使用 Cardioid 類模型)
 */
function calculateDirectivityAttenuation(speakerPos, listenerPos, aimAngle) {
    const actualAngle = calculateAngle(speakerPos, listenerPos);
    
    // 計算離軸角度 (Off-axis Angle)
    let offAxisAngle = Math.abs(actualAngle - aimAngle);
    if (offAxisAngle > 180) {
        offAxisAngle = 360 - offAxisAngle;
    }
    
    const offAxisRad = offAxisAngle * (Math.PI / 180);
    
    // 簡化 Cardioid 增益公式: F = 0.5 + 0.5 * cos(theta_off)
    const linearGainFactor = CARDIOID_COV + (1 - CARDIOID_COV) * Math.cos(offAxisRad); 
    
    // 轉換為 dB 衰減 (負數, 代表比軸上 SPL 低多少)
    if (linearGainFactor <= 0.001) {
        return -60; 
    }
    
    const attenuationDb = 20 * Math.log10(linearGainFactor);
    return attenuationDb;
}

/**
 * 總體計算 (時間與 SPL)
 */
function calculateAll() {
    // --- 距離和時間計算 ---
    const d1 = calculateDistance(S1_POS, L_POS);
    const d2 = calculateDistance(S2_POS, L_POS);

    const t1 = calculateTime(d1); 
    const t2 = calculateTime(d2); 
    
    let deltaT = 0;
    if (isCompensationMode) {
        deltaT = Math.max(0, t1 - t2); 
    } else {
        deltaT = t2 - t1;
    }
    
    // --- SPL 差異計算 ---
    
    // 1. 距離衰減 (SPL 衰減量 = 20 * log10(距離))
    const dAttenuationS1 = 20 * Math.log10(d1);
    const dAttenuationS2 = 20 * Math.log10(d2);
    
    // 2. 指向性衰減
    // S1 的指向性衰減 (負數)
    const dirAttenuationS1 = calculateDirectivityAttenuation(S1_POS, L_POS, S1_AIM_ANGLE); 
    
    // S2 的指向性衰減 (負數)
    const dirAttenuationS2 = calculateDirectivityAttenuation(S2_POS, L_POS, S2_AIM_ANGLE);

    // 聲音相對強度 = - (距離衰減) + (指向性衰減) 
    const relativeSplS1 = -dAttenuationS1 + dirAttenuationS1;

    const relativeSplS2 = -dAttenuationS2 + dirAttenuationS2; 

    // S1 相對於 S2 的 SPL 差異 (dB): (S1 聲音強度) - (S2 聲音強度)
    const splDiff = relativeSplS1 - relativeSplS2; 

    return { t1, t2, deltaT, splDiff };
}

// --- 繪圖邏輯 ---

/**
 * 繪製單一喇叭的覆蓋範圍
 */
function drawSpeakerCoverage(speakerPos, aimAngle, color) {
    const s_px = toCanvas(speakerPos);
    const aimAngleRad = aimAngle * (Math.PI / 180);
    const covRad = COVERAGE_ANGLE * (Math.PI / 180);
    const radius = 100; 

    // 繪製扇形
    ctx.fillStyle = color.replace('1)', '0.2)'); // 設置為半透明
    ctx.beginPath();
    ctx.moveTo(s_px.x, s_px.y);
    ctx.arc(s_px.x, s_px.y, radius, 
            aimAngleRad - covRad / 2, 
            aimAngleRad + covRad / 2);
    ctx.closePath();
    ctx.fill();

    // 繪製指向中心線
    ctx.strokeStyle = color.replace('0.2)', '1)'); 
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s_px.x, s_px.y);
    ctx.lineTo(s_px.x + radius * Math.cos(aimAngleRad), s_px.y + radius * Math.sin(aimAngleRad));
    ctx.stroke();
}


function drawScene() {
    ctx.clearRect(0, 0, CANVAS_SIZE_X, CANVAS_SIZE_Y);
    
    // 繪製場地邊界
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, CANVAS_SIZE_X, CANVAS_SIZE_Y);

    const s1_px = toCanvas(S1_POS);
    const s2_px = toCanvas(S2_POS);
    const l_px = toCanvas(L_POS);
    
    // --- 繪製 S1 指向性 ---
    drawSpeakerCoverage(S1_POS, S1_AIM_ANGLE, 'rgba(230, 126, 34, 1)'); // 橙色

    // --- 繪製 S2 指向性 ---
    drawSpeakerCoverage(S2_POS, S2_AIM_ANGLE, 'rgba(52, 152, 219, 1)'); // 藍色

    // --- 繪製聲線和點 ---

    // 繪製 S1 -> L 聲線 (主喇叭)
    ctx.strokeStyle = '#e67e22'; // 橙色
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s1_px.x, s1_px.y);
    ctx.lineTo(l_px.x, l_px.y);
    ctx.stroke();

    // 繪製 S2 -> L 聲線 (延遲喇叭)
    ctx.strokeStyle = '#3498db'; // 藍色
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]); // 虛線
    ctx.beginPath();
    ctx.moveTo(s2_px.x, s2_px.y);
    ctx.lineTo(l_px.x, l_px.y);
    ctx.stroke();
    ctx.setLineDash([]); // 重置為實線

    // 繪製 S1 (主喇叭)
    ctx.fillStyle = '#e67e22'; 
    ctx.beginPath();
    ctx.arc(s1_px.x, s1_px.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('S1 (Main)', s1_px.x + 15, s1_px.y - 5);

    // 繪製 S2 (延遲喇叭)
    ctx.fillStyle = '#3498db'; 
    ctx.beginPath();
    ctx.arc(s2_px.x, s2_px.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('S2 (Delay)', s2_px.x + 15, s2_px.y - 5);
    
    // 繪製 L (聆聽點)
    ctx.fillStyle = '#2ecc71'; 
    ctx.beginPath();
    ctx.arc(l_px.x, l_px.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('L (Listener)', l_px.x - 50, l_px.y + 20);
}

/**
 * 更新右側的時間顯示面板
 */
function updateTimeDisplay() {
    const { t1, t2, deltaT, splDiff } = calculateAll();
    
    // 更新 S1/S2/L 座標顯示 (米)
    s1PosDisplay.textContent = `X: ${S1_POS.x.toFixed(1)}m, Y: ${S1_POS.y.toFixed(1)}m`;
    s2PosDisplay.textContent = `X: ${S2_POS.x.toFixed(1)}m, Y: ${S2_POS.y.toFixed(1)}m`;
    listenerPosDisplay.textContent = `X: ${L_POS.x.toFixed(1)}m, Y: ${L_POS.y.toFixed(1)}m`;
    currentSpeedSpan.textContent = speedOfSoundInput.value;
    
    currentS1AngleSpan.textContent = s1AngleInput.value; // Update S1 angle display
    currentS2AngleSpan.textContent = s2AngleInput.value; // Update S2 angle display

    // --- 更新延遲時間顯示 (略) ---
    t1TimeDisplay.textContent = `${t1.toFixed(1)} ms`;
    
    if (isCompensationMode) {
        const t2_compensated = t2 + deltaT;
        t2TimeDisplay.textContent = `${t2_compensated.toFixed(1)} ms`;
        compensationValue.textContent = `+${deltaT.toFixed(1)} ms`;
        delayResultBox.className = 'delay-result-box compensated';
        resultHint.textContent = `S2 必須延遲此時間 (${deltaT.toFixed(1)} ms) 才能與 S1 的聲音同步 (目標: ${t1.toFixed(1)} ms)。`;
    } else {
        t2TimeDisplay.textContent = `${t2.toFixed(1)} ms`;
        const error = Math.abs(t1 - t2);
        compensationValue.textContent = `±${error.toFixed(1)} ms`;
        delayResultBox.className = 'delay-result-box uncompensated';
        resultHint.textContent = `S1 與 S2 聲音到達時間相差 ${error.toFixed(1)} ms，會造成清晰度降低 (梳狀濾波)。`;
    }

    // --- 更新 SPL 差異顯示 ---
    const formattedSplDiff = splDiff.toFixed(1);
    splDifferenceDisplay.textContent = `${(splDiff > 0 ? '+' : '')}${formattedSplDiff} dB`;
    
    const splBox = document.querySelector('.spl-diff-box');
    const splValue = document.getElementById('splDifference');
    
    // 根據 SPL 差異改變顏色和邊框
    if (Math.abs(splDiff) <= 3) {
        // 接近平衡 (±3dB 內) - 綠色 (同步色)
        splValue.style.color = '#16a085';
        splBox.style.border = '2px solid #16a085';
    } else if (splDiff > 3) {
        // S1明顯更響 (>3dB) - 橙色 (S1色)
        splValue.style.color = '#e67e22';
        splBox.style.border = '2px solid #e67e22';
    } else if (splDiff < -3) {
        // S2明顯更響 (<-3dB) - 藍色 (S2色)
        splValue.style.color = '#3498db';
        splBox.style.border = '2px solid #3498db';
    } 
}


// --- 事件監聽 ---

canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x_px = event.clientX - rect.left;
    const y_px = event.clientY - rect.top;
    
    L_POS = toReal({ x: x_px, y: y_px });
    
    drawScene();
    updateTimeDisplay();
});

// S1 角度事件
s1AngleInput.addEventListener('input', () => {
    S1_AIM_ANGLE = parseInt(s1AngleInput.value);
    drawScene();
    updateTimeDisplay();
});

// S2 角度事件
s2AngleInput.addEventListener('input', () => {
    S2_AIM_ANGLE = parseInt(s2AngleInput.value);
    drawScene();
    updateTimeDisplay();
});

speedOfSoundInput.addEventListener('input', () => {
    drawScene();
    updateTimeDisplay();
});

modeToggleBtn.addEventListener('click', () => {
    isCompensationMode = !isCompensationMode;
    
    if (isCompensationMode) {
        modeToggleBtn.textContent = '自動計算並補償延遲';
        modeToggleBtn.className = 'toggle-on';
    } else {
        modeToggleBtn.textContent = '🚫 顯示無延遲誤差';
        modeToggleBtn.className = 'toggle-off';
    }
    
    updateTimeDisplay();
});

// 初始化
function init() {
    canvas.width = CANVAS_SIZE_X;
    canvas.height = CANVAS_SIZE_Y;
    
    // 初始值
    S1_AIM_ANGLE = parseInt(s1AngleInput.value);
    S2_AIM_ANGLE = parseInt(s2AngleInput.value);
    
    drawScene();
    updateTimeDisplay();
}

document.addEventListener('DOMContentLoaded', init);