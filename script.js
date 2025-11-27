// ISO 226:2003 等響度曲線數據 (保持不變)
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

const ctx = document.getElementById('equalLoudnessChart').getContext('2d');
const loudnessSlider = document.getElementById('loudnessSlider');
const currentPhonSpan = document.getElementById('currentPhon');

let myChart;

// 簡單的線性插值函數
function interpolate(x, x0, y0, x1, y1) {
    if (x1 === x0) return y0; // 避免除以零
    return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

// *** 修正後的函數：處理邊界和插值 ***
function getInterpolatedCurveData(targetPhon) {
    const phons = Object.keys(equalLoudnessData).map(Number).sort((a, b) => a - b);
    
    // 檢查目標 Phon 是否直接存在於數據中
    if (equalLoudnessData[targetPhon]) {
        return equalLoudnessData[targetPhon].map(d => ({ x: d.freq, y: d.dbSPL }));
    }

    let lowerPhon = phons[0];
    let upperPhon = phons[phons.length - 1];

    // 找到目標 Phon 的上下限
    for (const phon of phons) {
        if (phon < targetPhon) {
            lowerPhon = phon;
        } else if (phon > targetPhon) {
            upperPhon = phon;
            break;
        }
    }
    
    // 如果目標 Phon 小於或大於已知範圍，則使用邊界數據 (雖然 UI 限制了範圍，但這是好的防禦性程式設計)
    if (targetPhon < lowerPhon) lowerPhon = upperPhon;
    if (targetPhon > upperPhon) upperPhon = lowerPhon;


    const lowerData = equalLoudnessData[lowerPhon];
    const upperData = equalLoudnessData[upperPhon];

    if (!lowerData || !upperData || lowerPhon === upperPhon) {
         // 如果數據不夠或上下限相同（即目標在外推範圍），則返回邊界數據
         return lowerData.map(d => ({ x: d.freq, y: d.dbSPL }));
    }

    // 對每個頻率點進行線性插值
    const interpolatedData = [];
    for (let i = 0; i < lowerData.length; i++) {
        const freq = lowerData[i].freq;
        const dbSPL = interpolate(
            targetPhon,
            lowerPhon, lowerData[i].dbSPL,
            upperPhon, upperData[i].dbSPL // 由於我們使用相同的頻率點陣列，不需要額外的檢查
        );
        interpolatedData.push({ x: freq, y: dbSPL });
    }
    return interpolatedData;
}


// 初始化圖表
function initChart(initialPhon) {
    // ... (這部分保持不變)
    const data = getInterpolatedCurveData(initialPhon);

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: `響度: ${initialPhon} Phon`,
                data: data,
                borderColor: '#3498db',
                borderWidth: 3,
                fill: false,
                tension: 0.4, // 曲線平滑度
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '人耳等響度曲線 (ISO 226:2003 標準)',
                    font: {
                        size: 18
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `頻率: ${context[0].parsed.x} Hz`;
                        },
                        label: function(context) {
                            return `聲壓: ${context.parsed.y.toFixed(1)} dB SPL`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'logarithmic',
                    title: {
                        display: true,
                        text: '頻率 (Hz)'
                    },
                    min: 20,
                    max: 20000,
                    ticks: {
                        callback: function(value, index, values) {
                            const logValues = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
                            if (logValues.includes(value)) {
                                return value;
                            }
                            return null;
                        }
                    },
                    grid: {
                        display: true,
                        lineWidth: 0.5,
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '聲壓級 (dB SPL)'
                    },
                    min: 0,
                    max: 120,
                    ticks: {
                        stepSize: 10
                    },
                    grid: {
                        display: true,
                        lineWidth: 0.5,
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            }
        }
    });
}

// 更新圖表數據 (保持不變)
function updateChart() {
    const currentPhon = parseInt(loudnessSlider.value);
    currentPhonSpan.textContent = currentPhon;

    const data = getInterpolatedCurveData(currentPhon);

    myChart.data.datasets[0].data = data;
    myChart.data.datasets[0].label = `響度: ${currentPhon} Phon`;
    myChart.update();
}

// 事件監聽器 (保持不變)
loudnessSlider.addEventListener('input', updateChart);

// 首次加載頁面時初始化圖表 (保持不變)
document.addEventListener('DOMContentLoaded', () => {
    initChart(parseInt(loudnessSlider.value));
});