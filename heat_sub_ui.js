// heat_sub_ui.js

let hsEnergyChartInstance = null;
let hsDeltaChartInstance = null;
let hsCashflowChartInstance = null;
let hsSensChartInstance = null;

const fmtEUR = (v) => new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR', maximumFractionDigits:0}).format(v);
const fmtDec = (v) => new Intl.NumberFormat('de-DE', {maximumFractionDigits:1}).format(v);
const fmtInt = (v) => new Intl.NumberFormat('de-DE', {maximumFractionDigits:0}).format(v);

function renderHSResults(data) {
    const lk = data.results.likely.kpis;
    const lkIn = data.inputs.scenarios.likely;
    const lkS = data.results.likely.streams[1] || data.results.likely.streams[0]; // fallback if T=0
    const wk = data.results.worst.kpis;
    const bk = data.results.best.kpis;

    if (!lkS || isNaN(lk.npv)) return; // Prevents render error if inputs are incomplete

    // --- NARRATIVES ---
    document.getElementById('nar-ist').innerHTML = `Bestehender Gesamtwärmebedarf von ${fmtInt(lkIn.q_sub)} kWh_th/a. Bei einem Systemnutzungsgrad von ${fmtInt(lkIn.gas_eff)}% entspricht dies einem Referenz-Gasverbrauch von ${fmtInt(lkIn.q_sub / (lkIn.gas_eff/100))} kWh/a.`;
    
    document.getElementById('nar-measure').innerHTML = `Die Integration einer Wärmepumpe mit ${fmtInt(lkIn.hp_capacity)} kW_th übernimmt ${fmtDec(lkIn.hp_share)}% der Heizlast, was ${fmtInt(lk.q_hp_sub)} kWh_th/a Nutzwärme entspricht. Ein kalkulierter SCOP von ${fmtDec(lkIn.scop)} definiert die elektrische Effizienz.`;
    
    document.getElementById('nar-energy').innerHTML = `Die Maßnahme substituiert jährlich ${fmtInt(lk.gas_avoided_kwh)} kWh Erdgas. Durch den effizienten Betrieb (effektiver SCOP: ${fmtDec(lk.scop_eff)}) werden hierfür lediglich ${fmtInt(lkS.el_used_kwh)} kWh elektrische Energie benötigt.`;
    
    const year1Save = lkS.gas_savings_eur;
    const year1Cost = lkS.el_costs_eur;
    const year1Net = lkS.net_cashflow;
    document.getElementById('nar-cost').innerHTML = `Im ersten operativen Jahr führen vermiedene Gaskosten (${fmtEUR(year1Save)}) abzüglich des zusätzlichen Strombedarfs (${fmtEUR(year1Cost)}) und der OPEX-Differenzen zu einer Nettoersparnis von ${fmtEUR(year1Net)}.`;

    document.getElementById('nar-kpi').innerHTML = `Die Gesamtinvestition von ${fmtEUR(lk.capex_net)} (nach Förderung) amortisiert sich in ${lk.payback !== null ? fmtDec(lk.payback) + ' Jahren' : '> Anlagenlaufzeit'}. Über die Laufzeit von ${fmtInt(lkIn.hs_life)} Jahren entsteht ein Barwert (NPV) von ${fmtEUR(lk.npv)}.`;

    // --- KPI CARDS (Likely Only, Dominant) ---
    document.getElementById('hs-kpi-cards').innerHTML = `
        <div class="kpi-card" style="flex:1; min-width: 200px; text-align:center; padding: 2rem;">
            <p style="color:var(--text-muted); margin-bottom: 0.5rem; font-size:1.1rem;">Kapitalwert (NPV)</p>
            <div class="metric-large ${lk.npv >= 0 ? 'positive':'negative'}">${fmtEUR(lk.npv)}</div>
        </div>
        <div class="kpi-card" style="flex:1; min-width: 200px; text-align:center; padding: 2rem;">
            <p style="color:var(--text-muted); margin-bottom: 0.5rem; font-size:1.1rem;">Amortisation</p>
            <div class="metric-large" style="color:var(--text-main);">${lk.payback !== null ? fmtDec(lk.payback) + ' Jahre' : 'N/A'}</div>
        </div>
        <div class="kpi-card" style="flex:1; min-width: 200px; text-align:center; padding: 2rem;">
            <p style="color:var(--text-muted); margin-bottom: 0.5rem; font-size:1.1rem;">CO₂ Ersparnis p.a.</p>
            <div class="metric-large positive">${fmtInt(lk.co2_savings_annual)} t</div>
        </div>
    `;

    // --- SCENARIO TABLE ---
    document.getElementById('hs-scenario-table').innerHTML = `
        <thead>
            <tr><th>Szenario</th><th>NPV</th><th>Amortisation</th><th>SCOP eff.</th></tr>
        </thead>
        <tbody>
            <tr><td>Wahrscheinlich</td><td>${fmtEUR(lk.npv)}</td><td>${lk.payback!==null ? fmtDec(lk.payback) + ' J' : '-'}</td><td>${fmtDec(lk.scop_eff)}</td></tr>
            <tr><td>Worst-Case</td><td>${fmtEUR(wk.npv)}</td><td>${wk.payback!==null ? fmtDec(wk.payback) + ' J' : '-'}</td><td>${fmtDec(wk.scop_eff)}</td></tr>
            <tr><td>Best-Case</td><td>${fmtEUR(bk.npv)}</td><td>${bk.payback!==null ? fmtDec(bk.payback) + ' J' : '-'}</td><td>${fmtDec(bk.scop_eff)}</td></tr>
        </tbody>
    `;

    // --- CHARTS ---
    const chartSettings = { 
        xGrid: { display: false }, 
        yGrid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: 'rgba(255,255,255,0.8)' }
    };

    // 1. Energy Chart
    const ctxEn = document.getElementById('hsEnergyChart').getContext('2d');
    if(hsEnergyChartInstance) hsEnergyChartInstance.destroy();
    hsEnergyChartInstance = new Chart(ctxEn, {
        type: 'bar',
        data: {
            labels: ['Energie kWh/a (Jahr 1)'],
            datasets: [
                { label: 'Vermiedenes Gas', data: [lk.gas_avoided_kwh], backgroundColor: '#f87171' },
                { label: 'Nutzwärme', data: [lk.q_hp_sub], backgroundColor: '#3b82f6' },
                { label: 'Strombedarf (WP)', data: [lkS.el_used_kwh], backgroundColor: '#10b981' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels:{color:'white'} } },
            scales: {
                y: { grid: chartSettings.yGrid, ticks: chartSettings.ticks },
                x: { display: false }
            }
        }
    });

    const metricEnergyEl = document.getElementById('metric-energy');
    if (metricEnergyEl) {
        metricEnergyEl.innerHTML = `
            <div><span style="color:var(--text-muted); font-size:0.9rem;">Vermiedenes Gas:</span><br><b style="color:#f87171; font-size:1.1rem;">${fmtInt(lk.gas_avoided_kwh)} kWh/a</b></div>
            <div><span style="color:var(--text-muted); font-size:0.9rem;">Nutzwärme:</span><br><b style="color:#3b82f6; font-size:1.1rem;">${fmtInt(lk.q_hp_sub)} kWh/a</b></div>
            <div><span style="color:var(--text-muted); font-size:0.9rem;">Strombedarf WP:</span><br><b style="color:#10b981; font-size:1.1rem;">${fmtInt(lkS.el_used_kwh)} kWh/a</b></div>
        `;
    }

    // 2. Cost Delta Chart (Year 1)
    const ctxCos = document.getElementById('hsDeltaChart').getContext('2d');
    if(hsDeltaChartInstance) hsDeltaChartInstance.destroy();
    hsDeltaChartInstance = new Chart(ctxCos, {
        type: 'bar',
        data: {
            labels: ['Gas Ersparnis', 'Stromkosten', 'OPEX Diff.', 'Netto (J1)'],
            datasets: [{
                label: 'EUR',
                data: [lkS.gas_savings_eur, -lkS.el_costs_eur, lkS.opex_diff_eur, lkS.net_cashflow],
                backgroundColor: ['#10b981', '#ef4444', '#3b82f6', lkS.net_cashflow >= 0 ? '#10b981' : '#ef4444']
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: chartSettings.yGrid, ticks: chartSettings.ticks },
                x: { ticks: chartSettings.ticks, grid: { display: false } }
            }
        }
    });

    // 3. Cumulative Cashflow
    const ctxCF = document.getElementById('hsCashflowChart').getContext('2d');
    if(hsCashflowChartInstance) hsCashflowChartInstance.destroy();
    const cfLabels = data.results.likely.streams.map(s => s.year);
    const cfData = data.results.likely.streams.map(s => s.cum_discounted);
    hsCashflowChartInstance = new Chart(ctxCF, {
        type: 'line',
        data: {
            labels: cfLabels,
            datasets: [{
                label: 'Kumulierter Barwert',
                data: cfData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: chartSettings.yGrid, ticks: chartSettings.ticks },
                x: { title: {display:true, text:'Jahre', color:'rgba(255,255,255,0.7)'}, ticks: chartSettings.ticks, grid:{display:false} }
            }
        }
    });

    // 4. Sensitivity Chart (Only render if Sens tab exists and ctx is found)
    const sensEl = document.getElementById('hsSensChart');
    if (sensEl) renderHSSensitivityChart(lkIn, lk.npv);
}

function renderHSSensitivityChart(likelyInputs, baseNPV) {
    const ctx = document.getElementById('hsSensChart').getContext('2d');
    if(hsSensChartInstance) hsSensChartInstance.destroy();
    
    const tweakParams = [
        { key: 'capex_hp', label: 'Investition WP' },
        { key: 'gas_price', label: 'Gaspreis' },
        { key: 'el_price', label: 'Strompreis' },
        { key: 'scop', label: 'SCOP' }
    ];

    const labels = [];
    const lowerDeltas = [];
    const upperDeltas = [];

    tweakParams.forEach(p => {
        labels.push(p.label);
        let inputDown = JSON.parse(JSON.stringify(likelyInputs));
        inputDown[p.key] *= 0.9;
        lowerDeltas.push(calculateHPCashflows(inputDown).kpis.npv - baseNPV);
        
        let inputUp = JSON.parse(JSON.stringify(likelyInputs));
        inputUp[p.key] *= 1.1;
        upperDeltas.push(calculateHPCashflows(inputUp).kpis.npv - baseNPV);
    });

    hsSensChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: '-10% Veränderung', data: lowerDeltas, backgroundColor: '#fca5a5' },
                { label: '+10% Veränderung', data: upperDeltas, backgroundColor: '#86efac' }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'NPV Delta (€)', color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' }, ticks:{color:'white'} },
                y: { grid: { display: false }, ticks:{color:'white'} }
            }
        }
    });
}

function exportHSCsv() {
    if (!activeCalculatedResults) return;
    const formatExcel = (val) => val === null ? "" : val.toString().replace(/\./g, ',');
    
    let csv = [];
    csv.push("VALERI Report Analytics - Wärmesubstitution (Gas -> WP);;");
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
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "valeri_heat_substitution_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
