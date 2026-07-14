// ============================================================
// DISTRIBUTION TRANSFORMER SIZING CALCULATOR
// © maloymiao
// ============================================================

// IEC 60076-1 R10 Preferred Number Series
const STANDARD_RATINGS = [
  25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200,
  250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500
];

// Extended list — includes non-IEC R10 values for local stock / vendor availability
const EXTENDED_RATINGS = [
  10, 15, 25, 30, 40, 50, 60, 75, 80, 90, 100, 120, 140, 150, 160, 200, 220, 250,
  300, 350, 400, 420, 500, 550, 600, 630, 700, 750, 800, 850, 900, 1000, 1250,
  1500, 1600, 2000, 2500
].sort((a, b) => a - b);

// IEC 60076-11 cooling class capacity multipliers
// AF cooling increases effective capacity — so required kVA is DIVIDED by multiplier
// meaning a smaller standard rating becomes sufficient
const COOLING_MULTIPLIERS = {
  AN:   1.00,  // base rating, no uplift
  AF:   1.25,  // 25% capacity uplift with forced air fans
  ANAF: 1.25,  // dual-rated, AF mode gives 25% uplift
  ONAN: 1.00,  // base rating for oil natural
  ONAF: 1.25,  // oil with forced air, 25% uplift
};

// ============================================================
// ELEMENT REFERENCES
// ============================================================
const els = {
  primaryVoltage:     document.getElementById('primaryVoltage'),
  secondaryVoltage:   document.getElementById('secondaryVoltage'),
  noLoadVoltage:      document.getElementById('noLoadVoltage'),
  voltageErrorRow:    document.getElementById('voltageErrorRow'),
  impedanceZ:         document.getElementById('impedanceZ'),
  secVFullLoad:       document.getElementById('secVFullLoad'),
  secVPermissible:    document.getElementById('secVPermissible'),
  maxDemandLoad:      document.getElementById('maxDemandLoad'),
  powerFactor:        document.getElementById('powerFactor'),
  pfErrorRow:         document.getElementById('pfErrorRow'),
  maxApparentPower:   document.getElementById('maxApparentPower'),
  transformerType:    document.getElementById('transformerType'),
  permissibleLoading: document.getElementById('permissibleLoading'),
  calcRating:         document.getElementById('calcRating'),
  ratingMode:         document.getElementById('ratingMode'),
  customRatingRow:    document.getElementById('customRatingRow'),
  customRating:       document.getElementById('customRating'),
  stdRating:          document.getElementById('stdRating'),
  loadingPct:         document.getElementById('loadingPct'),
  ratingStatus:       document.getElementById('ratingStatus'),
  resetBtn:           document.getElementById('resetBtn'),
  pdfBtn:             document.getElementById('pdfBtn'),
  logoInput:          document.getElementById('logoInput'),
  logoImg:            document.getElementById('logoImg'),
  logoPlaceholder:    document.getElementById('logoPlaceholder'),
  impedanceErrorRow:  document.getElementById('impedanceErrorRow'),
  impedanceErrorText: document.getElementById('impedanceErrorText'),
  noLoadErrorRow:  document.getElementById('noLoadErrorRow'),
  coolingClass: document.getElementById('coolingClass'),
  coolingClassLabel: document.getElementById('coolingClassLabel'),
};

// ============================================================
// HELPER — NEAREST STANDARD RATING
// ============================================================
function findNearestStandardRating(value, list) {
  for (const r of list) {
    if (r >= value) return r;
  }
  return list[list.length - 1];
}

function getMinImpedanceZ(ratedKVA) {
  if (ratedKVA <= 630)    return 4.0;
  if (ratedKVA <= 1250)   return 5.0;
  if (ratedKVA <= 2500)   return 6.0;
  if (ratedKVA <= 6300)   return 7.0;
  if (ratedKVA <= 25000)  return 8.0;
  if (ratedKVA <= 40000)  return 10.0;
  if (ratedKVA <= 63000)  return 11.0;
  if (ratedKVA <= 100000) return 12.5;
  return 12.5;
}

function checkImpedanceZ() {
  const stdRatingNum  = parseFloat(els.stdRating.textContent) || 0;
  const impedanceZNum = parseFloat(els.impedanceZ.value)      || 0;

  if (stdRatingNum <= 0 || impedanceZNum <= 0) {
    els.impedanceErrorRow.style.display = 'none';
    return;
  }

  const minZ = getMinImpedanceZ(stdRatingNum);
  if (impedanceZNum < minZ) {
    els.impedanceErrorText.innerHTML =
      `&#9888; %Z = ${impedanceZNum}% is below IEC 60076-5 minimum of ${minZ}% for ${stdRatingNum} kVA. Please increase %Z.`;
    els.impedanceErrorRow.style.display = 'grid';
  } else {
    els.impedanceErrorRow.style.display = 'none';
  }
}

// ============================================================
// MAIN CALCULATION
// ============================================================
function calculate() {

  // --- VOLTAGE INPUTS ---
  const primaryV   = parseFloat(els.primaryVoltage.value)   || 0;
  const secondaryV = parseFloat(els.secondaryVoltage.value) || 0;
  const noLoadV    = parseFloat(els.noLoadVoltage.value)    || 0;

  // Voltage validation
  if (primaryV <= 0 || secondaryV <= 0 || noLoadV <= 0) {
    els.voltageErrorRow.querySelector('.error-text').innerHTML =
      '&#9888; Voltage values must be greater than 0 kV.';
    els.voltageErrorRow.style.display = 'grid';
  } else if (primaryV > 66 || secondaryV > 33 || noLoadV > 33) {
    els.voltageErrorRow.querySelector('.error-text').innerHTML =
      '&#9888; Primary Voltage max 66 kV. Secondary / No Load Voltage max 33 kV.';
    els.voltageErrorRow.style.display = 'grid';
  } else {
    els.voltageErrorRow.style.display = 'none';
    els.voltageErrorRow.querySelector('.error-text').innerHTML =
      '&#9888; Voltage values must be greater than 0 kV.';
  }

  // No Load Voltage must exceed Secondary Rated Voltage
  if (noLoadV > 0 && secondaryV > 0 && noLoadV <= secondaryV) {
    els.noLoadErrorRow.style.display = 'grid';
  } else {
    els.noLoadErrorRow.style.display = 'none';
  }

  // Block all calculations if voltages are invalid
  if (primaryV <= 0 || secondaryV <= 0 || noLoadV <= 0 ||
      primaryV > 66 || secondaryV > 33 || noLoadV > 33 ||
      noLoadV <= secondaryV) {
    els.secVFullLoad.textContent     = '--';
    els.secVPermissible.textContent  = '--';
    els.maxApparentPower.textContent = '--';
    els.calcRating.textContent       = '--';
    els.stdRating.textContent        = '--';
    els.loadingPct.textContent       = '--';
    els.ratingStatus.textContent     = 'Enter values above to calculate';
    els.ratingStatus.className       = 'status-banner neutral';
    return;
  }

  // --- IMPEDANCE VOLTAGE %Z ---
  const impedanceZ = parseFloat(els.impedanceZ.value) || 5;

  // --- PERMISSIBLE LOADING % ---
  let permissibleLoadPct = parseFloat(els.permissibleLoading.value) || 100;
  if (permissibleLoadPct <= 0 || permissibleLoadPct > 100) {
    permissibleLoadPct = 100;
    els.permissibleLoading.value = 100;
  }

  // --- SECONDARY VOLTAGES (IEC 60076-1) ---
  // Full load: no-load voltage drops by full %Z
  const secVFullLoad = noLoadV * (1 - impedanceZ / 100);
  // Permissible loading: voltage drop proportional to loading fraction
  const secVPermissible = noLoadV * (1 - (impedanceZ / 100) * (permissibleLoadPct / 100));
  els.secVFullLoad.textContent    = secVFullLoad.toFixed(3);
  els.secVPermissible.textContent = secVPermissible.toFixed(3);

  // --- POWER FACTOR VALIDATION ---
  let pf = parseFloat(els.powerFactor.value);
  if (isNaN(pf)) pf = 1;
  if (pf > 1) {
    pf = 1;
    els.powerFactor.value = 1;
    els.powerFactor.classList.remove('default-value');
    els.pfErrorRow.style.display = 'grid';
  } else if (pf < 0.8) {
    els.pfErrorRow.style.display = 'grid';
    pf = pf < 0 ? 0.8 : pf; // show error but don't cap while typing
  } else {
    els.pfErrorRow.style.display = 'none';
  }

  // --- MAX APPARENT POWER ---
  const maxDemand       = parseFloat(els.maxDemandLoad.value) || 0;
  const maxApparentPower = pf > 0 ? maxDemand / pf : 0;
  els.maxApparentPower.textContent = maxApparentPower.toFixed(0);

  // --- CALCULATED TRANSFORMER RATING ---
  const loadFraction    = permissibleLoadPct / 100;
  const coolingMultiplier = COOLING_MULTIPLIERS[els.coolingClass.value] ?? 1.00;
  // Divide by cooling multiplier — AF cooling means a smaller nameplate rating suffices
  const calcRating = loadFraction > 0
    ? (maxApparentPower / loadFraction) / coolingMultiplier
    : 0;
  els.calcRating.textContent = calcRating.toFixed(0);

    // --- NEAREST STANDARD RATING ---
  let stdRating;
  if (els.ratingMode.value === 'custom') {
    stdRating = parseFloat(els.customRating.value) || 0;
  } else if (els.ratingMode.value === 'extended') {
    stdRating = findNearestStandardRating(calcRating, EXTENDED_RATINGS);
  } else {
    stdRating = findNearestStandardRating(calcRating, STANDARD_RATINGS);
  }
  els.stdRating.textContent = stdRating;

  // IEC 60076-5 minimum %Z check against selected transformer rating
  const stdRatingNum = parseFloat(stdRating) || 0;
  const impedanceZNum = parseFloat(els.impedanceZ.value) || 0;

  if (stdRatingNum > 0 && impedanceZNum > 0) {
    const minZ = getMinImpedanceZ(stdRatingNum);
    if (impedanceZNum < minZ) {
      els.impedanceErrorText.innerHTML =
        `&#9888; %Z = ${impedanceZNum}% is below IEC 60076-5 minimum of ${minZ}% for a ${stdRatingNum} kVA transformer. Please increase %Z.`;
      els.impedanceErrorRow.style.display = 'grid';
    } else {
      els.impedanceErrorRow.style.display = 'none';
    }
  } else {
    els.impedanceErrorRow.style.display = 'none';
  }

  // --- TRANSFORMER LOADING PERCENTAGE ---
  const loadingPct = stdRating > 0 ? (maxApparentPower / stdRating) * 100 : 0;
  els.loadingPct.textContent = loadingPct.toFixed(1) + '%';

  // --- STATUS BANNER ---
  if (loadingPct <= permissibleLoadPct) {
    els.ratingStatus.textContent = 'Recommended Transformer Rating';
    els.ratingStatus.className   = 'status-banner succeed';
  } else {
    els.ratingStatus.textContent = 'FAIL — SELECT LARGER RATING';
    els.ratingStatus.className   = 'status-banner fail';
  }
}

// ============================================================
// INPUT LISTENERS — default-value grey state tracking
// ============================================================
document.querySelectorAll('input, select').forEach(el => {
  el.classList.add('default-value');
  el.dataset.defaultVal = el.value;

  el.addEventListener('focus', () => {
    if (el.classList.contains('default-value') && el.tagName === 'INPUT') {
      el.value = '';
    }
  });

  el.addEventListener('blur', () => {
    if (el.tagName === 'INPUT' && el.value.trim() === '') {
      el.value = el.dataset.defaultVal;
      el.classList.add('default-value');
      calculate();
    }
  });

  el.addEventListener('input', () => {
    el.classList.remove('default-value');
    calculate();
  });

  el.addEventListener('change', () => {
    el.classList.remove('default-value');
    calculate();
  });
});

// ============================================================
// POWER FACTOR — cap on blur only (allow free typing)
// ============================================================
els.powerFactor.addEventListener('blur', () => {
  let pf = parseFloat(els.powerFactor.value);
  if (isNaN(pf) || pf < 0.8) {
    els.powerFactor.value = 0.8;
  } else if (pf > 1) {
    els.powerFactor.value = 1;
  }
  els.powerFactor.classList.remove('default-value');
  calculate();
});

// ============================================================
// TRANSFORMER TYPE — auto-populate Permissible Loading %
// ============================================================
// Cooling class options by transformer type
const COOLING_CLASSES = {
  DRY: [
    { value: 'AN',   label: 'AN — Air Natural' },
    { value: 'AF',   label: 'AF — Air Forced' },
    { value: 'ANAF', label: 'ANAF — Natural / Forced' },
  ],
  OIL: [
    { value: 'ONAN', label: 'ONAN — Oil Natural / Air Natural' },
    { value: 'ONAF', label: 'ONAF — Oil Natural / Air Forced' },
  ]
};

// Permissible loading % defaults per cooling class (IEC 60076-11 / 60076-7)
const COOLING_LOADING_DEFAULTS = {
  AN:   90,
  AF:   100,
  ANAF: 90,
  ONAN: 80,
  ONAF: 90,
};

function updateCoolingClassOptions() {
  const type    = els.transformerType.value;
  const options = COOLING_CLASSES[type];
  els.coolingClass.innerHTML = options
    .map(o => `<option value="${o.value}">${o.label}</option>`)
    .join('');

  // Update label to correct IEC standard per transformer type
  els.coolingClassLabel.textContent = type === 'DRY'
    ? 'Cooling Class (IEC 60076-11)'
    : 'Cooling Class (IEC 60076-2)';

  applyCoolingDefaults();
}

function applyCoolingDefaults() {
  const cooling    = els.coolingClass.value;
  const defaultPct = COOLING_LOADING_DEFAULTS[cooling] ?? 90;
  els.permissibleLoading.value              = defaultPct;
  els.permissibleLoading.dataset.defaultVal = defaultPct;
  els.permissibleLoading.classList.add('default-value');
  calculate();
}

els.transformerType.addEventListener('change', () => {
  els.transformerType.classList.remove('default-value');
  updateCoolingClassOptions();
});

els.coolingClass.addEventListener('change', () => {
  els.coolingClass.classList.remove('default-value');
  applyCoolingDefaults();
});

// ============================================================
// RATING MODE — toggle Custom Rating row visibility
// ============================================================
els.ratingMode.addEventListener('change', () => {
  els.customRatingRow.style.display = els.ratingMode.value === 'custom' ? 'grid' : 'none';
  calculate();
});

// ============================================================
// LOGO UPLOAD
// ============================================================
els.logoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    els.logoImg.src = ev.target.result;
    els.logoImg.classList.remove('hidden');
    els.logoPlaceholder.classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

// ============================================================
// ENTER KEY — moves focus to next field (same as Tab)
// ============================================================
const focusableInputs = Array.from(
  document.querySelectorAll('input, select')
).filter(el => el.closest('[style*="display:none"]') === null);

focusableInputs.forEach((el, index) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = focusableInputs[index + 1];
      if (next) {
        next.focus();
        if (next.tagName === 'INPUT') next.select();
      }
    }
  });
});

// ============================================================
// LEADING ZERO FORMAT — .69 becomes 0.69 on blur
// ============================================================
document.querySelectorAll('input[type="number"]').forEach(el => {
  el.addEventListener('blur', () => {
    const val = parseFloat(el.value);
    if (!isNaN(val)) {
      const decimals = (el.value.split('.')[1] || '').length;
      el.value = decimals > 0 ? val.toFixed(decimals) : val.toFixed(0);
    }
  });
});

// ============================================================
// RESET
// ============================================================
els.resetBtn.addEventListener('click', () => {
  document.querySelectorAll('input[type="number"]').forEach(el => {
    el.value = el.defaultValue;
    el.classList.add('default-value');
  });
  els.transformerType.value = 'DRY';
  els.transformerType.classList.add('default-value');
  els.ratingMode.value = 'standard';
  els.ratingMode.classList.add('default-value');
  els.customRatingRow.style.display = 'none';
  els.pfErrorRow.style.display      = 'none';
  els.voltageErrorRow.style.display = 'none';
  els.impedanceErrorRow.style.display = 'none';
  els.noLoadErrorRow.style.display = 'none';
  els.coolingClass.innerHTML = COOLING_CLASSES['DRY']
  .map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  els.coolingClass.classList.add('default-value');
  calculate();
});

// ============================================================
// PDF EXPORT — styled report matching Heat Enclosure format
// ============================================================
els.pdfBtn.addEventListener('click', () => {

  // Block PDF export if any error banners are visible
  if (els.voltageErrorRow.style.display   === 'grid' ||
      els.noLoadErrorRow.style.display    === 'grid' ||
      els.pfErrorRow.style.display        === 'grid' ||
      els.impedanceErrorRow.style.display === 'grid') {
    alert('Please resolve all errors before exporting the report.');
    return;
  }

  // Block PDF export if calculation result is not ready
  if (els.stdRating.textContent === '--' ||
      els.ratingStatus.textContent === 'Enter values above to calculate') {
    alert('Please complete all inputs before exporting the report.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc       = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin    = 14;
  let y = 0;

  const navy      = [26, 82, 118];
  const green     = [30, 132, 73];
  const red       = [192, 57, 43];
  const gold      = [243, 156, 18];
  const lightGrey = [240, 240, 240];

  const ratingMode = els.ratingMode.value;
  const ratingSourceLabel = ratingMode === 'custom'   ? 'Custom Value'
                          : ratingMode === 'extended' ? 'Extended List'
                          : 'IEC R10 Series';
  const stdRatingVal  = els.stdRating.textContent;
  const loadingPctVal = els.loadingPct.textContent;
  const permissiblePct = parseFloat(els.permissibleLoading.value) || 0;
  const isPass = els.ratingStatus.classList.contains('succeed');

  // --- HEADER BAND ---
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.text('DISTRIBUTION TRANSFORMER CALCULATOR', margin, 11);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Transformer Sizing  |  (MV/LV) Rating Assessment Report', margin, 17);
  doc.setTextColor(...gold);
  doc.setFontSize(8.5);
  const standardsRef = els.transformerType.value === 'DRY'
  ? 'Standards Reference: IEC 60076-1 (General) / IEC 60076-5 (Short-Circuit) / IEC 60076-11 (Dry-Type)'
  : 'Standards Reference: IEC 60076-1 (General) / IEC 60076-5 (Short-Circuit) / IEC 60076-2 (Oil-Immersed)';
  doc.text(standardsRef, margin, 23);

  y = 34;

  // --- REPORT META LINE ---
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.text(`Report Generated: ${dateStr} at ${timeStr}`, margin, y);
  doc.text(`Standard Rating: ${stdRatingVal} kVA`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // --- SECTION HEADER HELPER ---
  function sectionHeader(title) {
    doc.setFillColor(...navy);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(title, margin + 2, y + 5);
    y += 7;
  }

  // --- DATA ROW HELPER ---
  function dataRow(label, value, shaded) {
    if (shaded) {
      doc.setFillColor(...lightGrey);
      doc.rect(margin, y, pageWidth - margin * 2, 6.5, 'F');
    }
    doc.setTextColor(40, 40, 40);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(label, margin + 2, y + 4.5);
    doc.setFont(undefined, 'bold');
    doc.text(String(value), pageWidth - margin - 2, y + 4.5, { align: 'right' });
    y += 6.5;
  }

  // --- INPUT PARAMETERS SECTION ---
  sectionHeader('INPUT PARAMETERS');
  dataRow('Primary Rated Voltage (kV)',            els.primaryVoltage.value,     true);
  dataRow('Secondary Rated Voltage (kV)',          els.secondaryVoltage.value,   false);
  dataRow('Secondary No Load Voltage (kV)',        els.noLoadVoltage.value,      true);
  const minZforPDF = getMinImpedanceZ(parseFloat(stdRatingVal) || 0);
  dataRow('Transformer Impedance Voltage (%Z)', els.impedanceZ.value + '%  (IEC 60076-5 min: ' + minZforPDF + '%)', false);
  dataRow('Maximum Demand Load (kW)',              els.maxDemandLoad.value,      true);
  dataRow('Power Factor (PF), after Correction',  els.powerFactor.value,        false);
  dataRow('Transformer Type',   els.transformerType.value,  true);
  const coolingStd = els.transformerType.value === 'DRY' ? 'IEC 60076-11' : 'IEC 60076-2';
  dataRow('Cooling Class (' + coolingStd + ')', els.coolingClass.value, false);
  dataRow('Permissible Loading Percentage (%)',   permissiblePct + '%',         false);
  dataRow('Transformer Rating Source',             ratingSourceLabel,            true);
  y += 3;

  // --- CALCULATION BREAKDOWN SECTION ---
  sectionHeader('CALCULATION BREAKDOWN');
  dataRow('Eq.1  Secondary Voltage @ Full Load -- Vfl = Vnl x (1 - %Z/100)',
          els.secVFullLoad.textContent + ' kV', true);
  dataRow('Eq.2  Secondary Voltage @ Permissible Loading -- Vp = Vnl x (1 - (%Z/100) x (PL%/100))',
          els.secVPermissible.textContent + ' kV', false);
  dataRow('Eq.3  Max. Apparent Power -- S = P (kW) / PF',
          els.maxApparentPower.textContent + ' kVA', true);
  dataRow('Eq.4  Calculated Rating -- Scalc = S / (Permissible Loading %)',
          els.calcRating.textContent + ' kVA', false);
  dataRow('Eq.5  Loading % -- L = (S / Std Rating) x 100',
          loadingPctVal, true);
  y += 3;

  // --- RESULT BANNER ---
  const bannerColor = isPass ? green : red;
  doc.setFillColor(...bannerColor);
  doc.rect(margin, y, pageWidth - margin * 2, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text(
    `${stdRatingVal} kVA  --  ${els.ratingStatus.textContent}`,
    pageWidth / 2, y + 10, { align: 'center' }
  );
  y += 22;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text(
    `Criteria: Transformer Loading % must not exceed Permissible Loading % (${permissiblePct}%)`,
    margin, y
  );
  y += 5;
  doc.text(
    `Max. Apparent Power = ${els.maxApparentPower.textContent} kVA  |  Loading = ${loadingPctVal}`,
    margin, y
  );

  // --- FOOTER ---
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...navy);
  doc.text('Distribution Transformer Calculator  © maloymiao', pageWidth / 2, footerY, { align: 'center' });
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Queries: contact@maloymiao.com', pageWidth / 2, footerY + 4.5, { align: 'center' });
  doc.text('This report is generated for preliminary sizing reference only.', pageWidth / 2, footerY + 9, { align: 'center' });

  // --- FILENAME: TransformerSizing_maloymiao_YYYYMMDD_HHmm ---
  const year    = String(now.getFullYear());
  const month   = String(now.getMonth() + 1).padStart(2, '0');
  const day     = String(now.getDate()).padStart(2, '0');
  const hours   = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const stamp   = `${year}${month}${day}_${hours}${minutes}`;
  doc.save(`TransformerSizing_maloymiao_${stamp}.pdf`);
});

// ============================================================
// INITIAL LOAD
// ============================================================
calculate();
