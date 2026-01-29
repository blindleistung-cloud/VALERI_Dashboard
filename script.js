let energyChart = null;

document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on
    const isIndexPage = document.getElementById('valeri-form') !== null;
    const isKpiPage = document.getElementById('kpi-grid') !== null || document.querySelector('.kpi-grid') !== null;
    const isComparisonPage = document.getElementById('comparisonChart') !== null;
    const isNpvCurvePage = document.getElementById('npvCurveChart') !== null;

    if (isIndexPage) {
        setupIndexPage();
        updateWACCDisplay(); // Initial WACC update
    } else if (isKpiPage) {
        setupKpiPage();
    } else if (isComparisonPage) {
        setupComparisonPage();
    } else if (isNpvCurvePage) {
        setupNPVCurvePage();
    }
});

function setupNPVCurvePage() {
    const storedResults = localStorage.getItem('valeri_results');
    if (!storedResults) {
        alert('Keine Berechnungsdaten gefunden. Bitte berechnen Sie zuerst.');
        window.location.href = 'index.html';
        return;
    }
    const results = JSON.parse(storedResults);
    initNPVCurveChart(results);
}

function initNPVCurveChart(results) {
    const ctx = document.getElementById('npvCurveChart').getContext('2d');

    // Helper to extract cumulative NPV stream (Year 0 to 15)
    const getCurveData = (scen) => {
        const stream = results.cases[scen].cashFlows;
        const points = [];
        let lastValue = 0;

        for (let t = 0; t <= 15; t++) {
            const entry = stream.find(x => x.year === t);
            if (entry) {
                lastValue = entry.cum;
                points.push(entry.cum);
            } else {
                points.push(lastValue);
            }
        }
        return points;
    };

    const dataWorst = getCurveData('worst');
    const dataLikely = getCurveData('likely');
    const dataBest = getCurveData('best');

    // Annotation Logic
    // Annotation Logic
    const getPaybackAnnotation = (scen, color, labelOffset) => {
        const pb = results.cases[scen].payback;
        if (pb === null || pb > 15) return null;

        return {
            type: 'line',
            xMin: pb,
            xMax: pb,
            borderColor: color,
            borderWidth: 1,
            borderDash: [5, 5],
            label: {
                display: true,
                content: pb.toFixed(1).replace('.', ',') + ' J',
                yValue: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                color: color,
                font: { size: 11, weight: 'bold' },
                yAdjust: labelOffset - 30, // Offset to stack above each other near the line
                padding: 4,
                position: 'center'
            }
        };
    };

    const annotations = {
        zeroLine: {
            type: 'line',
            yMin: 0,
            yMax: 0,
            borderColor: 'rgba(255, 255, 255, 0.5)',
            borderWidth: 1,
        }
    };

    // Stagger labels
    const annBest = getPaybackAnnotation('best', '#4ade80', -60);
    if (annBest) annotations.lineBest = annBest;

    const annLikely = getPaybackAnnotation('likely', '#38bdf8', -30);
    if (annLikely) annotations.lineLikely = annLikely;

    const annWorst = getPaybackAnnotation('worst', '#f87171', 0);
    if (annWorst) annotations.lineWorst = annWorst;

    const labels = Array.from({ length: 16 }, (_, i) => i);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Worst Case',
                    data: dataWorst,
                    borderColor: '#f87171',
                    backgroundColor: '#f87171',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0
                },
                {
                    label: 'Wahrscheinlich',
                    data: dataLikely,
                    borderColor: '#38bdf8',
                    backgroundColor: '#38bdf8',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    tension: 0
                },
                {
                    label: 'Best Case',
                    data: dataBest,
                    borderColor: '#4ade80',
                    backgroundColor: '#4ade80',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(context.raw);
                        },
                        title: function (tooltipItems) {
                            return 'Jahr ' + tooltipItems[0].label;
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                y: {
                    display: true,
                    title: { display: true, text: 'Kapitalwert (NPV)', color: 'rgba(255,255,255,0.5)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function (value) {
                            return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', notation: "compact" }).format(value);
                        }
                    }
                },
                x: {
                    display: true,
                    title: { display: true, text: 'Jahre nach Investition', color: 'rgba(255,255,255,0.5)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                }
            }
        }
    });
}
function setupComparisonPage() {
    const storedResults = localStorage.getItem('valeri_results');
    if (!storedResults) {
        alert('Keine Berechnungsdaten gefunden. Bitte berechnen Sie zuerst.');
        window.location.href = 'index.html';
        return;
    }
    const results = JSON.parse(storedResults);
    initComparisonChart(results);
}

function initComparisonChart(results) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');

    // Data Prep
    // Metrics: Investment (neg), Cashflow (pos), NPV (pos/neg)
    const cases = ['worst', 'likely', 'best'];
    const labels = ['Investition', 'Cashflows (disk.)', 'Kapitalwert (NPV)'];

    const getData = (scen) => {
        const d = results.cases[scen];
        // Investment is stored in inputs, but we can grab it from logic or pass it.
        // Actually, inputs are stored in results.inputs
        const invest = results.inputs.scenarios[scen].invest;
        const npv = d.npv;

        // Formula: NPV = -Invest + SumDiscountedFlows
        // => SumDiscountedFlows = NPV + Invest
        const cfDisc = npv + invest;

        return [-invest, cfDisc, npv];
    };

    const dataWorst = getData('worst');
    const dataLikely = getData('likely');
    const dataBest = getData('best');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Worst Case',
                    data: dataWorst,
                    backgroundColor: '#f87171',
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Wahrscheinlich',
                    data: dataLikely,
                    backgroundColor: '#38bdf8',
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Best Case',
                    data: dataBest,
                    backgroundColor: '#4ade80',
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // Using custom HTML legend
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(context.raw);
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function (value) {
                            return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', notation: "compact" }).format(value);
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255, 255, 255, 0.9)', font: { size: 14, weight: 'bold' } }
                }
            }
        }
    });
}

/* --- PAGE SPECIFIC LOGIC --- */

function setupIndexPage() {
    const form = document.getElementById('valeri-form');

    // Inputs Syncing
    const eqInput = document.getElementById('equity-ratio');
    if (eqInput) {
        eqInput.addEventListener('input', () => {
            let val = parseFloat(eqInput.value) || 0;
            if (val > 100) val = 100;
            document.getElementById('debt-ratio').value = 100 - val;
            updateWACCDisplay();
        });
    }

    // WACC Listeners
    document.querySelectorAll('.scenario-input').forEach(inp => {
        inp.addEventListener('input', updateWACCDisplay);
    });

    // Reset
    document.getElementById('reset-btn').addEventListener('click', () => {
        form.reset();
        if (eqInput) document.getElementById('debt-ratio').value = 50;
        updateWACCDisplay();
        document.getElementById('kpi-nav-container').style.display = 'none';

        // Clear old table
        ['likely', 'worst', 'best'].forEach(scen => {
            const elNPV = document.getElementById(`res-npv-${scen}`);
            const elPay = document.getElementById(`res-payback-${scen}`);
            if (elNPV) {
                elNPV.textContent = '--';
                elNPV.className = 'result-value';
            }
            if (elPay) elPay.textContent = '--';
        });
        document.getElementById('cashflow-table-container').innerHTML = '';
        localStorage.removeItem('valeri_inputs');
        localStorage.removeItem('valeri_results');
    });

    // Calculate
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        runCalculation();
    });

    // Check for stored inputs to restore state
    const storedInputs = localStorage.getItem('valeri_inputs');
    if (storedInputs) {
        restoreInputs(JSON.parse(storedInputs));
        runCalculation(); // Auto-run to show results
    }
}

function restoreInputs(data) {
    document.getElementById('base-price').value = data.basePrice;
    document.getElementById('equity-ratio').value = data.equity;
    document.getElementById('debt-ratio').value = data.debt;

    ['likely', 'worst', 'best'].forEach(scen => {
        const s = data.scenarios[scen];
        setVal('invest', scen, s.invest);
        setVal('subsidy', scen, s.subsidy);
        setVal('ops_cost', scen, s.ops_cost);
        setVal('other_rev', scen, s.other_rev);
        setVal('savings', scen, s.savings);
        setVal('p_inc', scen, s.p_inc);
        setVal('s_inc', scen, s.s_inc);
        setVal('life', scen, s.life);
        setVal('req', scen, s.req);
        setVal('rdebt', scen, s.rdebt);
    });
    updateWACCDisplay();
}

function setVal(param, scen, val) {
    const el = document.querySelector(`input[data-param="${param}"][data-case="${scen}"]`);
    if (el) el.value = val;
}

function runCalculation() {
    // 1. Gather Data
    const calculationData = gatherCalculationData();

    // 2. Perform Calc
    const results = performCalculations(calculationData);

    // 3. Update Index UI (Old Table)
    updateIndexTable(results);

    // 4. Save to LocalStorage for KPI Page
    localStorage.setItem('valeri_results', JSON.stringify(results));
    localStorage.setItem('valeri_inputs', JSON.stringify(calculationData));

    // 5. Show Navigation Button
    document.getElementById('kpi-nav-container').style.display = 'flex';
}

function setupKpiPage() {
    // Load Data
    const storedResults = localStorage.getItem('valeri_results');
    if (!storedResults) {
        alert('Keine Berechnungsdaten gefunden. Bitte führen Sie zuerst eine Berechnung durch.');
        window.location.href = 'index.html';
        return;
    }

    const results = JSON.parse(storedResults);

    // Init Chart
    initEnergyChart();

    // Update UI
    updateKpiDashboard(results);
}


/* --- SHARED CALCULATION LOGIC --- */

function updateWACCDisplay() {
    const eqInput = document.getElementById('equity-ratio');
    if (!eqInput) return;

    const eqRatio = parseFloat(eqInput.value) / 100;
    const debtRatio = parseFloat(document.getElementById('debt-ratio').value) / 100;

    const scenarios = ['likely', 'worst', 'best'];
    scenarios.forEach(scen => {
        const r_eq = getScenarioParam('req', scen, true);
        const r_debt = getScenarioParam('rdebt', scen, true);

        // WACC logic: inputs are percentages (e.g. 7.0), so result is percentage (e.g. 6.5)
        const wacc = (eqRatio * r_eq) + (debtRatio * r_debt);

        const el = document.getElementById(`wacc-${scen}`);
        if (el) el.textContent = wacc.toFixed(2) + '%';
    });
}

function getScenarioParam(paramName, caseName, fromDOM = true) {
    if (fromDOM) {
        const input = document.querySelector(`input[data-param="${paramName}"][data-case="${caseName}"]`);
        return input ? parseFloat(input.value) : 0;
    }
    return 0;
}

function gatherCalculationData() {
    const scenarios = ['likely', 'worst', 'best'];
    const data = {
        basePrice: parseFloat(document.getElementById('base-price').value),
        equity: parseFloat(document.getElementById('equity-ratio').value),
        debt: parseFloat(document.getElementById('debt-ratio').value),
        scenarios: {}
    };

    scenarios.forEach(scen => {
        // Collect raw values from inputs
        data.scenarios[scen] = {
            invest: getScenarioParam('invest', scen),
            subsidy: getScenarioParam('subsidy', scen),
            ops_cost: getScenarioParam('ops_cost', scen),
            other_rev: getScenarioParam('other_rev', scen),
            savings: getScenarioParam('savings', scen),
            p_inc: getScenarioParam('p_inc', scen),
            s_inc: getScenarioParam('s_inc', scen),
            life: getScenarioParam('life', scen),
            req: getScenarioParam('req', scen),
            rdebt: getScenarioParam('rdebt', scen),
            wacc_disp: document.getElementById(`wacc-${scen}`).textContent
        };
    });

    return data;
}

function performCalculations(data) {
    const results = {
        inputs: data,
        cases: {},
        chartData: {
            labels: [],
            datasets: { likely: [], worst: [], best: [] }
        }
    };

    const scenarios = ['likely', 'worst', 'best'];
    let maxLife = 0;

    scenarios.forEach(scen => {
        const sData = data.scenarios[scen];
        const life = sData.life;
        if (life > maxLife) maxLife = life;

        // WACC string is "6.50%", we need 0.065 for math
        // sData.wacc_disp is "6.50%"
        let waccVal = parseFloat(sData.wacc_disp) / 100;

        const stream = calculateNPVStream(
            sData.invest,
            sData.subsidy,
            sData.ops_cost,
            sData.other_rev,
            sData.savings,
            data.basePrice,
            sData.p_inc / 100,
            sData.s_inc / 100,
            waccVal,
            life
        );

        results.cases[scen] = {
            npv: stream.finalNPV,
            payback: stream.payback,
            life: life,
            savings: sData.savings,
            p_inc: sData.p_inc,
            cashFlows: stream.cashFlows
        };

        // Use chartPoints which now contains Annual Savings Volume
        results.chartData.datasets[scen] = stream.chartPoints;
    });

    for (let i = 1; i <= 15; i++) results.chartData.labels.push('Jahr ' + i);

    return results;
}

function calculateNPVStream(I0, Subsidy, OpsCost, OtherRev, E_save, P0, i_p, i_s, discount, T) {
    let npv = -I0 + Subsidy;
    let cumulative = -I0 + Subsidy;
    let cumDiscounted = -I0 + Subsidy;

    let paybackPeriod = null;
    let prevCumDiscounted = cumDiscounted;

    // For the chart, we now track "Annual Savings Volume in Euro"
    // This is simply: Annual Savings (kWh) * Energy Price (€/kWh)
    const chartPoints = [];
    // Note: Volume is an annual flow, so it starts at t=1 (or we can put 0 for t=0, but chart usually shows years 1-20 for flow)

    const cashFlows = [];
    cashFlows.push({ year: 0, flow: cumulative, disc: cumDiscounted, cum: cumDiscounted });

    if (cumDiscounted >= 0) paybackPeriod = 0;

    const maxCalc = 20;

    for (let t = 1; t <= maxCalc; t++) {
        let flow = 0;
        let discFlow = 0;
        let savingsVolume = 0;

        if (t <= T) {
            const price = P0 * Math.pow(1 + i_p, t);
            savingsVolume = E_save * price; // Volume: Savings €

            const costs = OpsCost * Math.pow(1 + i_s, t);
            const revs = OtherRev * Math.pow(1 + i_s, t);

            flow = savingsVolume - costs + revs;
            discFlow = flow / Math.pow(1 + discount, t);
        }

        npv += discFlow;
        cumulative += flow;
        cumDiscounted += discFlow;

        // Push Annual Savings Volume for the chart
        // If project ends, volume is null to break the line
        if (t <= T) {
            chartPoints.push(savingsVolume);
        } else {
            chartPoints.push(null);
        }

        if (t <= T) {
            cashFlows.push({
                year: t,
                flow: flow,
                disc: discFlow,
                cum: cumDiscounted
            });

            if (paybackPeriod === null && cumDiscounted >= 0) {
                // Dynamic Payback Calculation: using discounted values
                const fraction = Math.abs(prevCumDiscounted) / discFlow;
                paybackPeriod = (t - 1) + fraction;
            }
            prevCumDiscounted = cumDiscounted;
        }
    }

    return {
        finalNPV: npv,
        payback: paybackPeriod,
        chartPoints: chartPoints,
        cashFlows: cashFlows
    };
}


/* --- UI UPDATING LOGIC --- */

function updateIndexTable(results) {
    const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

    ['likely', 'worst', 'best'].forEach(scen => {
        const r = results.cases[scen];

        const elNPV = document.getElementById(`res-npv-${scen}`);
        if (elNPV) {
            elNPV.textContent = formatCurrency(r.npv);
            elNPV.className = 'result-value ' + (r.npv >= 0 ? 'positive' : 'negative');
        }

        const elPay = document.getElementById(`res-payback-${scen}`);
        if (elPay) {
            if (r.payback !== null) {
                elPay.textContent = r.payback.toFixed(1) + ' Jahre';
            } else {
                elPay.textContent = '> ' + r.life + ' Jahre';
            }
        }
    });

    // Render Cashflow Tables for all scenarios
    ['likely', 'worst', 'best'].forEach(scen => {
        const cfContainer = document.getElementById(`cashflow-table-container-${scen}`);
        if (cfContainer) {
            let html = '<table class="comparison-table"><thead><tr><th>Jahr</th><th>Cashflow</th><th>Diskontiert</th><th>Kumuliert (Disk.)</th></tr></thead><tbody>';
            results.cases[scen].cashFlows.forEach(row => {
                html += `<tr>
                    <td>${row.year}</td>
                    <td>${formatCurrency(row.flow)}</td>
                    <td>${formatCurrency(row.disc)}</td>
                    <td>${formatCurrency(row.cum)}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            cfContainer.innerHTML = html;
        }
    });
}

function updateKpiDashboard(results) {
    const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
    const formatNum = (val) => new Intl.NumberFormat('de-DE').format(val);

    const likely = results.cases.likely;
    const best = results.cases.best;
    const worst = results.cases.worst;

    document.getElementById('kpi-npv-likely').textContent = formatCurrency(likely.npv);
    document.getElementById('kpi-npv-best').textContent = formatCurrency(best.npv);
    document.getElementById('kpi-npv-worst').textContent = formatCurrency(worst.npv);

    document.getElementById('lbl-life-best').textContent = best.life;
    document.getElementById('lbl-pb-best').textContent = best.payback ? best.payback.toFixed(1) + ' Jahre' : '> ' + best.life;

    document.getElementById('lbl-life-likely').textContent = likely.life;
    document.getElementById('lbl-pb-likely').textContent = likely.payback ? likely.payback.toFixed(1) + ' Jahre' : '> ' + likely.life;

    document.getElementById('lbl-life-worst').textContent = worst.life;
    document.getElementById('lbl-pb-worst').textContent = worst.payback ? worst.payback.toFixed(1) + ' Jahre' : '> ' + worst.life;

    const setBar = (scen, role) => {
        const data = results.cases[scen];
        const pb = data.payback || 15;

        const maxScale = 15; // Chart width represents 15 years

        const pbPct = Math.min((pb / maxScale) * 100, 100);
        const lifePct = Math.min((data.life / maxScale) * 100, 100);
        const regPct = Math.min(((data.life / 2) / maxScale) * 100, 100);

        const fillEl = document.getElementById(`bar-pb-${scen}`);
        const markEl = document.getElementById(`mark-life-${scen}`);
        const regEl = document.getElementById(`mark-reg-${scen}`);

        if (fillEl) fillEl.style.width = `${pbPct}%`;
        if (markEl) markEl.style.left = `${lifePct}%`;

        if (regEl) {
            regEl.style.left = `${regPct}%`;

            // Check pass/fail (Payback <= Life/2)
            const limit = data.life / 2;
            const passes = pb <= limit;

            if (passes) {
                regEl.style.background = '#4ade80'; // Green
                regEl.title = "Konform (≤ 50% Laufzeit)";
                regEl.classList.add('reg-pass');
            } else {
                regEl.style.background = '#f87171'; // Red
                regEl.title = "Nicht konform (> 50% Laufzeit)";
                regEl.classList.add('reg-fail');
            }
        }
    };

    setBar('best'); setBar('likely'); setBar('worst');

    document.getElementById('kpi-savings').innerHTML = formatNum(likely.savings) + ' <span class="unit">kWh/a</span>';

    document.getElementById('leg-p-worst').textContent = '+' + worst.p_inc + '%';
    document.getElementById('leg-p-likely').textContent = '+' + likely.p_inc + '%';
    document.getElementById('leg-p-best').textContent = '+' + best.p_inc + '%';

    // Description Update
    const desc = `Volumen: Die angenommenen jährlichen Einsparungen in Euro für jedes Szenario, basierend auf jährlicher Energieeinsparung, Energiepreis und dessen Steigerung.`;
    const descEl = document.getElementById('chart-description');
    if (descEl) descEl.textContent = desc;

    updateChart(results.chartData);

    const inputs = results.inputs;
    const lInp = inputs.scenarios.likely;

    document.getElementById('footer-invest').textContent = formatCurrency(lInp.invest);
    document.getElementById('footer-equity').textContent = inputs.equity + '%';
    document.getElementById('footer-debt').textContent = inputs.debt + '%';

    document.getElementById('footer-req').textContent = 'Zins: ' + lInp.req.toFixed(1) + '%';
    document.getElementById('footer-rdebt').textContent = 'Zins: ' + lInp.rdebt.toFixed(1) + '%';
    document.getElementById('footer-wacc').textContent = lInp.wacc_disp;
}

function initEnergyChart() {
    const canvas = document.getElementById('energyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    energyChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(context.raw);
                        }
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            scales: {
                x: {
                    display: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                },
                y: {
                    display: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function (value) {
                            return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumSignificantDigits: 2 }).format(value);
                        }
                    }
                }
            },
            elements: {
                point: { radius: 0, hitRadius: 10, hoverRadius: 4 },
                line: { tension: 0.4, borderWidth: 2 }
            }
        }
    });
}

function updateChart(data) {
    if (!energyChart) return;

    energyChart.data.labels = data.labels;
    energyChart.data.datasets = [
        {
            label: 'Worst',
            data: data.datasets.worst,
            borderColor: '#f87171',
            borderDash: [5, 5],
            fill: false,
            borderWidth: 2
        },
        {
            label: 'Probable',
            data: data.datasets.likely,
            borderColor: '#38bdf8',
            fill: false,
            borderWidth: 3
        },
        {
            label: 'Best',
            data: data.datasets.best,
            borderColor: '#4ade80',
            borderDash: [5, 5],
            fill: false,
            borderWidth: 2
        }
    ];
    energyChart.update();
}

function exportToClipboard() {
    const element = document.getElementById('capture-area');
    html2canvas(element, { backgroundColor: '#1e293b', scale: 2 }).then(canvas => {
        canvas.toBlob(blob => {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                .then(() => alert('Dashboard in Zwischenablage kopiert!'))
                .catch(err => alert('Fehler beim Kopieren.'));
        });
    });
}

function downloadPNG() {
    const element = document.getElementById('capture-area');
    html2canvas(element, { backgroundColor: '#1e293b', scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'valeri-dashboard.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

function printView() { window.print(); }
