document.addEventListener('DOMContentLoaded', () => {
    const storedResults = localStorage.getItem('valeri_results');
    const storedInputs = localStorage.getItem('valeri_inputs');

    if (!storedResults || !storedInputs) {
        alert('Keine Berechnungsdaten gefunden. Bitte berechnen Sie zuerst.');
        window.location.href = 'index.html';
        return;
    }

    const results = JSON.parse(storedResults);
    const inputs = JSON.parse(storedInputs);

    populateTable(inputs, results);
});

function formatEUR(value) {
    if (value === null || value === undefined) return '--';
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value) + ' €';
}

function formatKWH(value) {
    if (value === null || value === undefined) return '--';
    return new Intl.NumberFormat('de-DE').format(value) + ' kWh/a';
}

function formatPercent(value) {
    if (value === null || value === undefined) return '--';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value) + ' %';
}

function formatYears(value) {
    if (value === null || value === undefined) return '--';
    return new Intl.NumberFormat('de-DE').format(value) + ' Jahre';
}

function formatWACC(valueString) {
    if (!valueString) return '--';
    // '6.50%' -> '6,50 %', screenshot uses space before %
    return valueString.replace('.', ',').replace('%', ' %');
}

function populateTable(inputs, results) {
    const cases = ['likely', 'worst', 'best'];
    
    // Map data
    const rows = [
        {
            label: 'Investitionsauszahlung',
            formatter: formatEUR,
            values: cases.map(c => inputs.scenarios[c].invest)
        },
        {
            label: 'Jährliche Energieeinsparung bzw. Energieversorgung',
            formatter: formatKWH,
            values: cases.map(c => inputs.scenarios[c].savings)
        },
        {
            label: 'Jährliche Energiepreisschwankung',
            formatter: formatPercent,
            values: cases.map(c => inputs.scenarios[c].p_inc)
        },
        {
            label: 'Jährliche Preisschwankungsrate für relevante Dienstleistungen und Materialien',
            formatter: formatPercent,
            values: cases.map(c => inputs.scenarios[c].s_inc)
        },
        {
            label: 'Laufzeit der Investition T',
            formatter: formatYears,
            values: cases.map(c => inputs.scenarios[c].life)
        },
        {
            label: 'Kalkulationszinssatz r',
            formatter: formatWACC,
            values: cases.map(c => inputs.scenarios[c].wacc_disp)
        },
        {
            label: 'r<sub>eq</sub> (wenn r = WACC)',
            formatter: formatPercent,
            values: cases.map(c => inputs.scenarios[c].req)
        },
        {
            label: 'r<sub>debt</sub> (wenn r = WACC)',
            formatter: formatPercent,
            values: cases.map(c => inputs.scenarios[c].rdebt)
        },
        {
            label: 'NPV',
            formatter: formatEUR,
            values: cases.map(c => results.cases[c].npv),
            isHighlight: true
        }
    ];

    const tbody = document.getElementById('szenario-tbody');
    tbody.innerHTML = '';

    rows.forEach(row => {
        const tr = document.createElement('tr');
        if (row.isHighlight) tr.className = 'highlight-row';
        
        let html = `<td>${row.label}</td>`;
        row.values.forEach(val => {
            html += `<td>${row.formatter(val)}</td>`;
        });
        
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

function downloadScenarioTableCSV() {
    const table = document.getElementById('szenario-tabelle');
    if (!table) return;

    let csv = [];
    const escapeCSV = (str) => {
        // Remove HTML tags for subscript
        str = str.replace(/<[^>]+>/g, '');
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    csv.push("Tabelle 8 - Ergebnisse - Einstellungen und Ergebnisse der Szenarioanalyse;;;");
    csv.push(";;;");

    for (const row of table.rows) {
        const rowData = [];
        for (const cell of row.cells) {
            let text = cell.innerText.trim();
            // innerText doesn't keep sub tags nicely, but CSS rendering does. 
            // In CSV, innerText is fine since it drops HTML.
            text = text.replace(/\n/g, ' '); // remove newlines in header "Wahrscheinlich-<br>ster Fall"
            rowData.push(escapeCSV(text));
        }
        csv.push(rowData.join(';'));
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join('\n'); // Ensure UTF-8 with BOM for Excel
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "szenarioanalyse_tabelle.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escapeLaTeX(text) {
    if (!text) return '';
    return text
        // Remove HTML tags
        .replace(/<[^>]+>/g, '')
        // Escape special LaTeX characters
        .replace(/\\/g, '\\textbackslash ')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/~/g, '\\textasciitilde ')
        .replace(/\^/g, '\\textasciicircum ')
        // Format specific units
        .replace(/€/g, '\\euro{}')
        // Clean up newlines if any
        .replace(/\n/g, ' ');
}

function downloadScenarioTableLaTeX() {
    const table = document.getElementById('szenario-tabelle');
    if (!table) return;

    let latex = [];
    
    // LaTeX preamble/table environment
    latex.push('% Requires in preamble: \\usepackage{booktabs} \\usepackage{eurosym} \\usepackage{tabularx}');
    latex.push('\\begin{table}[htbp]');
    latex.push('  \\centering');
    latex.push('  \\caption{Ergebnisse -- Einstellungen und Resultate der Szenarioanalyse}');
    latex.push('  \\label{tab:szenario_ergebnisse}');
    latex.push('  \\small');
    latex.push('  \\begin{tabularx}{\\textwidth}{Y r r r}');
    latex.push('    \\toprule');
    
    // Headers (hardcoded to match user requested schema)
    latex.push('    \\textbf{Einstellparameter} & \\textbf{Wahrsch. Fall} & \\textbf{Worst-Case} & \\textbf{Best-Case} \\\\');
    latex.push('    \\midrule');

    // Body
    for (let i = 1; i < table.rows.length; i++) {
        const row = table.rows[i];
        const rowData = [];
        for (let j = 0; j < row.cells.length; j++) {
            let cellText = escapeLaTeX(row.cells[j].innerHTML);
            
            // Format specific math labels after escaping
            if (j === 0) {
                if (cellText === 'req (wenn r = WACC)') {
                    cellText = '$r_{\\mathrm{eq}}$ (wenn $r = \\mathrm{WACC}$)';
                } else if (cellText === 'rdebt (wenn r = WACC)') {
                    cellText = '$r_{\\mathrm{debt}}$ (wenn $r = \\mathrm{WACC}$)';
                }
            }
            
            rowData.push(cellText);
        }
        
        // Add a midrule before the last row (NPV)
        if (i === table.rows.length - 1) {
            latex.push('    \\midrule');
            rowData[0] = '\\textbf{' + rowData[0] + '}'; // highlight NPV label
        }
        
        // Use explicit string joining to ensure the backslashes are preserved correctly
        latex.push('    ' + rowData.join(' & ') + ' \\\\');
    }

    latex.push('    \\bottomrule');
    latex.push('  \\end{tabularx}');
    latex.push('\\end{table}');

    const texContent = 'data:text/plain;charset=utf-8,' + encodeURIComponent(latex.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', texContent);
    link.setAttribute('download', 'szenarioanalyse_tabelle.tex');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
