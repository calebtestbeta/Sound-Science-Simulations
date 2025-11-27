// ISO 226:2003 等響度曲線數據 (簡化版)
const equalLoudnessData = {
    20: [
        { freq: 20, dbSPL: 90 }, { freq: 50, dbSPL: 65 }, { freq: 100, dbSPL: 45 },
        { freq: 200, dbSPL: 30 }, { freq: 500, dbSPL: 22 }, { freq: 1000, dbSPL: 20 },
        { freq: 2000, dbSPL: 20 }, { freq: 4000, dbSPL: 25 }, { freq: 8000, dbSPL: 40 },
        { freq: 12000, dbSPL: 60 }, { freq: 16000, dbSPL: 80 }
    ],
    40: [
        { freq: 20, dbSPL: 95 }, { freq: 50, dbSPL: 70 }, { freq: 100, dbSPL: 50 },
        { freq: 200, dbSPL: 35 }, { freq: 500, dbSPL: 30 }, { freq: 1000, dbSPL: 40 },
        { freq: 2000, dbSPL: 40 }, { freq: 4000, dbSPL: 45 }, { freq: 8000, dbSPL: 55 },
        { freq: 12000, dbSPL: 70 }, { freq: 16000, dbSPL: 90 }
    ],
    60: [
        { freq: 20, dbSPL: 100 }, { freq: 50, dbSPL: 75 }, { freq: 100, dbSPL: 55 },
        { freq: 200, dbSPL: 40 }, { freq: 500, dbSPL: 45 }, { freq: 1000, dbSPL: 60 },
        { freq: 2000, dbSPL: 60 }, { freq: 4000, dbSPL: 60 }, { freq: 8000, dbSPL: 70 },
        { freq: 12000, dbSPL: 80 }, { freq: 16000, dbSPL: 100 }
    ],
    80: [
        { freq: 20, dbSPL: 105 }, { freq: 50, dbSPL: 80 }, { freq: 100, dbSPL: 60 },
        { freq: 200, dbSPL: 45 }, { freq: 500, dbSPL: 55 }, { freq: 1000, dbSPL: 80 },
        { freq: 2000, dbSPL: 80 }, { freq: 4000, dbSPL: 75 }, { freq: 8000, dbSPL: 80 },
        { freq: 12000, dbSPL: 90 }, { freq: 16000, dbSPL: 100 }
    ],
    90: [
        { freq: 20, dbSPL: 110 }, { freq: 50, dbSPL: 85 }, { freq: 100, dbSPL: 65 },
        { freq: 200, dbSPL: 50 }, { freq: 500, dbSPL: 65 }, { freq: 1000, dbSPL: 90 },
        { freq: 2000, dbSPL: 90 }, { freq: 4000, dbSPL: 85 }, { freq: 8000, dbSPL: 88 },
        { freq: 12000, dbSPL: 95 }, { freq: 16000, dbSPL: 105 }
    ]
};

// RETSPL 數據：dB HL 到 dB SPL 的轉換常數 (用於聽力閾值轉換)
const RETSPL_CONSTANTS = {
    500: 11.5,
    1000: 7.0,
    2000: 9.0,
    4000: 10.5
};

// 獲取 DOM 元素
const ctx = document.getElementById('equalLoudnessChart').getContext('2d');
const loudnessSlider = document.getElementById('loudnessSlider');
const currentPhonSpan = document.getElementById('currentPhon');
const hlSliders = document.querySelectorAll('.hlSlider');
const aidToggle = document.getElementById('aidToggle'); 
const gainAdjustSliders = document.querySelectorAll('.gainSlider'); // *** [新增] 增益微調滑塊 ***

let myChart;

// 簡單的線性插值函數
function interpolate(x, x0, y0, x1, y1) {
    if (x1 === x0) return y0; 
    return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

// 根據目標 Phon 值生成平滑曲線數據
function getInterpolatedCurveData(targetPhon) {
    const phons = Object.keys(equalLoudnessData).map(Number).sort((a, b) => a - b);
    
    if (equalLoudnessData[targetPhon]) {
        return equalLoudnessData[targetPhon].map(d => ({ x: d.freq, y: d.dbSPL }));
    }

    let lowerPhon = phons[0];
    let upperPhon = phons[phons.length - 1];

    for (const phon of phons) {
        if (phon < targetPhon) {
            lowerPhon = phon;
        } else if (phon > targetPhon) {
            upperPhon = phon;
            break;
        }
    }
    
    if (targetPhon < lowerPhon) lowerPhon = upperPhon;
    if (targetPhon > upperPhon) upperPhon = lowerPhon;


    const lowerData = equalLoudnessData[lowerPhon];
    const upperData = equalLoudnessData[upperPhon];

    if (!lowerData || !upperData || lowerPhon === upperPhon) {
         return lowerData.map(d => ({ x: d.freq, y: d.dbSPL }));
    }

    const interpolatedData = [];
    for (let i = 0; i < lowerData.length; i++) {
        const freq = lowerData[i].freq;
        const dbSPL = interpolate(
            targetPhon,
            lowerPhon, lowerData[i].dbSPL,
            upperPhon, upperData[i].dbSPL
        );
        interpolatedData.push({ x: freq, y: dbSPL });
    }
    return interpolatedData;
}


// 根據聽力圖 (dB HL) 數據生成聽損閾值線 (dB SPL)
function getHearingThresholdData() {
    const dataPoints = [];
    
    hlSliders.forEach(slider => {
        const freq = parseInt(slider.dataset.freq);
        const dbHL = parseInt(slider.value);
        const retspl = RETSPL_CONSTANTS[freq];

        // 核心轉換：dB SPL = dB HL + RETSPL 
        const dbSPL = dbHL + retspl;
        dataPoints.push({ x: freq, y: dbSPL });
    });

    const sortedData = dataPoints.sort((a, b) => a.x - b.x);
    if (sortedData.length > 0) {
        // 擴展曲線至 20Hz 和 20kHz 以確保連續性
        const minFreqPoint = { x: 20, y: sortedData[0].y }; 
        const maxFreqPoint = { x: 20000, y: sortedData[sortedData.length - 1].y }; 
        return [minFreqPoint, ...sortedData, maxFreqPoint];
    }
    return [];
}


// *** [更新] 助聽器增益 (Gain) 計算：使用微調滑塊的值 ***
function getHearingAidGainData() {
    const gainDataPoints = [];
    
    gainAdjustSliders.forEach(slider => { // *** 使用增益微調滑塊 ***
        const freq = parseInt(slider.dataset.freq);
        // 直接讀取滑塊值作為增益
        const gain = parseFloat(slider.value);
        
        gainDataPoints.push({ x: freq, y: gain });
    });

    const sortedData = gainDataPoints.sort((a, b) => a.x - b.x);
    if (sortedData.length > 0) {
        const minFreqPoint = { x: 20, y: sortedData[0].y }; 
        const maxFreqPoint = { x: 20000, y: sortedData[sortedData.length - 1].y }; 
        return [minFreqPoint, ...sortedData, maxFreqPoint];
    }
    return [];
}


// 計算補償後的目標響度曲線
function getCompensatedLoudnessData(currentPhon) {
    const originalLoudnessData = getInterpolatedCurveData(currentPhon);
    const gainData = getHearingAidGainData(); 
    
    const compensatedData = [];

    // 提取主要頻率的增益值 (需要將增益數據點轉換為易於查詢的 Map)
    const gainMap = new Map(gainData.map(d => [d.x, d.y]));

    originalLoudnessData.forEach(point => {
        const freq = point.x;
        let gain = 0;
        
        // 獲取當前頻率的增益，透過插值處理非 HL 點
        const knownFrequencies = Array.from(gainMap.keys()).sort((a, b) => a - b);
            
        if (gainMap.has(freq)) {
            gain = gainMap.get(freq);
        } else if (freq < knownFrequencies[0]) {
            gain = gainMap.get(knownFrequencies[0]);
        } else if (freq > knownFrequencies[knownFrequencies.length - 1]) {
            gain = gainMap.get(knownFrequencies[knownFrequencies.length - 1]);
        } else {
            let lower = knownFrequencies[0];
            let upper = knownFrequencies[knownFrequencies.length - 1];
            
            for (const kFreq of knownFrequencies) {
                if (kFreq <= freq) {
                    lower = kFreq;
                } else {
                    upper = kFreq;
                    break;
                }
            }
            if (lower !== upper) {
                gain = interpolate(freq, lower, gainMap.get(lower), upper, gainMap.get(upper));
            } else {
                gain = gainMap.get(lower);
            }
        }
        
        // SPL_comp = SPL_original - Gain
        const compensatedSPL = point.y - gain;

        compensatedData.push({ x: freq, y: compensatedSPL });
    });
    
    return compensatedData;
}


// *** [新增] 根據 HL 點自動設定增益微調滑塊的初始值 ***
function setInitialGainValues() {
    hlSliders.forEach(hlSlider => {
        const freq = hlSlider.dataset.freq;
        const dbHL = parseInt(hlSlider.value);
        // 50% 法則計算基礎增益
        const initialGain = (dbHL * 0.5).toFixed(1); 
        
        const gainSlider = document.getElementById(`gain${freq}`);
        const gainValSpan = document.getElementById(`gain${freq}Val`);
        
        if (gainSlider) {
            // 設定滑塊的值和顯示
            gainSlider.value = initialGain;
            gainValSpan.textContent = initialGain;

            // 調整滑塊的 min/max 範圍，以基礎增益為中心進行微調
            const center = parseFloat(initialGain);
            gainSlider.min = Math.max(0, center - 30); // 最小不低於 0 dB
            gainSlider.max = Math.min(60, center + 30); // 最大不超過 60 dB
        }
    });
}


// 初始化圖表
function initChart(initialPhon) {
    // 初始化增益滑塊的值 (必須在圖表初始化前執行)
    setInitialGainValues();

    const loudnessData = getInterpolatedCurveData(initialPhon);
    const thresholdData = getHearingThresholdData();
    const gainData = getHearingAidGainData(); 
    const compensatedData = getCompensatedLoudnessData(initialPhon);

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: `響度: ${initialPhon} Phon (正常耳)`,
                    data: loudnessData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    yAxisID: 'y' 
                },
                {
                    label: `模擬聽損閾值 (0 Phon)`,
                    data: thresholdData,
                    borderColor: '#c0392b',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.2,
                    pointRadius: 5,
                    pointStyle: 'circle',
                    yAxisID: 'y' 
                },
                {
                    label: `補償後響度: ${initialPhon} Phon`,
                    data: compensatedData,
                    borderColor: '#f1c40f', // 黃色
                    borderDash: [8, 4],
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    hidden: !aidToggle.checked,
                    yAxisID: 'y' 
                },
                {
                    label: `助聽器增益量 (手動調整)`,
                    data: gainData,
                    borderColor: '#4caf50', 
                    borderWidth: 2,
                    fill: false,
                    tension: 0.2,
                    pointRadius: 4,
                    hidden: !aidToggle.checked, 
                    yAxisID: 'y1' 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '人耳等響度曲線與聽損模擬',
                    font: { size: 18 }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) { return `頻率: ${context[0].parsed.x} Hz`; },
                        label: function(context) {
                            const datasetIndex = context.datasetIndex;
                            const value = context.parsed.y.toFixed(1);
                            if (datasetIndex === 3) { // 增益線是第 4 個數據集 (Index 3)
                                return `增益: ${value} dB`;
                            } else { 
                                return `${datasetIndex === 0 ? '正常SPL' : datasetIndex === 1 ? '閾值SPL' : '補償SPL'}: ${value} dB SPL`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'logarithmic',
                    title: { display: true, text: '頻率 (Hz)' },
                    min: 20, max: 20000,
                    ticks: {
                        callback: function(value, index, values) {
                            const logValues = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
                            if (logValues.includes(value)) { return value; }
                            return null;
                        }
                    },
                    grid: { display: true, lineWidth: 0.5, color: 'rgba(0, 0, 0, 0.1)' }
                },
                y: { // 左側：dB SPL (響度/閾值/補償)
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: '聲壓級 (dB SPL)' },
                    min: 0, max: 120,
                    ticks: { stepSize: 10 },
                    grid: { display: true, lineWidth: 0.5, color: 'rgba(0, 0, 0, 0.1)' }
                },
                y1: { // 右側：dB 增益 (助聽器)
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: '助聽器增益 (dB)' },
                    min: 0, 
                    max: 80, 
                    grid: { 
                        drawOnChartArea: false, 
                        lineWidth: 0.5,
                        color: 'rgba(76, 175, 80, 0.5)'
                    }
                }
            }
        }
    });
}

// 更新圖表數據
function updateChart() {
    const currentPhon = parseInt(loudnessSlider.value);
    currentPhonSpan.textContent = currentPhon;

    // 1. 更新正常響度曲線
    const loudnessData = getInterpolatedCurveData(currentPhon);
    myChart.data.datasets[0].data = loudnessData;
    myChart.data.datasets[0].label = `響度: ${currentPhon} Phon (正常耳)`;

    // 2. 更新聽損閾值數據 (HL)
    const thresholdData = getHearingThresholdData();
    myChart.data.datasets[1].data = thresholdData;
    
    // 3. 更新補償後的響度曲線 (黃線)
    const compensatedData = getCompensatedLoudnessData(currentPhon);
    myChart.data.datasets[2].data = compensatedData;
    myChart.data.datasets[2].label = `補償後響度: ${currentPhon} Phon`;
    myChart.data.datasets[2].hidden = !aidToggle.checked;
    
    // 4. 更新增益曲線 (綠線)
    const gainData = getHearingAidGainData();
    myChart.data.datasets[3].data = gainData;
    myChart.data.datasets[3].hidden = !aidToggle.checked;
    myChart.data.datasets[3].label = `助聽器增益量 (手動調整)`; // 更新標籤以反映手動調整

    myChart.update();
}

// 監聽所有 HL 滑塊變動
hlSliders.forEach(slider => {
    slider.addEventListener('input', () => {
        const freq = slider.dataset.freq;
        document.getElementById(`hl${freq}Val`).textContent = slider.value;
        
        // 當 HL 改變時，自動重新計算並設定初始增益滑塊的值
        setInitialGainValues(); 
        
        updateChart();
    });
});

// *** [新增] 監聽所有增益微調滑塊變動 ***
gainAdjustSliders.forEach(slider => {
    slider.addEventListener('input', () => {
        const freq = slider.dataset.freq;
        // 顯示微調後的精確值
        document.getElementById(`gain${freq}Val`).textContent = parseFloat(slider.value).toFixed(1);
        updateChart();
    });
});


// 事件監聽器 (響度滑塊和助聽器開關)
loudnessSlider.addEventListener('input', updateChart);
aidToggle.addEventListener('change', updateChart);

// 首次加載頁面時初始化圖表
document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化 HL 滑塊的數值顯示
    hlSliders.forEach(slider => {
         const freq = slider.dataset.freq;
         document.getElementById(`hl${freq}Val`).textContent = slider.value;
    });
    
    // 2. 初始化增益滑塊的數值顯示（必須在 initChart 之前）
    setInitialGainValues();
    
    initChart(parseInt(loudnessSlider.value));
});