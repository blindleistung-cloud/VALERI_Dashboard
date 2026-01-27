document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('valeri-form');
    const resetBtn = document.getElementById('reset-btn');
    const chartContainer = document.getElementById('cashflow-table-container');

    // Inputs for WACC
    const equityRatioInput = document.getElementById('equity-ratio');
    const debtRatioInput = document.getElementById('debt-ratio');

    // Auto-calculate debt ratio
    equityRatioInput.addEventListener('input', () => {
        let val = parseFloat(equityRatioInput.value);
        if (isNaN(val)) val = 0;
        if (val > 100) val = 100;
        debtRatioInput.value = 100 - val;
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        calculateScenarios();
    });

    resetBtn.addEventListener('click', () => {
        form.reset();
        // Reset specific values that might not be cleared by form.reset() standard behavior if necessary
        document.getElementById('equity-ratio').dispatchEvent(new Event('input'));

        // Clear results
        ['likely', 'worst', 'best'].forEach(scenario => {
            document.getElementById(`res-npv-${scenario}`).textContent = '--';
            document.getElementById(`res-npv-${scenario}`).className = 'result-value';
            document.getElementById(`res-payback-${scenario}`).textContent = '--';
            document.getElementById(`wacc-${scenario}`).textContent = '--';
        });
        chartContainer.innerHTML = '';
    });

    function calculateScenarios() {
        // Scenarios
        const scenarios = ['likely', 'worst', 'best'];
        const results = {};

        // 1. Get Common Inputs
        const Seq = parseFloat(equityRatioInput.value) / 100;
        const Sdebt = parseFloat(debtRatioInput.value) / 100;
        const P0 = parseFloat(document.getElementById('base-price').value);

        // 2. Loop through scenarios
        scenarios.forEach(caseName => {
            // Get WACC inputs for this case
            const req = parseFloat(document.querySelector(`.scenario-input[data-param="req"][data-case="${caseName}"]`).value) / 100;
            const rdebt = parseFloat(document.querySelector(`.scenario-input[data-param="rdebt"][data-case="${caseName}"]`).value) / 100;

            // Calculate WACC
            // r = Seq * req + Sdebt * rdebt
            const wacc = (Seq * req) + (Sdebt * rdebt);

            // Display WACC
            document.getElementById(`wacc-${caseName}`).textContent = (wacc * 100).toFixed(2) + '%';

            // Get Project Params for this case
            const I0 = parseFloat(document.querySelector(`.scenario-input[data-param="invest"][data-case="${caseName}"]`).value);
            const Subsidy = parseFloat(document.querySelector(`.scenario-input[data-param="subsidy"][data-case="${caseName}"]`).value) || 0;
            const OpsCost = parseFloat(document.querySelector(`.scenario-input[data-param="ops_cost"][data-case="${caseName}"]`).value) || 0;
            const OtherRev = parseFloat(document.querySelector(`.scenario-input[data-param="other_rev"][data-case="${caseName}"]`).value) || 0;

            const E_save = parseFloat(document.querySelector(`.scenario-input[data-param="savings"][data-case="${caseName}"]`).value);
            const i_p = parseFloat(document.querySelector(`.scenario-input[data-param="p_inc"][data-case="${caseName}"]`).value) / 100;
            const i_s = parseFloat(document.querySelector(`.scenario-input[data-param="s_inc"][data-case="${caseName}"]`).value) / 100;
            const T = parseInt(document.querySelector(`.scenario-input[data-param="life"][data-case="${caseName}"]`).value);

            // Calculate NPV and Payback
            const res = calculateNPV(I0, Subsidy, OpsCost, OtherRev, E_save, P0, i_p, i_s, wacc, T);
            results[caseName] = res;

            // Update Result UI
            updateResultUI(caseName, res.npv, res.payback, T);
        });

        // 3. Show Table/Chart for Likely Case
        displayTable(results['likely'].cashFlows);
    }

    function calculateNPV(I0, Subsidy, OpsCost, OtherRev, E_save, P0, i_p, i_s, discountRate, T) {
        // Initial Cash Flow (t=0)
        // Investment is negative, Subsidy is positive
        const CF0 = -I0 + Subsidy;

        let totalNPV = CF0;
        let cumulativeDCF = CF0;
        let paybackPeriod = null;
        let cashFlows = [];

        // Add Year 0 to table data
        cashFlows.push({
            year: 0,
            price: P0,
            nominal: CF0,
            discounted: CF0,
            cumulative: cumulativeDCF
        });

        if (cumulativeDCF >= 0) {
            paybackPeriod = 0;
        }

        for (let t = 1; t <= T; t++) {
            // 1. Energy Savings (escalated by energy price increase)
            const currentEnergyPrice = P0 * Math.pow(1 + i_p, t);
            const savingsFlow = E_save * currentEnergyPrice;

            // 2. Annual Operating Costs (escalated by service price increase)
            const currentOpsCost = OpsCost * Math.pow(1 + i_s, t);

            // 3. Other Annual Revenues (escalated by service price increase)
            const currentOtherRev = OtherRev * Math.pow(1 + i_s, t);

            // Net Annual Cash Flow
            const annualCashFlow = savingsFlow - currentOpsCost + currentOtherRev;

            // Discounted Cash Flow
            const dcf = annualCashFlow / Math.pow(1 + discountRate, t);

            totalNPV += dcf;
            cumulativeDCF += dcf;

            if (paybackPeriod === null && cumulativeDCF >= 0) {
                const prevCum = cumulativeDCF - dcf;
                const fraction = Math.abs(prevCum) / dcf;
                paybackPeriod = (t - 1) + fraction;
            }

            cashFlows.push({
                year: t,
                price: currentEnergyPrice,
                nominal: annualCashFlow,
                discounted: dcf,
                cumulative: cumulativeDCF
            });
        }

        return { npv: totalNPV, payback: paybackPeriod, cashFlows: cashFlows };
    }

    function updateResultUI(scenario, npv, payback, maxYears) {
        const npvEl = document.getElementById(`res-npv-${scenario}`);
        const paybackEl = document.getElementById(`res-payback-${scenario}`);

        // NPV
        const formattedNPV = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(npv);
        npvEl.textContent = formattedNPV;
        npvEl.className = 'result-value ' + (npv >= 0 ? 'positive' : 'negative');

        // Payback
        if (payback === null) {
            paybackEl.textContent = `> ${maxYears} Jahre`;
        } else {
            paybackEl.textContent = `${payback.toFixed(1)} Jahre`;
        }
    }

    function displayTable(data) {
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Jahr</th>
                        <th>Energiepreis (€)</th>
                        <th>Zahlungsstrom (€)</th>
                        <th>Diskontiert (€)</th>
                        <th>Kumuliert (€)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Limit to first 15 years for display if list is very long, or show all? 
        // Showing all for now, assuming T isn't huge.
        data.forEach(row => {
            html += `
                <tr>
                    <td>${row.year}</td>
                    <td>${row.price.toFixed(4)}</td>
                    <td>${row.nominal.toFixed(2)}</td>
                    <td>${row.discounted.toFixed(2)}</td>
                    <td>${row.cumulative.toFixed(2)}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        chartContainer.innerHTML = html;
    }
});
