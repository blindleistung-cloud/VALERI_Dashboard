let mcChartInstance = null;
let lastResults = null;

// Mulberry32 PRNG
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Sample from Triangular Distribution
function randomTriangular(min, mode, max, prng) {
    if (min === max) return min;
    const u = prng();
    const c = (mode - min) / (max - min);
    
    if (u <= c) {
        return min + Math.sqrt(u * (max - min) * (mode - min));
    } else {
        return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('valeri_inputs')) {
        runMonteCarlo();
    } else {
        alert("Bitte führen Sie zuerst eine deterministische Berechnung auf dem Haupt-Dashboard aus.");
        window.location.href = 'index.html';
    }
});

function runMonteCarlo() {
    const rawInputs = localStorage.getItem('valeri_inputs');
    if (!rawInputs) return;
    const data = JSON.parse(rawInputs);

    const iterations = parseInt(document.getElementById('mc-iterations').value);
    const seed = parseInt(document.getElementById('mc-seed').value) || 42;
    const prng = mulberry32(seed);

    const s = data.scenarios;
    
    // Convert generic 3-scenario structure to min/mode/max dynamically
    const getBounds = (param) => {
        const vals = [s.best[param], s.likely[param], s.worst[param]];
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const mode = s.likely[param];
        return { min, mode, max };
    };

    const p_invest = getBounds('invest');
    const p_subsidy = getBounds('subsidy');
    const p_opscost = getBounds('ops_cost');
    const p_otherrev = getBounds('other_rev');
    const p_savings = getBounds('savings');
    const p_pinc = getBounds('p_inc');
    const p_sinc = getBounds('s_inc');
    const p_life = getBounds('life');
    const p_req = getBounds('req');
    const p_rdebt = getBounds('rdebt');

    const equityRatio = data.equity / 100;
    const debtRatio = data.debt / 100;
    const basePrice = data.basePrice;

    const npvResults = new Float64Array(iterations);
    
    for (let i = 0; i < iterations; i++) {
        const invest = randomTriangular(p_invest.min, p_invest.mode, p_invest.max, prng);
        const subsidy = randomTriangular(p_subsidy.min, p_subsidy.mode, p_subsidy.max, prng);
        const ops = randomTriangular(p_opscost.min, p_opscost.mode, p_opscost.max, prng);
        const rev = randomTriangular(p_otherrev.min, p_otherrev.mode, p_otherrev.max, prng);
        const save = randomTriangular(p_savings.min, p_savings.mode, p_savings.max, prng);
        const pinc = randomTriangular(p_pinc.min, p_pinc.mode, p_pinc.max, prng) / 100;
        const sinc = randomTriangular(p_sinc.min, p_sinc.mode, p_sinc.max, prng) / 100;
        const life_float = randomTriangular(p_life.min, p_life.mode, p_life.max, prng);
        const life = Math.round(life_float); 
        
        const req = randomTriangular(p_req.min, p_req.mode, p_req.max, prng) / 100;
        const rdebt = randomTriangular(p_rdebt.min, p_rdebt.mode, p_rdebt.max, prng) / 100;

        const wacc = (equityRatio * req) + (debtRatio * rdebt);

        // Compute one iteration NPV
        const npv = calculateNPVStreamLocal(invest, subsidy, ops, rev, save, basePrice, pinc, sinc, wacc, life);
        npvResults[i] = npv;
    }

    // Identify descriptive statistics
    npvResults.sort();
    
    let sum = 0;
    let positiveCount = 0;
    for (let i = 0; i < iterations; i++) {
        sum += npvResults[i];
        if (npvResults[i] > 0) positiveCount++;
    }

    const mean = sum / iterations;
    const min = npvResults[0];
    const max = npvResults[iterations - 1];
    const p10 = npvResults[Math.floor(iterations * 0.10)];
    const median = npvResults[Math.floor(iterations * 0.50)];
    const p90 = npvResults[Math.floor(iterations * 0.90)];
    const probPos = (positiveCount / iterations) * 100;

    lastResults = {
        iterations, seed, mean, min, max, p10, median, p90, probPos,
        raw: Array.from(npvResults)
    };

    renderMetrics(lastResults);
    renderHistogram(npvResults);
}

function renderMetrics(r) {
    const formatEUR = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
    
    const html = `
        <div class="mc-metric-card"><h4>Mittelwert</h4><div class="mc-metric-value ${r.mean>=0?'positive':'negative'}">${formatEUR(r.mean)}</div></div>
        <div class="mc-metric-card"><h4>Median (P50)</h4><div class="mc-metric-value ${r.median>=0?'positive':'negative'}">${formatEUR(r.median)}</div></div>
        <div class="mc-metric-card"><h4>P10 (Pessimistisch)</h4><div class="mc-metric-value ${r.p10>=0?'positive':'negative'}">${formatEUR(r.p10)}</div></div>
        <div class="mc-metric-card"><h4>P90 (Optimistisch)</h4><div class="mc-metric-value ${r.p90>=0?'positive':'negative'}">${formatEUR(r.p90)}</div></div>
        <div class="mc-metric-card"><h4>Minimum</h4><div class="mc-metric-value ${r.min>=0?'positive':'negative'}">${formatEUR(r.min)}</div></div>
        <div class="mc-metric-card"><h4>Maximum</h4><div class="mc-metric-value ${r.max>=0?'positive':'negative'}">${formatEUR(r.max)}</div></div>
        <div class="mc-metric-card"><h4>P(NPV > 0)</h4><div class="mc-metric-value positive">${r.probPos.toFixed(1)} %</div></div>
    `;
    document.getElementById('mc-metrics').innerHTML = html;
}

function renderHistogram(data) {
    const bins = 40;
    const min = data[0];
    const max = data[data.length - 1];
    const step = (max - min) / bins;
    
    const counts = new Array(bins).fill(0);
    const labels = new Array(bins);
    
    for (let i = 0; i < data.length; i++) {
        let idx = Math.floor((data[i] - min) / step);
        if (idx === bins) idx--; // include max boundary safely
        counts[idx]++;
    }

    for (let i = 0; i < bins; i++) {
        const binStart = min + i * step;
        const binEnd = min + (i + 1) * step;
        labels[i] = new Intl.NumberFormat('de-DE', { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }).format((binStart + binEnd) / 2);
    }

    if (mcChartInstance) {
        mcChartInstance.destroy();
    }

    const ctx = document.getElementById('mcChart').getContext('2d');
    
    // Color logic => green for bins >= 0 bounds
    const bgColors = labels.map((_, i) => (min + (i + 0.5) * step) >= 0 ? 'rgba(74, 222, 128, 0.7)' : 'rgba(248, 113, 113, 0.7)');

    mcChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Häufigkeit',
                data: counts,
                backgroundColor: bgColors,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(ctx) {
                            const i = ctx[0].dataIndex;
                            const bStart = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(min + i * step);
                            const bEnd = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(min + (i + 1) * step);
                            return `Bin: ${bStart} - ${bEnd}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Häufigkeit (Iterationen)', color: 'rgba(255,255,255,0.5)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                },
                x: {
                    title: { display: false },
                    grid: { display: false },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)', maxRotation: 45, minRotation: 45 }
                }
            }
        }
    });
}

function exportMCCSV() {
    if (!lastResults) return;
    
    const formatExcel = (val) => val.toString().replace(/\./g, ',');
    
    let csv = [];
    csv.push("VALERI Monte Carlo Simulation Ergebnisse;;");
    csv.push(`Iterationen;${lastResults.iterations};`);
    csv.push(`Seed;${lastResults.seed};`);
    csv.push(";;");
    csv.push("Deskriptive Statistik;;");
    csv.push(`Mean;${formatExcel(lastResults.mean)};\u20AC`);
    csv.push(`Median (P50);${formatExcel(lastResults.median)};\u20AC`);
    csv.push(`Min;${formatExcel(lastResults.min)};\u20AC`);
    csv.push(`Max;${formatExcel(lastResults.max)};\u20AC`);
    csv.push(`P10;${formatExcel(lastResults.p10)};\u20AC`);
    csv.push(`P90;${formatExcel(lastResults.p90)};\u20AC`);
    csv.push(`P(NPV > 0) [%];${formatExcel(lastResults.probPos)};%`);
    csv.push(";;");
    csv.push("Iteration;NPV;\u20AC");
    
    lastResults.raw.forEach((val, idx) => {
        csv.push(`${idx + 1};${formatExcel(val)};`);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "monte_carlo_ergebnisse.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Duplicated local NPV engine for Monte Carlo MVP to avoid static hosting import complexities
function calculateNPVStreamLocal(I0, Subsidy, OpsCost, OtherRev, E_save, P0, i_p, i_s, discount, T) {
    let npv = -I0 + Subsidy;
    const maxCalc = 20;
    for (let t = 1; t <= maxCalc; t++) {
        if (t <= T) {
            const price = P0 * Math.pow(1 + i_p, t);
            const savingsVolume = E_save * price;
            const costs = OpsCost * Math.pow(1 + i_s, t);
            const revs = OtherRev * Math.pow(1 + i_s, t);
            const flow = savingsVolume - costs + revs;
            const discFlow = flow / Math.pow(1 + discount, t);
            npv += discFlow;
        }
    }
    return npv;
}
