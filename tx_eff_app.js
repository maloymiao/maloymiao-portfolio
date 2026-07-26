let chartInstance = null;

// Initialize layout event listeners on load
document.addEventListener('DOMContentLoaded', () => {
    // === ENTER-KEY NAVIGATION MODULE ===
    const inputFields = Array.from(document.querySelectorAll('input, select'));
    inputFields.forEach((field, index) => {
        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Stop the form from submitting early
                const nextField = inputFields[index + 1];
                if (nextField && nextField.tagName !== 'BUTTON') {
                    nextField.focus(); // Jump cursor to the next field box
                    if (nextField.tagName === 'INPUT') nextField.select(); // Pre-select text for quick overwrites
                } else {
                    // If we reached the end of the input fields, click the generate button automatically
                    document.getElementById('transformerForm').requestSubmit();
                }
            }
        });
    });
    // ================================================

    const form = document.getElementById('transformerForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            calculateAndPlot();
        });
    }
    
    const stdRuleElement = document.getElementById('standardRule');
    if (stdRuleElement) {
        stdRuleElement.addEventListener('change', calculateAndPlot);
    }

    toggleCustomPfField();
    toggleAnalysisMode();
});

function calculateAndPlot() {
    const s_rating_kva = parseFloat(document.getElementById('capacity').value);
    const s_rating_va = s_rating_kva * 1000;
    const p_iron = parseFloat(document.getElementById('ironLoss').value);
    let p_copper_fl = parseFloat(document.getElementById('copperLoss').value);
    const regulatory_std = document.getElementById('standardRule').value;
    
    const pfPreset = document.getElementById('powerFactorPreset').value;
    const pf = (pfPreset === "CUSTOM") ? parseFloat(document.getElementById('powerFactor').value) : parseFloat(pfPreset);

    // READ THE NEW DYNAMIC DIAGNOSTIC FIELD VARIABLES
    const analysisMode = document.getElementById('analysisMode').value;
    let presentLoadKva = 0;
    
    if (analysisMode === "FIELD_AUDIT") {
        const agingMultiplier = parseFloat(document.getElementById('assetAge').value);
        // Calibrates full load copper losses upward to model real-world winding aging thermal resistances
        p_copper_fl = p_copper_fl * agingMultiplier;
        
        // Grab real-time demand string safely, handle blanks gracefully as 0
        const loadInput = document.getElementById('presentLoadKva').value;
        presentLoadKva = loadInput === "" ? 0 : parseFloat(loadInput);
    }

    // 1. Mandatory Data Integrity Validation Check (Synced to the new Min = 1 Limit rule)
    if (
        isNaN(s_rating_kva) || isNaN(p_iron) || isNaN(p_copper_fl) || isNaN(pf) ||
        s_rating_kva < 1 || p_iron < 1 || p_copper_fl < 1 || pf <= 0
    ) {
        alert("🚨 Input Error Detected:\n\n• Fields cannot be left completely blank.\n• Capacity and Loss values must be valid numbers equal to or greater than 1.");
        clearDisplayOutput();
        return;
    }

    // 2. Dynamic Regulatory Boundary Compliance Evaluation Check
    let base_max_iron = 0;
    let base_max_copper = 0;
    let standard_label = "";
    let iron_tolerance = 1.0; 
    let total_loss_tolerance = 1.0;

    const citationLink = document.getElementById('standardCitationLink');
    const summaryText = document.getElementById('standardSummaryText');

    if (regulatory_std === "IEC_TIER2") {
        standard_label = "IEC 60076-20 Tier 2";
        base_max_iron = s_rating_kva * 1.55; 
        base_max_copper = s_rating_kva * 11.2;
        iron_tolerance = 1.15;        // IEC allows +15% on component losses
        total_loss_tolerance = 1.10;  // IEC caps total loss deviation at +10%
        
        if (citationLink) {
            citationLink.href = "https://taishantransformer.com";
            citationLink.textContent = "IEC 60076-20 Efficiency Standard Specifications";
        }
        if (summaryText) {
            summaryText.textContent = "This standard defines strict global eco-design energy efficiency limits. It enforces low maximum allowable limits for both core (no-load) and winding (load) losses to reduce environmental carbon footprints across modern electricity distribution networks.";
        }
    } else if (regulatory_std === "IEEE_C57") {
        standard_label = "IEEE C57.12.00 Base";
        base_max_iron = s_rating_kva * 2.75;
        base_max_copper = s_rating_kva * 15.0;
        iron_tolerance = 1.10;        // IEEE limits No-Load core drift to +10%
        total_loss_tolerance = 1.06;  // IEEE limits combined total loss deviation to +6%
        
        if (citationLink) {
            citationLink.href = "https://ieee.org";
            citationLink.textContent = "IEEE C57.12.00 Standard Baseline Requirements";
        }
        if (summaryText) {
            summaryText.textContent = "This foundational IEEE specification establishes standard consensus engineering requirements for liquid-immersed and dry-type distribution equipment. It provides realistic industrial loss thresholds and test guidelines for standard power grids.";
        }
    }

    // Calculate maximum absolute ceilings incorporating official code tolerances
    const max_allowed_iron = base_max_iron * iron_tolerance;
    const max_allowed_total = (base_max_iron + base_max_copper) * total_loss_tolerance;
    const current_total_losses = p_iron + p_copper_fl;

    const agingMultiplier = analysisMode === "FIELD_AUDIT" ? parseFloat(document.getElementById('assetAge').value) : 1.0;
    const originalCopperLoss = parseFloat(document.getElementById('copperLoss').value);

    // Evaluate parameters against the standard buffers
    let compliance_violations = [];

    if (p_iron > max_allowed_iron) {
        compliance_violations.push(`• Core No-Load Loss (${p_iron}W) exceeds the ${standard_label} maximum acceptable limit of ${Math.round(max_allowed_iron)}W (Base: ${Math.round(base_max_iron)}W + Standard Tolerance Buffer applied).`);
    }
    
    if (current_total_losses > max_allowed_total) {
        const base_total = base_max_iron + base_max_copper;
        if (analysisMode === "FIELD_AUDIT" && agingMultiplier > 1.0) {
            const pctIncrease = Math.round((agingMultiplier - 1.0) * 100);
            compliance_violations.push(`• Combined System Loss (${Math.round(current_total_losses)}W) exceeds the ${standard_label} total loss cap of ${Math.round(max_allowed_total)}W (Base Limit: ${Math.round(base_total)}W).\n  [Diagnosis: The original build metadata was compliant, but your operational running age (+${pctIncrease}% copper deterioration) has degraded active grid efficiency beyond legal standard tolerances.]`);
        } else {
            compliance_violations.push(`• Combined Total Losses (${Math.round(current_total_losses)}W) exceed the ${standard_label} allowable package ceiling limit of ${Math.round(max_allowed_total)}W.`);
        }
    }

    // Trigger context-aware tolerance compliance warnings
    if (compliance_violations.length > 0) {
        const proceed = confirm(`⚠️ Regulatory Compliance Warning!\n\nThe parameters entered violate compliance and tolerance thresholds defined under ${standard_label}:\n\n${compliance_violations.join("\n\n")}\n\nDo you want to ignore this asset warning and plot the operational curve anyway?`);
        if (!proceed) {
            clearDisplayOutput();
            return;
        }
    }

        // 3. Core Mathematical Calculation for Optimal Points
    let optimal_load_fraction = p_copper_fl > 0 ? Math.sqrt(p_iron / p_copper_fl) : 0;
    const optimal_load_pct = optimal_load_fraction * 100;
    const optimal_load_kva = s_rating_kva * optimal_load_fraction;

    const max_output_power = optimal_load_fraction * s_rating_va * pf;
    const max_copper_loss = Math.pow(optimal_load_fraction, 2) * p_copper_fl; 
    const max_total_losses = p_iron + max_copper_loss;
    const max_efficiency = max_output_power > 0 ? (max_output_power / (max_output_power + max_total_losses)) * 100 : 0;

    // Render text metrics summary panel
    document.getElementById('maxEffVal').textContent = max_efficiency.toFixed(2);
    document.getElementById('maxEffLoad').textContent = optimal_load_pct.toFixed(2);
    document.getElementById('maxEffKva').textContent = optimal_load_kva.toFixed(2);
    document.getElementById('peakSummary').style.display = 'block';

    // CALCULATE ACTIVE REAL-TIME HEAT WASTE
    const wastedPowerRow = document.getElementById('activeWastedPowerRow');
    let current_field_heat_loss = 0;

    if (analysisMode === "FIELD_AUDIT" && presentLoadKva > 0) {
        const current_iron_input = parseFloat(document.getElementById('ironLoss').value) || 0;
        const current_copper_input = parseFloat(document.getElementById('copperLoss').value) || 0;
        const current_aging_select = parseFloat(document.getElementById('assetAge').value) || 1.0;
        
        const adjusted_full_load_copper = current_copper_input * current_aging_select;
        const x_field = presentLoadKva / s_rating_kva;
        const current_copper_loss = Math.pow(x_field, 2) * adjusted_full_load_copper;
        
        current_field_heat_loss = current_iron_input + current_copper_loss;
        
        if (wastedPowerRow) {
            document.getElementById('activeLossVal').textContent = Math.round(current_field_heat_loss).toLocaleString();
            wastedPowerRow.style.display = 'block';
        }
    } else {
        if (wastedPowerRow) wastedPowerRow.style.display = 'none';
    }

    // DYNAMIC CRASH-PROOF INSIGHT GENERATOR LOGIC
    const conclusionBoxElement = document.getElementById('engineeringConclusionBox');
    const dynamicTextElement = document.getElementById('conclusionText');

    if (dynamicTextElement) {
        let profileGuidance = "";

        if (analysisMode === "FIELD_AUDIT") {
            const agingFactorSelected = parseFloat(document.getElementById('assetAge').value);
            const activeLoadPct = (presentLoadKva / s_rating_kva) * 100;
            const deviationFromPeak = Math.abs(activeLoadPct - optimal_load_pct);
            
            let ageCommentary = "";
            if (agingFactorSelected === 1.0) ageCommentary = "The winding thermal profile shows no significant age-related degradation yet.";
            else if (agingFactorSelected === 1.05) ageCommentary = "Winding degradation is within acceptable normal parameters for mid-life assets, showing a mild 5% increase in internal resistance.";
            else if (agingFactorSelected === 1.12) ageCommentary = "<strong>Warning:</strong> Significant internal insulation degradation and winding stress detected (+12% Copper Resistance Aging Factor), indicating a higher thermal dissipation rate than nameplate specifications.";
            else if (agingFactorSelected === 1.20) ageCommentary = "<strong>Critical Alert:</strong> Severe insulation aging and conductor resistance scaling (+20%) detected. Thermal aging parameters are high.";

            let loadingCommentary = "";
            if (activeLoadPct === 0) {
                loadingCommentary = "The active operational field load is currently unassigned or running completely at no-load.";
            } else if (deviationFromPeak <= 10) {
                loadingCommentary = `Your active operational load of <strong>${activeLoadPct.toFixed(1)}%</strong> is running optimally close to your transformer's maximum efficiency sweet spot of <strong>${optimal_load_pct.toFixed(1)}%</strong>. This represents a highly efficient system network configuration with minimum active waste.`;
            } else if (activeLoadPct < optimal_load_pct) {
                loadingCommentary = `Your active operational load of <strong>${activeLoadPct.toFixed(1)}%</strong> leaves this transformer underutilized. While running below the peak point of <strong>${optimal_load_pct.toFixed(1)}%</strong> keeps copper winding losses low, constant core iron losses are dominating your efficiency balance, meaning you are paying for unused grid overhead capacity.`;
            } else {
                loadingCommentary = `Your active operational load of <strong>${activeLoadPct.toFixed(1)}%</strong> has pushed past your transformer's peak efficiency point of <strong>${optimal_load_pct.toFixed(1)}%</strong>. Operating in this zone dramatically forces up squared copper heating losses (I²R), which compounds with age to cause severe thermal hotspots.`;
            }

            const coolingTypeSelected = document.getElementById('coolingType').value;
            let maintenanceRecommendation = "";

            if (coolingTypeSelected === "OIL_FILLED") {
                maintenanceRecommendation = "Because this is a liquid-immersed unit, tracking dielectric fluid health is paramount. If your continuous running load causes thermal excursions, prioritize conducting an <strong>Oil Analysis (DGA Dissolved Gas Test)</strong>. This screens for fault hydrocarbons, mapping active tracking arcs or paper insulation winding breakdown inside the tank.";
            } else {
                maintenanceRecommendation = "As a dry-type air-cooled installation, thermal management depends entirely on atmospheric convection and surface dissipation. Prioritize organizing an <strong>Insulation Resistance (Megger / Polarization Index) test</strong> to track winding varnish integrity. Additionally, inspect the physical enclosure to clean airborne dust accumulations from cooling vents and verify that forced-air ventilation fan lines are cycling correctly.";
            }

            profileGuidance = `
                <strong>Operational Condition Summary:</strong><br>
                • ${ageCommentary}<br>
                • ${loadingCommentary}<br>
                • <strong>Active Power Loss:</strong> Under your present operating load, this transformer is continuously dissipating <strong>${Math.round(current_field_heat_loss).toLocaleString()} Watts</strong> of power directly into the atmosphere as pure structural heat waste.
                <br><br>
                <strong>Substation Lifecycle Assessment:</strong> For an aging asset operating in service for multiple years, stabilizing core and coil hot-spot temperatures is crucial to check exponential insulation material aging. 
                <br><br>
                ${maintenanceRecommendation}
            `;
        } else {
            let designTypeText = "";
            if (optimal_load_pct < 65) {
                designTypeText = `This unit achieves its optimal peak performance at a moderate loading threshold of <strong>${optimal_load_pct.toFixed(1)}%</strong>. This operating characteristic aligns perfectly with standard <strong>Distribution Transformers</strong>, which are strategically engineered to maximize all-day energy efficiency under wildly fluctuating residential or commercial load profiles.`;
            } else {
                designTypeText = `This unit achieves its peak performance at a high loading capacity threshold of <strong>${optimal_load_pct.toFixed(1)}%</strong>. This configuration is typical of bulk <strong>Power Transformers</strong>, which are designed to sit directly on transmission grid networks operating continuously at or near full rated capacity.`;
            }

            profileGuidance = `
                ${designTypeText}
                <br><br>
                <strong>Operational Strategy:</strong> To minimize active thermal dissipation and maximize utility asset longevity, target normal running demands close to this sweet spot. Pushing continuous operation significantly beyond this peak dramatically increases squared copper heating losses (I²R), degrading internal insulation material and accelerating aging.
            `;
        }

        dynamicTextElement.innerHTML = profileGuidance;
    }
    
    if (conclusionBoxElement) {
        conclusionBoxElement.style.display = 'block';
    }

        // 4. Safe mathematical loop generation of base steps from 10% to 100%
    const baseSteps = [];
    for (let loadVal = 10; loadVal <= 100; loadVal += 10) {
        baseSteps.push(loadVal);
    }
    
    let plotPoints = baseSteps.map(pct => ({ pct: pct, isPeak: false, isCurrentRealTime: false }));
    
    if (optimal_load_pct >= 10 && optimal_load_pct <= 100) {
        plotPoints.push({ pct: optimal_load_pct, isPeak: true, isCurrentRealTime: false });
    }

    if (analysisMode === "FIELD_AUDIT" && presentLoadKva > 0) {
        const presentLoadPct = (presentLoadKva / s_rating_kva) * 100;
        if (presentLoadPct >= 10 && presentLoadPct <= 100) {
            plotPoints.push({ pct: presentLoadPct, isPeak: false, isCurrentRealTime: true });
        }
    }
    
    plotPoints.sort((a, b) => a.pct - b.pct);

    const tableBody = document.querySelector('#dataTable tbody');
    if (tableBody) {
        tableBody.innerHTML = '';
    }

    const chartLabels = [];
    const factoryChartData = []; 
    const fieldChartData = [];   

    plotPoints.forEach(point => {
        const x = point.pct / 100;
        const load_va = x * s_rating_va;
        const output_power = load_va * pf;
        
        const copper_loss_factory = Math.pow(x, 2) * parseFloat(document.getElementById('copperLoss').value);
        const total_losses_factory = p_iron + copper_loss_factory;
        const efficiency_factory = output_power > 0 ? (output_power / (output_power + total_losses_factory)) * 100 : 0;
        
        const copper_loss_field = Math.pow(x, 2) * p_copper_fl;
        const total_losses_field = p_iron + copper_loss_field;
        const efficiency_field = output_power > 0 ? (output_power / (output_power + total_losses_field)) * 100 : 0;

        if (tableBody) {
            const row = document.createElement('tr');
            const activeEff = (analysisMode === "FIELD_AUDIT") ? efficiency_field : efficiency_factory;
            if (point.isPeak) row.className = 'highlight';
            if (point.isCurrentRealTime) row.style.backgroundColor = '#fef3c7'; 
            
            let loadingLabel = point.pct.toFixed(1) + '%';
            if (point.isPeak) loadingLabel = '✨ Max Peak: ' + loadingLabel;
            if (point.isCurrentRealTime) loadingLabel = '⚡ Active Field Load: ' + loadingLabel;

            row.innerHTML = `
                <td>${loadingLabel}</td>
                <td>${Math.round(load_va).toLocaleString()} VA</td>
                <td>${p_iron.toFixed(1)} W</td>
                <td>${copper_loss_field.toFixed(1)} W</td>
                <td>${activeEff.toFixed(3)}%</td>
            `;
            tableBody.appendChild(row);
        }

        chartLabels.push(point.pct);
        factoryChartData.push(efficiency_factory);
        fieldChartData.push(efficiency_field);
    });

    drawNativeGraph(plotPoints, factoryChartData, fieldChartData, analysisMode);
}

function drawNativeGraph(points, factoryEfficiencies, fieldEfficiencies, analysisMode) {
    const canvas = document.getElementById('efficiencyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
    canvas.width = parentWidth > 100 ? parentWidth : 700; 
    canvas.height = 350;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const paddingLeft = 95;
    const paddingRight = 140; // Increased to create a right margin for a clean chart legend
    const paddingTop = 30;
    const paddingBottom = 50;

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    // Combine datasets to calculate optimal relative bounding grids
    const allEffs = factoryEfficiencies.concat(fieldEfficiencies);
    const minEff = Math.min(...allEffs);
    const maxEff = Math.max(...allEffs);
    const effRange = maxEff - minEff === 0 ? 1 : (maxEff - minEff) * 1.2;
    const yMinBound = minEff - (effRange * 0.1);

    function getXPixel(pct) {
        return paddingLeft + ((pct - 10) / (100 - 10)) * graphWidth;
    }
    function getYPixel(eff) {
        return paddingTop + graphHeight - ((eff - yMinBound) / effRange) * graphHeight;
    }

    const isDark = document.body.classList.contains('dark-theme');
    ctx.strokeStyle = isDark ? '#475569' : '#e2e8f0';  
    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';    
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';

    // Horizontal Grid Lines
    for (let i = 0; i <= 4; i++) {
        const val = yMinBound + (effRange * (i / 4));
        const y = getYPixel(val);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();
        ctx.fillText(val.toFixed(2) + '%', 35, y + 4);
    }

    // Adaptive Vertical Grid Lines (Skips labels on narrow mobile viewports to prevent layout overlapping)
    const isMobileWidth = width < 480; 
    
    for (let xVal = 10; xVal <= 100; xVal += 10) {
        const x = getXPixel(xVal);
        ctx.beginPath();
        ctx.moveTo(x, paddingTop);
        ctx.lineTo(x, height - paddingBottom);
        ctx.stroke();
        
        // If on mobile layout screen, only draw text strings for even intervals (20%, 40%, 60%, 80%, 100%)
        if (isMobileWidth) {
            if (xVal % 20 === 0) {
                ctx.fillText(xVal + '%', x - 10, height - paddingBottom + 20);
            }
        } else {
            // Standard layout displays all 10% interval ticks on desktop monitors
            ctx.fillText(xVal + '%', x - 10, height - paddingBottom + 20);
        }
    }

    // LINE A DRAWING: Pristine Factory FAT Nameplate Curve (Dotted Baseline)
    ctx.strokeStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]); // Use explicit numeric array sizing to prevent text clipping
    ctx.beginPath();
    for (let index = 0; index < points.length; index++) {
        const x = getXPixel(points[index].pct);
        const y = getYPixel(factoryEfficiencies[index]);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset back to a solid line

    // LINE B DRAWING: Active/Degraded In-Service Curve (Thick Solid Blue Line)
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let index = 0; index < points.length; index++) {
        const x = getXPixel(points[index].pct);
        const y = getYPixel(fieldEfficiencies[index]);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Data Point Markers & Labels Positioning
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const x = getXPixel(point.pct);
        const activeEffList = (analysisMode === "FIELD_AUDIT") ? fieldEfficiencies : factoryEfficiencies;
        const y = getYPixel(activeEffList[index]);

        ctx.beginPath();
        if (point.isPeak) {
            ctx.arc(x, y, 7, 0, 2 * Math.PI);
            ctx.fillStyle = '#22c55e'; // Green Peak Dot
            ctx.fill();
            ctx.strokeStyle = '#15803d';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillStyle = '#166534';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText("Max: " + activeEffList[index].toFixed(2) + "%", x - 30, y - 14);
        } else if (point.isCurrentRealTime && analysisMode === "FIELD_AUDIT") {
            ctx.fillStyle = '#f59e0b'; // Amber Diamond for current active load
            ctx.fillRect(x - 5, y - 5, 10, 10);
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 5, y - 5, 10, 10);
            
            ctx.fillStyle = isDark ? '#fef3c7' : '#78350f';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText("Active Load: " + activeEffList[index].toFixed(2) + "%", x - 45, y + 18);
        } else {
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#2563eb';
            ctx.fill();
        }
    }

    // DRAW CHART LEGEND IDENTIFIER KEY LABELS
    const legendX = width - paddingRight + 15;
    ctx.textAlign = 'left';
    ctx.font = '11px sans-serif';
    ctx.fillStyle = isDark ? '#ffffff' : '#1e293b';

    // Factory Legend Key
    ctx.strokeStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(legendX, paddingTop + 10); ctx.lineTo(legendX + 20, paddingTop + 10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText("FAT Nameplate", legendX + 25, paddingTop + 13);

    // Active Field Legend Key
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(legendX, paddingTop + 30); ctx.lineTo(legendX + 20, paddingTop + 30); ctx.stroke();
    ctx.fillText(analysisMode === "FIELD_AUDIT" ? "Aged Condition" : "Active Curve", legendX + 25, paddingTop + 33);

    // Titles Axis Marks
    ctx.fillStyle = isDark ? '#ffffff' : '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Transformer Loading (%)', paddingLeft + graphWidth / 2, height - 10);

    ctx.save();
    ctx.translate(15, paddingTop + graphHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Transformer Efficiency (%)', 0, 0);
    ctx.restore();
}

function toggleCustomPfField() {
    const presetSelect = document.getElementById('powerFactorPreset');
    const customWrapper = document.getElementById('customPfWrapper');
    if (presetSelect && customWrapper) {
        if (presetSelect.value === "CUSTOM") {
            customWrapper.style.display = "block";
            document.getElementById('powerFactor').focus();
        } else {
            customWrapper.style.display = "none";
        }
        calculateAndPlot();
    }
}

function clearDisplayOutput() {
    document.getElementById('peakSummary').style.display = 'none';
    if (document.getElementById('engineeringConclusionBox')) {
        document.getElementById('engineeringConclusionBox').style.display = 'none';
    }
    const canvas = document.getElementById('efficiencyChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    const tableBody = document.querySelector('#dataTable tbody');
    if (tableBody) tableBody.innerHTML = '';
}

function toggleAnalysisMode() {
    const modeSelect = document.getElementById('analysisMode');
    const diagnosticBox = document.getElementById('fieldDiagnosticInputs');
    if (modeSelect && diagnosticBox) {
        if (modeSelect.value === "FIELD_AUDIT") {
            diagnosticBox.style.display = "block";
        } else {
            diagnosticBox.style.display = "none";
        }
        calculateAndPlot();
    }
}

window.addEventListener('resize', () => {
    const summaryPanel = document.getElementById('peakSummary');
    if (summaryPanel && summaryPanel.style.display === 'block') {
        calculateAndPlot(); 
    }
});

function toggleDashboardTheme() {
    const bodyElement = document.body;
    const btn = document.getElementById('themeToggleBtn');
    if (bodyElement && btn) {
        bodyElement.classList.toggle('dark-theme');
        if (bodyElement.classList.contains('dark-theme')) {
            btn.innerHTML = "☀️ Light Mode";
            btn.style.backgroundColor = "#475569";
            btn.style.color = "#ffffff";
        } else {
            btn.innerHTML = "🌙 Dark Mode";
            btn.style.backgroundColor = "#cbd5e1";
            btn.style.color = "#1e293b";
        }
        calculateAndPlot();
    }
}

// =========================================================================
// UNIVERSAL HIGH-FIDELITY PRINT-STREAM DOCUMENT ENGINE
// Generates data sheets matching live computer time stamps.
// =========================================================================
function generatePdfReport() {
    // A. CALCULATE DYNAMIC METRIC DATE TIME STAMPS (YYYYMMDD_HHMM)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const formattedTimeStamp = `${year}${month}${day}_${hours}${minutes}`;
    const targetFilename = `TransformerEfficiency_©maloymiao_${formattedTimeStamp}`;

    // B. Temporarily override document title to map to system file save dialog boundaries
    const originalTitle = document.title;
    document.title = targetFilename;

    // C. Build complete page-break layout styles to enforce total data printing visibility
    const printStyle = document.createElement('style');
    printStyle.id = "pdfReportPrintStyle";
    printStyle.innerHTML = `
        @media print {
            body {
                background: white !important;
                color: #000000 !important;
                padding: 15mm !important;
                font-family: sans-serif !important;
            }
            /* Hide non-printable interface button switches toggles */
            header p, #themeToggleBtn, #transformerForm button, #downloadPdfBtn {
                display: none !important;
            }
            /* Structure layout rows to unroll into standard full breadth vertical pages */
            .grid {
                display: flex !important;
                flex-direction: column !important;
                gap: 20px !important;
            }
            .card {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin-bottom: 25px !important;
                background: white !important;
                color: black !important;
                page-break-inside: avoid !important;
            }
            /* Ensure input form selections freeze text variables cleanly */
            input, select {
                border: none !important;
                background: transparent !important;
                color: black !important;
                font-weight: bold !important;
                padding: 0 !important;
                appearance: none !important;
                -webkit-appearance: none !important;
            }
            /* Enforce clean vector scaling sizes on line graphics */
            canvas {
                max-width: 100% !important;
                height: auto !important;
                display: block !important;
                margin-top: 15px !important;
            }
            /* High-Contrast Print formatting for data tables matrix rows */
            .table-container {
                page-break-before: auto !important;
                page-break-inside: auto !important;
            }
            table {
                width: 100% !important;
                border-collapse: collapse !important;
                font-size: 11px !important;
            }
            tr { page-break-inside: avoid !important; }
            th { 
                background-color: #e2e8f0 !important; 
                color: #000000 !important; 
                border-bottom: 2px solid #000000 !important;
            }
            td { border-bottom: 1px solid #cbd5e1 !important; }
            .highlight { background-color: #dcfce7 !important; font-weight: bold !important; color: #166534 !important; }
            
            /* Structural design widgets formatting layout containers */
            #standardCitationWrapper, #engineeringConclusionBox {
                background-color: #f8fafc !important;
                border: 1px solid #cbd5e1 !important;
                padding: 12px !important;
                color: black !important;
                page-break-inside: avoid !important;
                margin-top: 10px !important;
            }

            #reportFooterGroup {
                page-break-inside: avoid !important; /* Forces the signature and disclaimer to stay locked on the same single page */
                margin-top: 20px !important;
                padding-top: 10px !important;
            }
            
            /* Slightly tightens internal paper print padding dimensions to eliminate unnecessary trailing sheets */
            .card {
                margin-bottom: 15px !important;
            }

            /* Inject a clean dynamic equipment document metadata tag line at the header limits */
            body::before {
                content: "TRANSFORMER ELECTRICAL PERFORMANCE AUDIT DOSSIER\\nSystem Export Log Reference: " attr(data-filename);
                display: block;
                text-align: center;
                font-size: 10px;
                font-weight: 700;
                color: #475569;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 6px;
                margin-bottom: 25px;
            }
        }
    `;
    
    // Inject the current filename into the body element attribute so the CSS string reader can fetch it
    document.body.setAttribute('data-filename', targetFilename);
    document.head.appendChild(printStyle);

    // D. Soft Reset theme layers to protect high contrast printable outputs
    const isCurrentlyDark = document.body.classList.contains('dark-theme');
    if (isCurrentlyDark) {
        document.body.classList.remove('dark-theme');
    }

    // Force application calculations refresh to size layout boundaries sharply
    calculateAndPlot();

    // E. Execute native system browser printing streams window workflow
    setTimeout(() => {
        window.print();

        // F. Revert all dashboard configurations back to normal state profiles seamlessly
        document.title = originalTitle;
        document.body.removeAttribute('data-filename');
        const styleToRemove = document.getElementById("pdfReportPrintStyle");
        if (styleToRemove) styleToRemove.remove();

        if (isCurrentlyDark) {
            document.body.classList.add('dark-theme');
        }
        calculateAndPlot();
    }, 400);
}
