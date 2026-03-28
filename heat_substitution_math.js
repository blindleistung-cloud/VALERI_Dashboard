// Mathematical Engine for Heat Substitution Module

const EMISSION_FACTOR_GAS = 0.000201; // t CO2 / kWh (LHV based approx)

/**
 * Calculates the complete cash flow stream and KPIs for a single scenario.
 * @param {Object} inputs - Parsed input parameters for the scenario
 * @returns {Object} Result object containing KPIs and yearly streams
 */
function calculateHPCashflows(inputs) {
    const T = inputs.hs_life;
    const wacc = inputs.hs_wacc / 100;
    
    const streams = [];
    let netPresentValue = 0;
    let cumulativeDynamic = 0;
    let paybackPeriod = null;
    let cumulativeSimple = 0;

    // Initial Investment (t=0)
    const I0 = inputs.capex_hp + inputs.capex_el - inputs.subsidy_sub;
    
    streams.push({
        year: 0,
        gas_saved_kwh: 0,
        el_used_kwh: 0,
        gas_savings_eur: 0,
        el_costs_eur: 0,
        opex_diff_eur: 0,
        net_cashflow: -I0,
        discounted_cashflow: -I0,
        cum_discounted: -I0
    });

    netPresentValue = -I0;
    cumulativeDynamic = -I0;
    cumulativeSimple = -I0;
    let prevCumDynamic = cumulativeDynamic;

    if (cumulativeDynamic >= 0) paybackPeriod = 0;

    // Technical Constants
    const q_hp_sub = inputs.q_sub * (inputs.hp_share / 100);
    const gas_avoided_kwh = q_hp_sub / (inputs.gas_eff / 100);
    const scop_eff = inputs.scop * inputs.hp_corr;
    let el_hp_base = q_hp_sub / scop_eff;

    let total_co2_savings = 0;
    const co2_savings_annual_t = gas_avoided_kwh * EMISSION_FACTOR_GAS; // Assuming 0 CO2 for grid elect for simplified module or just assessing gas scope 1

    for (let t = 1; t <= T; t++) {
        // --- Technical Aging ---
        // Electricity demand increases over time as HP degrades by hp_deg % per year
        let el_used_t = el_hp_base * Math.pow(1 + (inputs.hp_deg / 100), t - 1);

        // --- Price Escalations ---
        let gas_price_t = inputs.gas_price * Math.pow(1 + (inputs.gas_inc / 100), t);
        let co2_price_t = inputs.co2_price * Math.pow(1 + (inputs.co2_inc / 100), t);
        
        let el_price_t = inputs.el_price * Math.pow(1 + (inputs.el_inc / 100), t);
        let grid_cost_t = inputs.grid_cost; // Assume grid flat costs don't escalate, or escalate with el_inc? We keep it static for MVP
        
        let opex_hp_t = inputs.opex_hp * Math.pow(1 + (inputs.opex_inc / 100), t);
        let opex_gas_avoid_t = inputs.opex_gas_avoid * Math.pow(1 + (inputs.opex_inc / 100), t);

        // --- Monetary Flows ---
        let gas_savings_t = gas_avoided_kwh * gas_price_t + (gas_avoided_kwh * EMISSION_FACTOR_GAS * co2_price_t);
        let el_costs_t = (el_used_t * el_price_t) + grid_cost_t;
        let opex_diff_t = opex_gas_avoid_t - opex_hp_t; // Positive if we save more gas maintenance than we spend on HP maintenance

        let net_flow_t = gas_savings_t - el_costs_t + opex_diff_t;
        let disc_flow_t = net_flow_t / Math.pow(1 + wacc, t);

        netPresentValue += disc_flow_t;
        cumulativeDynamic += disc_flow_t;
        cumulativeSimple += net_flow_t;
        total_co2_savings += co2_savings_annual_t;

        streams.push({
            year: t,
            gas_saved_kwh: gas_avoided_kwh,
            el_used_kwh: el_used_t,
            gas_savings_eur: gas_savings_t,
            el_costs_eur: el_costs_t,
            opex_diff_eur: opex_diff_t,
            net_cashflow: net_flow_t,
            discounted_cashflow: disc_flow_t,
            cum_discounted: cumulativeDynamic
        });

        // Payback Calculation
        if (paybackPeriod === null && cumulativeDynamic >= 0) {
            // Linear interpolation inside the year
            const fraction = Math.abs(prevCumDynamic) / disc_flow_t;
            paybackPeriod = (t - 1) + fraction;
        }
        prevCumDynamic = cumulativeDynamic;
    }

    return {
        kpis: {
            npv: netPresentValue,
            payback: paybackPeriod,
            capex_net: I0,
            co2_savings_total: total_co2_savings,
            co2_savings_annual: co2_savings_annual_t,
            scop_eff: scop_eff,
            q_hp_sub: q_hp_sub,
            gas_avoided_kwh: gas_avoided_kwh
        },
        streams: streams
    };
}

/**
 * Runs the engine for all 3 scenarios.
 * @param {Object} allInputs 
 * @returns {Object} 
 */
function runHeatSubstitutionEngine(allInputs) {
    return {
        inputs: allInputs,
        results: {
            likely: calculateHPCashflows(allInputs.scenarios.likely),
            worst: calculateHPCashflows(allInputs.scenarios.worst),
            best: calculateHPCashflows(allInputs.scenarios.best)
        }
    };
}
