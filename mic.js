const MIC_TYPES = {
    'Omnidirectional': {
        name: "全向性",
        formula: (k, theta) => k * 1,
        desc: "收音均勻分佈於 360°，適合環境錄音，但無法有效抑制噪音。"
    },
    'Cardioid': {
        name: "心型",
        formula: (k, theta) => k * (0.5 + 0.5 * Math.cos(theta)),
        desc: "主要收音在前方。後方 180° 衰減最強，常見於手持麥克風。"
    },
    'Supercardioid': {
        name: "超心型",
        formula: (k, theta) => k * (0.37 + 0.63 * Math.cos(theta)),
        desc: "指向性更強，適合舞台。後方會出現小收音峰，但側面衰減更好。"
    },
    'Shotgun': {
        name: "槍型",
        formula: (k, theta) => k * (0.1 + 0.9 * Math.cos(theta)),
        desc: "極超指向性。收音範圍極窄，用於遠距離收音或極端降噪，有長干涉管。"
    }
};

const freqSlider = document.getElementById('freqSlider');
const micTypeSelect = document.getElementById('micTypeSelect');
const noiseAngleInput = document.getElementById('noiseAngleInput');
const currentFreqSpan = document.getElementById('currentFreq');
const currentNoiseAngleSpan = document.getElementById('currentNoiseAngle');
const micTypeDescription = document.getElementById('micTypeDescription');
const snrImprovementValue = document.getElementById('snrImprovementValue'); // *** 新增 SNR 元素 ***

let polarChart;

// --- A. 核心計算函數 ---

/**
 * 根據麥克風類型和角度計算相對增益 (非dB)
 * @param {string} micType - 麥克風類型
 * @param {number} theta - 角度 (弧度)
 * @param {number} frequency - 聲音頻率 (Hz)
 * @returns {number} 相對線性增益 (0到1之間)
 */
function calculateRelativeGain(micType, theta, frequency) {
    const config = MIC_TYPES[micType];
    if (!config) return 0;

    // 基礎指向性公式 (線性增益)
    let linearGain = config.formula(1, theta); 
    
    return linearGain;
}

/**
 * 將線性增益轉換為 dB 衰減
 * @param {number} linearGain - 線性增益
 * @param {number} frequency - 聲音頻率 (Hz)
 * @returns {number} dB 衰減值 (以 0dB 為最大值)
 */
function linearToDbAttenuation(linearGain, frequency) {
    if (linearGain <= 0) {
        return -40; 
    }
    
    let dbValue = 20 * Math.log10(linearGain);
    
    // 應用頻率銳度修正 (讓高頻時非 0° 增益衰減更快)
    const normalizedFreq = frequency / 8000;
    const sharpeningFactor = 1 + normalizedFreq * 0.5; 
    
    if (dbValue < 0) {
        dbValue *= sharpeningFactor;
    }
    
    return Math.max(0, dbValue + 40); // 轉換為 Chart.js 的極座標距離
}

/**
 * 計算目標語音 (0°) 相對於噪音角度的 SNR 改善量 (dB)
 * @param {string} micType - 麥克風類型
 * @param {number} frequency - 聲音頻率 (Hz)
 * @param {number} noiseAngle - 噪音角度 (度)
 * @returns {string} SNR 改善量 (dB) 字符串
 */
function calculateSnrImprovement(micType, frequency, noiseAngle) {
    if (micType === 'Omnidirectional') {
        return "0.0"; 
    }

    // 0度增益永遠是最大值 (線性 1, dB 0)
    
    // 噪音角度轉弧度
    const noiseAngleRad = noiseAngle * (Math.PI / 180);
    const noiseGainLinear = calculateRelativeGain(micType, noiseAngleRad, frequency); 

    // 避免 log(0)
    const safeNoiseGainLinear = Math.max(0.0001, noiseGainLinear);
    
    // 計算噪音在該角度的衰減量 (負值, 相對於 0度)
    let noiseAttenuationDb = 20 * Math.log10(safeNoiseGainLinear);
    
    // 應用頻率銳度修正
    const normalizedFreq = frequency / 8000;
    const sharpeningFactor = 1 + normalizedFreq * 0.5; 
    
    if (noiseAttenuationDb < 0) {
        // 噪音增益越負，代表衰減越多，SNR 改善越多
        noiseAttenuationDb *= sharpeningFactor;
        
        // SNR 改善量 = 0dB - 噪音增益(負值)
        const snrImprovement = -noiseAttenuationDb; 
        
        // 設置上限，模擬助聽器硬體極限
        return Math.min(snrImprovement, 12.0).toFixed(1); 
    }
    
    // 如果噪音增益是正值 (理論上在指向性麥克風中極少見)，則無改善
    return "0.0";
}


function generatePolarData() {
    const micType = micTypeSelect.value;
    const frequency = parseInt(freqSlider.value);
    const data = [];
    const labels = [];
    
    // 繪製 360 個數據點 (每 10 度一個點)
    for (let i = 0; i <= 360; i += 10) {
        const theta_rad = i * (Math.PI / 180); 
        const linearGain = calculateRelativeGain(micType, theta_rad, frequency);
        const dbAttenuation = linearToDbAttenuation(linearGain, frequency);

        data.push(dbAttenuation);
        labels.push(`${i}°`);
    }

    return { data, labels };
}

// --- B. SVG 麥克風外型繪製 (程式碼未變動，此處略去以節省篇幅，但請保持完整) ---
function drawMicrophoneShape(type) {
    const svg = document.getElementById('micShapeSVG');
    svg.innerHTML = ''; 
    
    const NS = "http://www.w3.org/2000/svg";
    const bodyColor = '#555';
    const headColor = '#aaa';

    function drawBody(width, height, y) {
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', (100 - width) / 2);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('rx', 5);
        rect.setAttribute('fill', bodyColor);
        svg.appendChild(rect);
    }
    
    function drawHead(width, y) {
        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('cx', 50);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', width / 2);
        circle.setAttribute('fill', headColor);
        svg.appendChild(circle);
    }

    if (type === 'Shotgun') {
        const tubeHeight = 150;
        const tubeWidth = 10;
        const bodyHeight = 50;
        const bodyWidth = 30;
        drawBody(tubeWidth, tubeHeight, 20); // 槍管
        drawBody(bodyWidth, bodyHeight, 170); // 機身
        drawHead(bodyWidth, 170); // 收音頭
        micTypeDescription.textContent = '特徵：細長干涉管。極窄收音範圍。';

    } else if (type === 'Cardioid' || type === 'Supercardioid') {
        const bodyHeight = 150;
        const bodyWidth = 35;
        const headRadius = 25;
        drawBody(bodyWidth, bodyHeight, 60); // 機身
        drawHead(headRadius * 2, 50); // 收音頭
        if (type === 'Cardioid') {
            micTypeDescription.textContent = '特徵：標準機身。後方 180° 衰減最強。';
        } else {
            micTypeDescription.textContent = '特徵：指向性強於心型。後方有小收音峰。';
        }

    } else if (type === 'Omnidirectional') {
        const bodyHeight = 100;
        const bodyWidth = 40;
        const headRadius = 30;
        drawBody(bodyWidth, bodyHeight, 100); // 機身
        drawHead(headRadius * 2, 70); // 收音頭
        micTypeDescription.textContent = '特徵：收音頭圓潤。360° 收音均衡，無指向性。';
    }
}


// --- C. Chart.js 初始化與更新 (已修正初始化 bug 和多餘標籤) ---

function initChart() {
    const { data, labels } = generatePolarData();
    const ctx = document.getElementById('polarChart').getContext('2d');

    polarChart = new Chart(ctx, { // *** 修正: 移除了多餘的 'new' 關鍵字 ***
        type: 'polarArea',
        data: {
            labels: labels,
            datasets: [{
                label: '相對收音增益 (dB)',
                data: data,
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false, // 隱藏多餘的藍色角度框框
                },
                title: {
                    display: true,
                    text: '麥克風指向性圖',
                    font: { size: 16 }
                }
            },
            scales: {
                r: {
                    suggestedMin: 0,
                    suggestedMax: 40,
                    pointLabels: {
                        display: true,
                        centerPointLabels: true,
                        font: { size: 10 }
                    },
                    angleLines: { color: '#ccc' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' },
                    ticks: {
                        callback: function(value, index, values) {
                            if (value === 40) return '0 dB (Max)';
                            if (value === 30) return '-10 dB';
                            if (value === 20) return '-20 dB';
                            if (value === 10) return '-30 dB';
                            if (value === 0) return '-40 dB (Min)';
                            return null;
                        }
                    }
                }
            }
        }
    });

    updateNoiseIndicator();
}


function updateChart() {
    const { data } = generatePolarData();
    polarChart.data.datasets[0].data = data;
    polarChart.data.datasets[0].label = `${micTypeSelect.options[micTypeSelect.selectedIndex].text} 相對收音增益 (dB)`;
    polarChart.update();
    
    // *** 新增：更新 SNR 改善數值 ***
    const snrValue = calculateSnrImprovement(
        micTypeSelect.value, 
        parseInt(freqSlider.value), 
        parseInt(noiseAngleInput.value)
    );
    snrImprovementValue.textContent = `+${snrValue} dB`;
    
    // 更新噪音點
    updateNoiseIndicator();
    
    // 更新 SVG 外型
    drawMicrophoneShape(micTypeSelect.value);
}

/**
 * 在圖表上標記噪音源角度 (程式碼微調，確保半徑計算穩健)
 */
function updateNoiseIndicator() {
    const noiseAngle = parseInt(noiseAngleInput.value);
    
    document.querySelectorAll('.noise-indicator').forEach(el => el.remove());

    const chartArea = polarChart.chartArea;
    
    if (!chartArea || chartArea.bottom === undefined || isNaN(chartArea.bottom)) return; 

    const center = {
        x: (chartArea.left + chartArea.right) / 2,
        y: (chartArea.top + chartArea.bottom) / 2
    };

    const angle_rad = (noiseAngle - 90) * (Math.PI / 180); 

    const R = Math.min(
        (chartArea.right - chartArea.left) / 2, 
        (chartArea.bottom - chartArea.top) / 2
    ) - 10; 

    const x_pos = center.x + R * Math.cos(angle_rad);
    const y_pos = center.y + R * Math.sin(angle_rad);

    const indicator = document.createElement('div');
    indicator.className = 'noise-indicator';
    indicator.style.left = `${x_pos}px`;
    indicator.style.top = `${y_pos}px`;
    
    document.querySelector('.chart-container').appendChild(indicator);
}


// --- D. 事件監聽 ---

micTypeSelect.addEventListener('change', updateChart);

freqSlider.addEventListener('input', () => {
    currentFreqSpan.textContent = freqSlider.value;
    updateChart();
});

noiseAngleInput.addEventListener('input', () => {
    currentNoiseAngleSpan.textContent = noiseAngleInput.value;
    updateChart(); // 更新圖表和 SNR
});


// 首次加載
document.addEventListener('DOMContentLoaded', () => {
    currentFreqSpan.textContent = freqSlider.value;
    currentNoiseAngleSpan.textContent = noiseAngleInput.value;
    
    drawMicrophoneShape(micTypeSelect.value);
    
    initChart();
    updateChart(); // 確保 SNR 在頁面初始化時計算
});