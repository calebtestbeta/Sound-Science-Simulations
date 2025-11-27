// ISO 226:2003 等響度曲線數據 (簡化版，僅為示範。實際應用需要更詳細的數據或插值計算)
// 數據結構: { phon_level: [{ freq: Hz, dbSPL: value }, ...] }
// 注意: 這些數據點是簡化的，並且僅用於視覺化說明概念。
// 實際的 ISO 226:2003 標準有更詳細的表格和插值方法。
const equalLoudnessData = {
    // 20 Phon (非常小聲)
    20: [
        { freq: 20, dbSPL: 90 }, { freq: 50, dbSPL: 65 }, { freq: 100, dbSPL: 45 },
        { freq: 200, dbSPL: 30 }, { freq: 500, dbSPL: 22 }, { freq: 1000, dbSPL: 20 },
        { freq: 2000, dbSPL: 20 }, { freq: 4000, dbSPL: 25 }, { freq: 8000, dbSPL: 40 },
        { freq: 12000, dbSPL: 60 }, { freq: 16000, dbSPL: 80 }
    ],
    // 40 Phon (小聲)
    40: [
        { freq: 20, dbSPL: 95 }, { freq: 50, dbSPL: 70 }, { freq: 100, dbSPL: 50 },
        { freq: 200, dbSPL: 35 }, { freq: 500, dbSPL: 30 }, { freq: 1000, dbSPL: 40 },
        { freq: 2000, dbSPL: 40 }, { freq: 4000, dbSPL: 45 }, { freq: 8000, dbSPL: 55 },
        { freq: 12000, dbSPL: 70 }, { freq: 16000, dbSPL: 90 }
    ],
    // 60 Phon (一般音量，參考點)
    60: [
        { freq: 20, dbSPL: 100 }, { freq: 50, dbSPL: 75 }, { freq: 100, dbSPL: 55 },
        { freq: 200, dbSPL: 40 }, { freq: 500, dbSPL: 45 }, { freq: 1000, dbSPL: 60 },
        { freq: 2000, dbSPL: 60 }, { freq: 4000, dbSPL: 60 }, { freq: 8000, dbSPL: 70 },
        { freq: 12000, dbSPL: 80 }, { freq: 16000, dbSPL: 100 }
    ],
    // 80 Phon (大聲)
    80: [
        { freq: 20, dbSPL: 105 }, { freq: 50, dbSPL: 80 }, { freq: 100, dbSPL: 60 },
        { freq: 200, dbSPL: 45 }, { freq: 500, dbSPL: 55 }, { freq: 1000, dbSPL: 80 },
        { freq: 2000, dbSPL: 80 }, { freq: 4000, dbSPL: 75 }, { freq: 8000, dbSPL: 80 },
        { freq: 12000, dbSPL: 90 }, { freq: 16000, dbSPL: 100 }
    ],
    // 90 Phon (非常大聲)
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

let myChart; // 定義 Chart 實例

// 簡單的線性插值函數，用於平滑曲線
function interpolate(x, x0, y0, x1, y1) {
    return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

// 根據目標 Phon 值生成平滑曲線數據
function getInterpolatedCurveData(targetPhon) {
    const phons = Object.keys(equalLoudnessData).map(Number).sort((a, b) => a - b);
    let lowerPhon = phons[0];
    let upperPhon = phons[phons.length - 1];

    // 找到最接近的兩個 Phon 等級數據
    for (let i = 0; i < phons.length; i++) {
        if (phons[i] <= targetPhon) {
            lowerPhon = phons[i];
        }
        if (phons[i] >= targetPhon) {
            upperPhon = phons[i];
            break;
        }
    }

    const lowerData = equalLoudnessData[lowerPhon];
    const upperData = equalLoudnessData[upperPhon];

    if (lowerPhon === targetPhon) return lowerData;
    if (upperPhon === targetPhon) return upperData;
    if (!lowerData || !upperData) return []; // 錯誤處理

    // 對每個頻率點進行插值
    const interpolatedData = [];
    for (let i = 0; i < lowerData.length; i++) {
        const freq = lowerData[i].freq;
        const dbSPL = interpolate(
            targetPhon,
            lowerPhon, lowerData[i].dbSPL,
            upperPhon, upperData[i] ? upperData[i].dbSPL : lowerData[i].dbSPL // 防止數據點不對應
        );
        interpolatedData.push({ x: freq, y: dbSPL });
    }
    return interpolatedData;
}


// 初始化圖表
function initChart(initialPhon) {
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
                            // 僅顯示主要頻率標籤
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

// 更新圖表數據
function updateChart() {
    const currentPhon = parseInt(loudnessSlider.value);
    currentPhonSpan.textContent = currentPhon;

    const data = getInterpolatedCurveData(currentPhon);

    myChart.data.datasets[0].data = data;
    myChart.data.datasets[0].label = `響度: ${currentPhon} Phon`;
    myChart.update();
}

// 事件監聽器
loudnessSlider.addEventListener('input', updateChart);

// 首次加載頁面時初始化圖表
document.addEventListener('DOMContentLoaded', () => {
    initChart(parseInt(loudnessSlider.value));
});