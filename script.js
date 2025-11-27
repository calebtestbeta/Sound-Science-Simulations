// ISO 226:2003 等響度曲線數據
const equalLoudnessData = {
    // 20 Phon (已包含在之前的修正版本中)
    20: [
        { freq: 20, dbSPL: 90 }, { freq: 50, dbSPL: 65 }, { freq: 100, dbSPL: 45 },
        { freq: 200, dbSPL: 30 }, { freq: 500, dbSPL: 22 }, { freq: 1000, dbSPL: 20 },
        { freq: 2000, dbSPL: 20 }, { freq: 4000, dbSPL: 25 }, { freq: 8000, dbSPL: 40 },
        { freq: 12000, dbSPL: 60 }, { freq: 16000, dbSPL: 80 }
    ],
    // 40 Phon
    40: [
        { freq: 20, dbSPL: 95 }, { freq: 50, dbSPL: 70 }, { freq: 100, dbSPL: 50 },
        { freq: 200, dbSPL: 35 }, { freq: 500, dbSPL: 30 }, { freq: 1000, dbSPL: 40 },
        { freq: 2000, dbSPL: 40 }, { freq: 4000, dbSPL: 45 }, { freq: 8000, dbSPL: 55 },
        { freq: 12000, dbSPL: 70 }, { freq: 16000, dbSPL: 90 }
    ],
    // 60 Phon
    60: [
        { freq: 20, dbSPL: 100 }, { freq: 50, dbSPL: 75 }, { freq: 100, dbSPL: 55 },
        { freq: 200, dbSPL: 40 }, { freq: 500, dbSPL: 45 }, { freq: 1000, dbSPL: 60 },
        { freq: 2000, dbSPL: 60 }, { freq: 4000, dbSPL: 60 }, { freq: 8000, dbSPL: 70 },
        { freq: 12000, dbSPL: 80 }, { freq: 16000, dbSPL: 100 }
    ],
    // 80 Phon
    80: [
        { freq: 20, dbSPL: 105 }, { freq: 50, dbSPL: 80 }, { freq: 100, dbSPL: 60 },
        { freq: 200, dbSPL: 45 }, { freq: 500, dbSPL: 55 }, { freq: 1000, dbSPL: 80 },
        { freq: 2000, dbSPL: 80 }, { freq: 4000, dbSPL: 75 }, { freq: 8000, dbSPL: 80 },
        { freq: 12000, dbSPL: 90 }, { freq: 16000, dbSPL: 100 }
    ],
    // 90 Phon
    90: [
        { freq: 20, dbSPL: 110 }, { freq: 50, dbSPL: 85 }, { freq: 100, dbSPL: 65 },
        { freq: 200, dbSPL: 50 }, { freq: 500, dbSPL: 65 }, { freq: 1000, dbSPL: 90 },
        { freq: 2000, dbSPL: 90 }, { freq: 4000, dbSPL: 85 }, { freq: 8000, dbSPL: 88 },
        { freq: 12000, dbSPL: 95 }, { freq: 16000, dbSPL: 105 }
    ]
};

// RETSPL 數據：dB HL 到 dB SPL 的轉換常數
const RETSPL_CONSTANTS = {
    500: 11.5,
    1000: 7.0,
    2000: 9.0,
    4000: 10.5
};

const ctx = document.getElementById('equalLoudnessChart').getContext('2d');
const loudnessSlider = document.getElementById('loudnessSlider');
const currentPhonSpan = document.getElementById('currentPhon');
const hlSliders = document.querySelectorAll('.hlSlider');

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

    // 加入邊界點，保持曲線延伸
    const sortedData = dataPoints.sort((a, b) => a.x - b.x);
    if (sortedData.length > 0) {
        const minFreqPoint = { x: 20, y: sortedData[0].y }; 
        const maxFreqPoint = { x: 20000, y: sortedData[sortedData.length - 1].y }; 
        return [minFreqPoint, ...sortedData, maxFreqPoint];
    }
    return [];
}

// 初始化圖表
function initChart(initialPhon) {
    const loudnessData = getInterpolatedCurveData(initialPhon);
    const thresholdData = getHearingThresholdData();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: `響度: ${initialPhon} Phon`,
                    data: loudnessData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3
                },
                // 聽損閾值線數據集
                {
                    label: `模擬聽損閾值 (0 Phon)`,
                    data: thresholdData,
                    borderColor: '#c0392b',
                    borderDash: [5, 5], 
                    borderWidth: 2,
                    fill: false,
                    tension: 0.2,
                    pointRadius: 5,
                    pointStyle: 'circle'
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
                        label: function(context) { return `${context.datasetIndex === 0 ? '聲壓' : '閾值'}: ${context.parsed.y.toFixed(1)} dB SPL`; }
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
                y: { 
                    title: { display: true, text: '聲壓級 (dB SPL)' },
                    min: 0, max: 120,
                    ticks: { stepSize: 10 },
                    grid: { display: true, lineWidth: 0.5, color: 'rgba(0, 0, 0, 0.1)' }
                }
            }
        }
    });
}

// 更新圖表數據
function updateChart() {
    const currentPhon = parseInt(loudnessSlider.value);
    currentPhonSpan.textContent = currentPhon;

    const loudnessData = getInterpolatedCurveData(currentPhon);
    myChart.data.datasets[0].data = loudnessData;
    myChart.data.datasets[0].label = `響度: ${currentPhon} Phon`;

    const thresholdData = getHearingThresholdData();
    myChart.data.datasets[1].data = thresholdData;

    myChart.update();
}

// 監聽所有 HL 滑塊變動
hlSliders.forEach(slider => {
    slider.addEventListener('input', () => {
        const freq = slider.dataset.freq;
        document.getElementById(`hl${freq}Val`).textContent = slider.value;
        updateChart();
    });
});

// 事件監聽器 (響度滑塊)
loudnessSlider.addEventListener('input', updateChart);

// 首次加載頁面時初始化圖表
document.addEventListener('DOMContentLoaded', () => {
    // 初始化 HL 滑塊的數值顯示
    hlSliders.forEach(slider => {
         const freq = slider.dataset.freq;
         document.getElementById(`hl${freq}Val`).textContent = slider.value;
    });

    initChart(parseInt(loudnessSlider.value));
});