let hsCashflowChartInstance = null;
let hsEnergyChartInstance = null;
let hsSensChartInstance = null;

function renderHSResults(data) {
    // Reveal containers
    document.getElementById("hs-results-placeholder").style.display = "none";
    document.getElementById("hs-charts-container").style.display = "block";
    document.getElementById("hs-kpi-cards").style.display = "flex"; 
    document.getElementById("hs-kpi-cards").style.flexWrap = "wrap"; 

    document.getElementById("hs-sens-placeholder").style.display = "none";
    document.getElementById("hs-sens-container").style.display = "block";

    document.getElementById("hs-export-placeholder").style.display = "none";
    document.getElementById("hs-export-container").style.display = "flex";

    const fmtEUR = (v) => new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR', maximumFractionDigits:0}).format(v);
    const fmtDec = (v) => new Intl.NumberFormat('de-DE', {maximumFractionDigits:1}).format(v);

    // 1. Render KPI Cards
    const kpiHTML = ['likely', 'worst', 'best'].map(scen => {
        const k = data.results[scen].kpis;
        let colorTheme = 'var(--glass-bg)';
        let titleColor = 'var(--text-main)';
        if(scen === 'likely') titleColor = 'var(--primary-color)';
        if(scen === 'worst') titleColor = '#f87171';
        if(scen === 'best') titleColor = '#4ade80';

        return `
            <div class="kpi-card" style="flex: 1; min-width: 250px; border-top: 3px solid ${titleColor};">
                <h3 style="color:${titleColor}; text-transform:capitalize;">${scen === 'likely' ? 'Wahrscheinlich' : scen}</h3>
                <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
                        <span style="color:var(--text-muted); font-size: 0.85rem;">Kapitalwert (NPV)</span>
                        <span class="metric-large ${k.npv >= 0 ? 'positive' : 'negative'}" style="font-size: 1.2rem;">${fmtEUR(k.npv)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
                        <span style="color:var(--text-muted); font-size: 0.85rem;">Amortisation</span>
                        <span style="font-weight: 600;">${k.payback !== null ? fmtDec(k.payback) + ' Jahre' : '> Laufzeit'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <span style="color:var(--text-muted); font-size: 0.85rem;">Effektiver SCOP / CO₂ p.a.</span>
                        <span style="font-weight: 600;">${fmtDec(k.scop_eff)} / -${fmtDec(k.co2_savings_annual)} t</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById("hs-kpi-cards").innerHTML = kpiHTML;

    // 2. Render Stacked Cashflow (using 'likely' scenario)
    renderHSCashflowChart(data.results.likely);

    // 3. Render Energy Balance
    renderHSEnergyChart(data.results.likely.kpis);

    // 4. Render Sensitivity Tornado
    renderHSSensitivityChart(data.inputs.scenarios.likely);
}

function renderHSCashflowChart(likelyResult) {
    const ctx = document.getElementById('hsCashflowChart').getContext('2d');
    if (hsCashflowChartInstance) hsCashflowChartInstance.destroy();

    // Data structures
    const labels = likelyResult.streams.map(s => s.year === 0 ? '0 (Invest)' : `Jahr ${s.year}`);
    const dataGas = likelyResult.streams.map(s => s.gas_savings_eur); // positive
    const dataOpex = likelyResult.streams.map(s => s.opex_diff_eur); // can be positive or negative
    const dataEl = likelyResult.streams.map(s => -s.el_costs_eur); // negative
    const dataInvest = likelyResult.streams.map(s => s.year === 0 ? s.net_cashflow : 0); // negative
    const dataCum = likelyResult.streams.map(s => s.cum_discounted);

    hsCashflowChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Kumulierter barwertiger Cashflow',
                    data: dataCum,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: 'Investition',
                    data: dataInvest,
                    backgroundColor: '#f59e0b',
                    stack: 'Stack 0'
                },
                {
                    label: 'Gaseinsparung (inkl. CO2)',
                    data: dataGas,
                    backgroundColor: '#4ade80',
                    stack: 'Stack 0'
                },
                {
                    label: 'OPEX Differenz',
                    data: dataOpex,
                    backgroundColor: '#3b82f6',
                    stack: 'Stack 0'
                },
                {
                    label: 'Stromkosten',
                    data: dataEl,
                    backgroundColor: '#ef4444',
                    stack: 'Stack 0'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            label += new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(context.raw);
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                },
                y: {
                    stacked: true,
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

function renderHSEnergyChart(kpis) {
    const ctx = document.getElementById('hsEnergyChart').getContext('2d');
    if (hsEnergyChartInstance) hsEnergyChartInstance.destroy();

    const gas_avoided = kpis.gas_avoided_kwh;
    const el_used = kpis.q_hp_sub / kpis.scop_eff;

    hsEnergyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Energiebilanz (Referenzjahr)'],
            datasets: [
                {
                    label: 'Vermiedenes Gas (kWh)',
                    data: [gas_avoided],
                    backgroundColor: '#f87171'
                },
                {
                    label: 'Nutzwärme (kWh)',
                    data: [kpis.q_hp_sub],
                    backgroundColor: '#3b82f6'
                },
                {
                    label: 'Eingesetzter Strom (kWh)',
                    data: [el_used],
                    backgroundColor: '#4ade80'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + new Intl.NumberFormat('de-DE').format(context.raw.toFixed(0));
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: 'rgba(255,255,255,0.7)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: 'rgba(255,255,255,0.7)' },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderHSSensitivityChart(likelyInputs) {
    const ctx = document.getElementById('hsSensChart').getContext('2d');
    if (hsSensChartInstance) hsSensChartInstance.destroy();

    // Baseline 
    const baseNPV = calculateHPCashflows(likelyInputs).kpis.npv;

    // Parameters to tweak by 10%
    const tweakParams = [
        { key: 'capex_hp', label: 'Investition WP' },
        { key: 'gas_price', label: 'Gaspreis' },
        { key: 'el_price', label: 'Strompreis' },
        { key: 'scop', label: 'SCOP' },
        { key: 'q_sub', label: 'Wärmebedarf' }
    ];

    const labels = [];
    const lowerDeltas = [];
    const upperDeltas = [];

    // Tweak logic
    tweakParams.forEach(p => {
        labels.push(p.label);

        // Copy -10%
        let inputDown = JSON.parse(JSON.stringify(likelyInputs));
        inputDown[p.key] = inputDown[p.key] * 0.9;
        let npvDown = calculateHPCashflows(inputDown).kpis.npv;
        
        // Copy +10%
        let inputUp = JSON.parse(JSON.stringify(likelyInputs));
        inputUp[p.key] = inputUp[p.key] * 1.1;
        let npvUp = calculateHPCashflows(inputUp).kpis.npv;

        // Deltas relative to base
        lowerDeltas.push(npvDown - baseNPV);
        upperDeltas.push(npvUp - baseNPV);
    });

    hsSensChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '-10% Veränderung',
                    data: lowerDeltas,
                    backgroundColor: '#fca5a5'
                },
                {
                    label: '+10% Veränderung',
                    data: upperDeltas,
                    backgroundColor: '#86efac'
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label + ': ';
                            let num = context.raw;
                            let sign = num > 0 ? '+' : '';
                            label += sign + new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num) + ' NPV';
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Änderung des NPV (€)', color: 'rgba(255,255,255,0.7)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'rgba(255,255,255,0.7)' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.7)' }
                }
            }
        }
    });

}

function exportHSCsv() {
    if (!activeCalculatedResults) return;
    const formatExcel = (val) => val === null ? "" : val.toString().replace(/\./g, ',');
    
    let csv = [];
    csv.push("Wärmesubstitution (Gas -> WP) Ergebnisse;;");
    
    // Scenarios header
    csv.push("KPIs;Wahrscheinlich;Worst-Case;Best-Case");
    
    const lk = activeCalculatedResults.results.likely.kpis;
    const wk = activeCalculatedResults.results.worst.kpis;
    const bk = activeCalculatedResults.results.best.kpis;

    csv.push(`NPV (\u20AC);${formatExcel(lk.npv)};${formatExcel(wk.npv)};${formatExcel(bk.npv)}`);
    csv.push(`Payback (Jahre);${formatExcel(lk.payback)};${formatExcel(wk.payback)};${formatExcel(bk.payback)}`);
    csv.push(`Effektiver SCOP;${formatExcel(lk.scop_eff)};${formatExcel(wk.scop_eff)};${formatExcel(bk.scop_eff)}`);
    csv.push(`CO2 Einsparung p.a. (t);${formatExcel(lk.co2_savings_annual)};${formatExcel(wk.co2_savings_annual)};${formatExcel(bk.co2_savings_annual)}`);
    csv.push(`Substituierte Wärme (kWh);${formatExcel(lk.q_hp_sub)};${formatExcel(wk.q_hp_sub)};${formatExcel(bk.q_hp_sub)}`);
    
    csv.push(";;");
    csv.push("Cashflow (Wahrscheinlichster Fall);;");
    csv.push("Jahr;Invest (\u20AC);Gas-Einsparung (\u20AC);Stromkosten (\u20AC);OPEX-Diff (\u20AC);Netto Cashflow (\u20AC);Kumuliert (\u20AC)");
    
    activeCalculatedResults.results.likely.streams.forEach(s => {
        csv.push(`${s.year};${s.year===0?formatExcel(s.net_cashflow):0};${formatExcel(s.gas_savings_eur)};${formatExcel(s.el_costs_eur)};${formatExcel(s.opex_diff_eur)};${formatExcel(s.net_cashflow)};${formatExcel(s.cum_discounted)}`);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "valeri_heat_substitution.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportHSLatex() {
    if (!activeCalculatedResults) return;
    
    const fmtEUR = (v) => new Intl.NumberFormat('de-DE', {style:'decimal', maximumFractionDigits:0}).format(v) + ' \\euro{}';
    const fmtDec = (v) => new Intl.NumberFormat('de-DE', {maximumFractionDigits:1}).format(v);
    const fmtYr = (v) => v !== null ? fmtDec(v) + ' Jahre' : '> Laufzeit';
    
    const lk = activeCalculatedResults.results.likely.kpis;
    const wk = activeCalculatedResults.results.worst.kpis;
    const bk = activeCalculatedResults.results.best.kpis;

    let latex = [];
    latex.push('% Requires in preamble: \\usepackage{booktabs} \\usepackage{eurosym} \\usepackage{tabularx}');
    latex.push('\\begin{table}[htbp]');
    latex.push('  \\centering');
    latex.push('  \\caption{Ergebnisse -- Wärmesubstitution (Gas zu WP)}');
    latex.push('  \\label{tab:heat_sub_ergebnisse}');
    latex.push('  \\small');
    latex.push('  \\begin{tabularx}{\\textwidth}{Y r r r}');
    latex.push('    \\toprule');
    latex.push('    \\textbf{Kennzahl} & \\textbf{Wahrsch. Fall} & \\textbf{Worst-Case} & \\textbf{Best-Case} \\\\');
    latex.push('    \\midrule');
    
    // Core metrics
    latex.push(`    Substituierte Wärme & ${fmtDec(lk.q_hp_sub)} kWh/a & ${fmtDec(wk.q_hp_sub)} kWh/a & ${fmtDec(bk.q_hp_sub)} kWh/a \\\\`);
    latex.push(`    Effektiver SCOP & ${fmtDec(lk.scop_eff)} & ${fmtDec(wk.scop_eff)} & ${fmtDec(bk.scop_eff)} \\\\`);
    latex.push(`    CO2-Einsparung p.a. & ${fmtDec(lk.co2_savings_annual)} t & ${fmtDec(wk.co2_savings_annual)} t & ${fmtDec(bk.co2_savings_annual)} t \\\\`);
    latex.push(`    Amortisationszeit & ${fmtYr(lk.payback)} & ${fmtYr(wk.payback)} & ${fmtYr(bk.payback)} \\\\`);
    
    latex.push('    \\midrule');
    latex.push(`    \\textbf{NPV} & \\textbf{${fmtEUR(lk.npv)}} & \\textbf{${fmtEUR(wk.npv)}} & \\textbf{${fmtEUR(bk.npv)}} \\\\`);
    
    latex.push('    \\bottomrule');
    latex.push('  \\end{tabularx}');
    latex.push('\\end{table}');

    const texContent = 'data:text/plain;charset=utf-8,' + encodeURIComponent(latex.join('\n'));
    const link = document.createElement("a");
    link.setAttribute("href", texContent);
    link.setAttribute("download", "valeri_heat_substitution.tex");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

