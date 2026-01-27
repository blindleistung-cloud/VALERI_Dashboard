document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('valeri-form');
    const resetBtn = document.getElementById('reset-btn');
    const npvResult = document.getElementById('npv-result');
    const paybackResult = document.getElementById('payback-result');
    const chartContainer = document.getElementById('cashflow-table-container');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        calculateValeri();
    });

    resetBtn.addEventListener('click', () => {
        form.reset();
        npvResult.textContent = '--';
        paybackResult.textContent = '--';
        npvResult.className = 'result-value';
        chartContainer.innerHTML = '';
    });

    function calculateValeri() {
        // 1. Get Inputs
        const I0 = parseFloat(document.getElementById('investment').value);
        const E_save = parseFloat(document.getElementById('savings').value);
        const P0 = parseFloat(document.getElementById('price').value);
        const i_p = parseFloat(document.getElementById('price-increase').value) / 100;
        const discountRate = parseFloat(document.getElementById('discount').value) / 100; // r
        const T = parseInt(document.getElementById('duration').value);

        if (isNaN(I0) || isNaN(E_save) || isNaN(P0) || isNaN(T)) {
            alert('Please fill in all required fields properly.');
            return;
        }

        let totalNPV = -I0;
        let cumulativeDCF = -I0; // For payback calculation
        let paybackPeriod = null;
        let cashFlows = [];

        // 2. Calculate Cash Flows
        for (let t = 1; t <= T; t++) {
            // Annual Savings (Nominal Cash Flow)
            // CF_t = E_save * P0 * (1 + i_p)^t
            // Note: Some interpretations apply the increase starting from year 1 or year 0. 
            // Standard usually assumes price increases each year relative to the previous.
            // If P0 is price at t=0, then Price at t=1 is P0 * (1+i_p).

            const currentPrice = P0 * Math.pow(1 + i_p, t); // Price in year t
            const annualCashFlow = E_save * currentPrice; // Savings in year t

            // Discounted Cash Flow
            const dcf = annualCashFlow / Math.pow(1 + discountRate, t);

            totalNPV += dcf;
            cumulativeDCF += dcf;

            if (paybackPeriod === null && cumulativeDCF >= 0) {
                // Linear interpolation for more precise payback period
                // Previous cumulative was negative (cum_prev), current is positive (cum_curr).
                // Fraction = |cum_prev| / dcf
                const prevCum = cumulativeDCF - dcf;
                const fraction = Math.abs(prevCum) / dcf;
                paybackPeriod = (t - 1) + fraction;
            }

            cashFlows.push({
                year: t,
                price: currentPrice,
                nominal: annualCashFlow,
                discounted: dcf,
                cumulative: cumulativeDCF
            });
        }

        // 3. Display Results
        displayNPV(totalNPV);
        displayPayback(paybackPeriod, T);
        displayTable(cashFlows);
    }

    function displayNPV(value) {
        const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
        npvResult.textContent = formatted;

        if (value >= 0) {
            npvResult.className = 'result-value positive';
        } else {
            npvResult.className = 'result-value negative';
        }
    }

    function displayPayback(period, maxYears) {
        if (period === null) {
            paybackResult.textContent = `> ${maxYears} Years`;
        } else {
            // Format to 1 decimal place
            paybackResult.textContent = `${period.toFixed(1)} Years`;
        }
    }

    function displayTable(data) {
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Year</th>
                        <th>Energy Price (€)</th>
                        <th>Cash Flow (€)</th>
                        <th>Discounted (€)</th>
                        <th>Cumulative (€)</th>
                    </tr>
                </thead>
                <tbody>
        `;

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
