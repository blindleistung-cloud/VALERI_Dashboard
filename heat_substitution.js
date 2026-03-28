// heat_substitution.js

function openTab(evt, tabName) {
    if (document.body.classList.contains('report-mode')) return;

    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) tabContents[i].classList.remove("active");
    
    const tabLinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabLinks.length; i++) tabLinks[i].classList.remove("active");

    document.getElementById(tabName).classList.add("active");
    if(evt && evt.currentTarget) evt.currentTarget.classList.add("active");
}

function toggleReportMode(checkbox) {
    if (checkbox.checked) {
        document.body.classList.add('report-mode');
    } else {
        document.body.classList.remove('report-mode');
        openTab({currentTarget: document.querySelector('.tab-link')}, 'tab-ist');
    }
}

let activeCalculatedResults = null;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('hs-form');
    if (form) {
        form.addEventListener('submit', e => e.preventDefault());

        const raw = localStorage.getItem('valeri_hs_inputs');
        if (raw) {
            try { loadInputsData(JSON.parse(raw)); } catch(e) {}
        } else {
            document.querySelectorAll('input.main-input').forEach(inp => syncMirrors(inp));
        }

        form.addEventListener('input', (e) => {
            syncMirrors(e.target);
            const data = gatherInputs();
            localStorage.setItem('valeri_hs_inputs', JSON.stringify(data));
            executeCalculation();
        });

        // Trigger initial calculation
        setTimeout(() => executeCalculation(), 150);
    }
});

function syncMirrors(changedInput) {
    if (changedInput && changedInput.classList.contains('main-input')) {
        const param = changedInput.getAttribute('data-param');
        const mirrors = document.querySelectorAll(`input.likely-mirror[data-mirror="${param}"]`);
        mirrors.forEach(m => m.value = changedInput.value);
    }
}

function loadInputsData(data) {
    if (!data || !data.scenarios) return;
    const scenarios = ['likely', 'worst', 'best'];
    scenarios.forEach(scen => {
        const scenData = data.scenarios[scen];
        if (!scenData) return;
        for (const [key, value] of Object.entries(scenData)) {
            const input = document.querySelector(`input[data-param="${key}"][data-case="${scen}"]`);
            if (input) input.value = value;
        }
    });
    
    document.querySelectorAll('input.main-input').forEach(inp => syncMirrors(inp));
    executeCalculation();
}

function getVal(param, scenario) {
    const input = document.querySelector(`input[data-param="${param}"][data-case="${scenario}"]`);
    return (input && input.value !== "") ? parseFloat(input.value) : 0;
}

function gatherInputs() {
    const scenarios = ['likely', 'worst', 'best'];
    const data = { scenarios: {} };
    const paramsList = ['q_sub', 'hp_share', 'hp_capacity', 'scop', 'hp_deg', 'hp_corr',
                        'gas_eff', 'gas_price', 'gas_inc', 'co2_price', 'co2_inc',
                        'el_price', 'el_inc', 'grid_cost', 'capex_hp', 'capex_el', 
                        'subsidy_sub', 'opex_hp', 'opex_gas_avoid', 'opex_inc', 'hs_wacc', 'hs_life'];

    scenarios.forEach(scen => {
        data.scenarios[scen] = {};
        paramsList.forEach(p => {
            data.scenarios[scen][p] = getVal(p, scen);
        });
    });

    return data;
}

function executeCalculation() {
    const inputs = gatherInputs();
    if (typeof runHeatSubstitutionEngine !== 'function') return;
    
    activeCalculatedResults = runHeatSubstitutionEngine(inputs);

    if (typeof renderHSResults === 'function') {
        renderHSResults(activeCalculatedResults);
    }
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
            localStorage.setItem('valeri_hs_inputs', JSON.stringify(data));
        } catch (err) {
            alert("Fehler beim Laden der Datei: " + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}
