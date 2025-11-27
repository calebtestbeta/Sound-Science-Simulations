// --- 1. 常數與設定 ---

// 聲速 (Speed of Sound) - 在標準室溫下
// 四次減速，使預設動畫效果為原始真實速度的約十六分之一
const SPEED_OF_SOUND = 21.4375; // m/s 

// 殘響時間衰減量 (60 dB)
const TARGET_DECAY_DB = 60;

// 房間材質吸音係數 (簡化模型)
const ABSORPTION_COEFFICIENTS = {
    hard: 0.02,   // 極低吸音，使 RT60 效果更明顯
    medium: 0.3,  // 中等材料 (木材, 少量地毯) - 中吸音
    soft: 0.6     // 軟裝材料 (厚地毯, 窗簾, 軟墊家具) - 高吸音
};

// Canvas 尺寸與比例 (在 JavaScript 中設定，確保畫布始終為正方形)
const CANVAS_SIZE = 500;
const ROOM_MAX_SIZE = 10; // 假定畫布最大能模擬 10x10 米的房間

// 聲線數量 (用於模擬聲音的擴散)
const NUM_RAYS = 20; 

// --- 2. DOM 元素與狀態管理 ---

const canvas = document.getElementById('reverbCanvas');
const ctx = canvas.getContext('2d');

const roomLengthInput = document.getElementById('roomLength');
const roomWidthInput = document.getElementById('roomWidth');
const materialSelect = document.getElementById('materialSelect');
const rt60ValueSpan = document.getElementById('rt60Value');
const timeScaleSlider = document.getElementById('timeScaleSlider');
const currentTimeScaleSpan = document.getElementById('currentTimeScale');
const simulationTimeSpan = document.getElementById('simulationTime');
const singlePulseBtn = document.getElementById('singlePulseBtn');
const continuousPulseBtn = document.getElementById('continuousPulseBtn');

let isContinuous = false;
let animationFrameId = null;
let lastTime = 0;
let simulationTime = 0;

let sourcePos = { x: 50, y: 50 }; // 聲源位置 (Canvas 座標)
let listenerPos = { x: 450, y: 450 }; // 聽者位置 (Canvas 座標)

let activeRays = []; // 當前活躍的聲音射線陣列

// --- 3. 核心類別：聲音射線 (Ray) ---

class Ray {
    constructor(start, angle, intensity = 1.0) {
        this.pos = { x: start.x, y: start.y };
        this.dir = { 
            x: Math.cos(angle), 
            y: Math.sin(angle) 
        };
        this.initialIntensity = intensity; // 初始音量 (0-1)
        this.intensity = intensity;       // 當前音量 (衰減)
        this.path = [ { x: start.x, y: start.y } ]; // 記錄移動路徑
        this.active = true;
        this.bounces = 0; // 反射計數器
    }

    // 聲音強度衰減公式 (模擬 dB 衰減)
    getDecayFactor(absorptionCoeff) {
        return 1.0 - absorptionCoeff; 
    }

    update(dt, room) {
        if (!this.active) return;
        
        const scale = CANVAS_SIZE / room.length; 
        const distance = SPEED_OF_SOUND * dt * scale;
        
        const newPos = {
            x: this.pos.x + this.dir.x * distance,
            y: this.pos.y + this.dir.y * distance,
        };
        
        // 檢查碰撞
        const { hit, surface } = this.checkCollision(newPos, room);

        if (hit) {
            // 處理反射
            this.pos = hit;
            this.path.push({ x: hit.x, y: hit.y });
            
            // 計算衰減
            const absorptionCoeff = ABSORPTION_COEFFICIENTS[materialSelect.value];
            this.intensity *= this.getDecayFactor(absorptionCoeff);
            
            this.bounces++; // 反射計數遞增

            // 反射角度計算 (簡化：入射角等於反射角)
            if (surface === 'vertical') {
                this.dir.x *= -1;
            } else if (surface === 'horizontal') {
                this.dir.y *= -1;
            }
            
            // 檢查音量是否衰減到極限 (0.01 相當於 -40 dB 衰減)
            if (this.intensity < 0.01) {
                this.active = false;
            }

        } else {
            this.pos = newPos;
        }

        this.path[this.path.length - 1] = { x: this.pos.x, y: this.pos.y };
    }

    checkCollision(newPos, room) {
        const xMin = 0;
        const xMax = CANVAS_SIZE;
        const yMin = 0;
        const yMax = CANVAS_SIZE;

        let hit = null;
        let surface = null;

        // 檢查左/右牆 (垂直面)
        if (newPos.x <= xMin || newPos.x >= xMax) {
            surface = 'vertical';
            hit = { x: newPos.x <= xMin ? xMin : xMax, y: newPos.y };
        } 
        
        // 檢查上/下牆 (水平面)
        if (newPos.y <= yMin || newPos.y >= yMax) {
            surface = 'horizontal';
            hit = { x: newPos.x, y: newPos.y <= yMin ? yMin : yMax };
        }
        
        // 處理角落反射
        if (hit && surface === 'vertical') {
             if (hit.y <= yMin || hit.y >= yMax) {
                this.dir.y *= -1;
             }
        } else if (hit && surface === 'horizontal') {
            if (hit.x <= xMin || hit.x >= xMax) {
                this.dir.x *= -1;
            }
        }

        return { hit, surface };
    }

    draw() {
        if (!this.active) return;

        // 根據音量設定透明度
        const alpha = Math.min(1.0, this.intensity * 2); 
        
        // 顏色變化：根據反射次數改變色相 (Hue)
        const hue = 219 - (this.bounces * 8) % 150; // 每次反射色相變動 8 度
        const color = `hsla(${hue}, 80%, 55%, ${alpha})`; // 使用 HSL 顏色模型

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        
        // 繪製路徑
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.stroke();

        // 繪製當前音波頭部 (橙色)
        ctx.fillStyle = `rgba(230, 126, 34, ${alpha})`; 
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- 4. RT60 計算 ---

function calculateRT60() {
    const L = parseFloat(roomLengthInput.value);
    const W = parseFloat(roomWidthInput.value);
    const H = 3.0; // 假設房間高 3.0 米 (為了計算體積)
    const V = L * W * H; // 體積 (m^3)

    const alpha = ABSORPTION_COEFFICIENTS[materialSelect.value];
    
    // 總表面積 (牆、天花板、地板)
    const S = 2 * (L * W + L * H + W * H); 
    
    // 總吸音量 A = S * alpha (簡化模型)
    const A = S * alpha; 
    
    if (V <= 0 || A <= 0) {
        rt60ValueSpan.textContent = "無效值";
        return 0;
    }

    // Sabine's Formula: RT60 = 0.161 * V / A
    const rt60 = (0.161 * V) / A;

    rt60ValueSpan.textContent = `${rt60.toFixed(2)} 秒`;
    
    return rt60;
}

// --- 5. 繪圖與動畫邏輯 ---

function setupCanvas() {
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    
    sourcePos = { x: CANVAS_SIZE * 0.2, y: CANVAS_SIZE * 0.5 };
    listenerPos = { x: CANVAS_SIZE * 0.8, y: CANVAS_SIZE * 0.5 };
}

function drawRoom() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    ctx.fillStyle = '#e67e22'; // 聲源
    ctx.beginPath();
    ctx.arc(sourcePos.x, sourcePos.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#2ecc71'; // 聽者
    ctx.beginPath();
    ctx.arc(listenerPos.x, listenerPos.y, 8, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * 創建一組新的聲音射線 (聲脈衝)
 * *** 修正點 1：移除 activeRays = [];，讓舊聲線持續存在直到衰減。 ***
 */
function emitPulse(intensity = 1.0) {
    // activeRays = []; // 移除此行
    
    for (let i = 0; i < NUM_RAYS; i++) {
        const angle = (i / NUM_RAYS) * (Math.PI * 2);
        activeRays.push(new Ray(sourcePos, angle, intensity));
    }
}

function animate(timestamp) {
    if (animationFrameId === null) {
        lastTime = timestamp;
        animationFrameId = window.requestAnimationFrame(animate);
        return;
    }
    
    const timeScale = parseFloat(timeScaleSlider.value);
    const deltaTime = (timestamp - lastTime) / 1000; 
    const simulatedDeltaTime = deltaTime * timeScale; 
    
    simulationTime += simulatedDeltaTime;
    lastTime = timestamp;
    
    simulationTimeSpan.textContent = simulationTime.toFixed(2);
    currentTimeScaleSpan.textContent = `${timeScale.toFixed(1)}x`;

    drawRoom();

    const roomDimensions = { 
        length: parseFloat(roomLengthInput.value), 
        width: parseFloat(roomWidthInput.value) 
    };
    
    // 過濾掉所有已停止的聲線 (優化性能)
    activeRays = activeRays.filter(ray => ray.active);

    let allRaysInactive = true;
    for (const ray of activeRays) {
        ray.update(simulatedDeltaTime, roomDimensions);
        ray.draw();
        if (ray.active) {
            allRaysInactive = false;
        }
    }

    // *** 修正點 2：提高連續發射頻率 (0.25 秒) ***
    if (isContinuous && simulationTime % 0.25 < simulatedDeltaTime) { 
        emitPulse(0.5); 
    }
    
    if (!isContinuous && activeRays.length === 0 && allRaysInactive) {
        stopAnimation();
        return;
    }
    
    animationFrameId = window.requestAnimationFrame(animate);
}

function startAnimation() {
    if (animationFrameId === null) {
        lastTime = performance.now();
        animationFrameId = window.requestAnimationFrame(animate);
    }
}

function stopAnimation() {
    if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// --- 6. 事件監聽器 ---

roomLengthInput.addEventListener('input', calculateRT60);
roomWidthInput.addEventListener('input', calculateRT60);
materialSelect.addEventListener('change', calculateRT60);

singlePulseBtn.addEventListener('click', () => {
    isContinuous = false;
    stopAnimation();
    simulationTime = 0;
    activeRays = []; // 單一脈衝模式下，每次發射前清空舊聲線
    emitPulse(1.0); 
    startAnimation();
});

continuousPulseBtn.addEventListener('click', () => {
    if (isContinuous) {
        isContinuous = false;
        continuousPulseBtn.textContent = '🔄 模擬連續說話';
    } else {
        isContinuous = true;
        continuousPulseBtn.textContent = '⏸ 停止說話模擬';
        stopAnimation();
        simulationTime = 0;
        // *** 修正點 3：提高初始脈衝強度 (1.0) ***
        // 注意：不主動清空 activeRays，讓聲線在連續模式下累積。
        emitPulse(1.0); 
        startAnimation();
    }
});

canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (event.ctrlKey || event.metaKey) { 
        listenerPos = { x, y };
    } else {
        sourcePos = { x, y };
    }

    drawRoom();
    
    if (animationFrameId !== null && !isContinuous) {
         stopAnimation();
         simulationTime = 0;
         activeRays = [];
         emitPulse(1.0);
         startAnimation();
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setupCanvas();
    drawRoom();
    calculateRT60(); 
    
    currentTimeScaleSpan.textContent = `${parseFloat(timeScaleSlider.value).toFixed(1)}x`;
});