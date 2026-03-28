// Switch tabs
function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }

    const tabLinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].classList.remove("active");
    }

    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

let activeCalculatedResults = null;

// Add Event Listener to the form
document.addEventListener('DOMContentLoaded', () => {
    // Modify the button type in HTML dynamically or attach event listener to form
    const form = document.getElementById('hs-form');
    if (form) {
        // Override the placeholder button
        const actionContainer = document.querySelector('.form-actions');
        actionContainer.innerHTML = `<button type="submit" class="btn-primary" style="flex:2;">Berechnen & Analysieren</button>`;

        // Restore values from localStorage
        const raw = localStorage.getItem('valeri_hs_inputs');
        if (raw) {
            try {
                loadInputsData(JSON.parse(raw));
            } catch(e) {}
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            executeCalculation();
        });

        // Auto-save on input
        form.addEventListener('input', () => {
            const data = gatherInputs();
            localStorage.setItem('valeri_hs_inputs', JSON.stringify(data));
        });
    }
});

function loadInputsData(data) {
    if (!data || !data.scenarios) return;
    const scenarios = ['likely', 'worst', 'best'];
    scenarios.forEach(scen => {
        const scenData = data.scenarios[scen];
        if (!scenData) return;
        
        for (const [key, value] of Object.entries(scenData)) {
            const input = document.querySelector(`input[data-param="${key}"][data-case="${scen}"]`);
            if (input) {
                input.value = value;
            }
        }
    });
}

function exportHSConfig() {
    const data = gatherInputs();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", "valeri_hs_config.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importHSConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.scenarios) throw new Error("Ungültiges Konfigurationsformat");
            loadInputsData(data);
            
            // Save newly loaded structure to auto-save and recalculate if data populated
            localStorage.setItem('valeri_hs_inputs', JSON.stringify(data));
            alert("Parameter erfolgreich geladen.");
            
            const form = document.getElementById('hs-form');
            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            
        } catch (err) {
            alert("Fehler beim Laden der Datei: " + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = ""; // Reset input so same file can be triggered again
}

function getVal(param, scenario) {
    const input = document.querySelector(`input[data-param="${param}"][data-case="${scenario}"]`);
    return input ? parseFloat(input.value) : 0;
}

function gatherInputs() {
    const scenarios = ['likely', 'worst', 'best'];
    const data = { scenarios: {} };

    scenarios.forEach(scen => {
        data.scenarios[scen] = {
            q_sub: getVal('q_sub', scen),
            hp_share: getVal('hp_share', scen),
            hp_capacity: getVal('hp_capacity', scen),
            
            scop: getVal('scop', scen),
            hp_deg: getVal('hp_deg', scen),
            hp_corr: getVal('hp_corr', scen),
            
            gas_eff: getVal('gas_eff', scen),
            gas_price: getVal('gas_price', scen),
            gas_inc: getVal('gas_inc', scen),
            co2_price: getVal('co2_price', scen),
            co2_inc: getVal('co2_inc', scen),
            
            el_price: getVal('el_price', scen),
            el_inc: getVal('el_inc', scen),
            grid_cost: getVal('grid_cost', scen),
            
            capex_hp: getVal('capex_hp', scen),
            capex_el: getVal('capex_el', scen),
            subsidy_sub: getVal('subsidy_sub', scen),
            opex_hp: getVal('opex_hp', scen),
            opex_gas_avoid: getVal('opex_gas_avoid', scen),
            opex_inc: getVal('opex_inc', scen),
            hs_wacc: getVal('hs_wacc', scen),
            hs_life: getVal('hs_life', scen)
        };
    });

    return data;
}

function executeCalculation() {
    // 1. Gather all inputs from the grids
    const inputs = gatherInputs();

    // 2. Pass to mathematical engine (requires heat_substitution_math.js loaded)
    if (typeof runHeatSubstitutionEngine !== 'function') {
        alert("Error: Math engine not loaded.");
        return;
    }
    
    // Phase 2 completed
    activeCalculatedResults = runHeatSubstitutionEngine(inputs);

    // Call UI update function (Phase 3)
    if (typeof renderHSResults === 'function') {
        renderHSResults(activeCalculatedResults);
        
        // Find the Result tab button and trigger click to switch view
        const resultBtn = document.querySelector('.tab-link[onclick*="tab-results"]');
        if (resultBtn) resultBtn.click();
    }
}
