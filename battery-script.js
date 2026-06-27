// Exide Battery Tech Specification Database Table
const batteryDatabase = {
  "XP800":  { ah: 80,  cca: 530 },
  "XP1000": { ah: 100, cca: 580 },
  "XP1300": { ah: 130, cca: 720 },
  "XP1500": { ah: 150, cca: 785 },
  "XP1700": { ah: 170, cca: 900 },
  "XP1800": { ah: 180, cca: 1050 },
  "XP2000": { ah: 200, cca: 1150 }
};

// Helper function to safely fetch either the typed value or the placeholder fallback
function getInputValue(id, defaultValue = 0) {
  const element = document.getElementById(id);
  if (!element) return defaultValue;
  const rawValue = element.value !== "" ? element.value : element.placeholder;
  return parseFloat(rawValue) || defaultValue;
}

function calculateSizing() {
  const resultsBox = document.querySelector('.results-box');
  const statusDiv = document.getElementById('suitability-status');
  const emptyNotice = document.getElementById('form-empty-notice');
  const errorBox = document.getElementById('validation-error-box');

  // 1. Initial State: Check if critical fields are completely empty (Blank Slate Reset State)
  const isSocEmpty = document.getElementById('soc').value === "" && document.getElementById('soc').placeholder === "";
  const isVoltageEmpty = document.getElementById('voltage').value === "" && document.getElementById('voltage').placeholder === "";

  if (isSocEmpty || isVoltageEmpty) {
    // Clear display targets
    document.getElementById('out-base-cranking').innerText = "";
    document.getElementById('out-req-cranking').innerText = "";
    document.getElementById('out-req-aux').innerText = "";
    document.getElementById('out-sys-cca').innerText = "";
    document.getElementById('out-sys-ah').innerText = "";
    document.getElementById('out-qty').innerText = "";
    
    statusDiv.innerText = "";
    statusDiv.className = "status-box neutral";

    if (resultsBox) resultsBox.classList.add('hidden-results');
    if (errorBox) errorBox.style.display = "none"; // Hide error on clean reset
    if (emptyNotice) emptyNotice.style.display = "block";
    return; 
  }

  // Fetch true active calculation entries
  const factorA = getInputValue('soc', 0);
  const factorB = getInputValue('duration', 0);
  const factorC = getInputValue('efficiency', 0);
  
  const voltage = getInputValue('voltage', 0);
  const ratingKW = getInputValue('rating', 0);
  const numStarters = getInputValue('starters', 0);
  
  const auxLoad = getInputValue('aux-load', 0);
  const backupHours = getInputValue('backup-time', 0);
  
  const selectedModel = document.getElementById('battery-model').value;
  const parallelCount = getInputValue('parallel-count', 0);

  // 2. Structural Error Checker: Block calculation if critical items are 0 or less
  if (voltage <= 0 || numStarters <= 0 || parallelCount <= 0 || ratingKW < 0 || factorA < 0 || factorB < 0 || factorC < 0 || auxLoad < 0 || backupHours < 0) {
    if (resultsBox) resultsBox.classList.add('hidden-results');
    if (emptyNotice) emptyNotice.style.display = "none";
    if (errorBox) errorBox.style.display = "block"; // Trigger error presentation block
    return; // Break computation engine flow safely
  }

  // If no validation errors exist, normalize UI containers
  if (errorBox) errorBox.style.display = "none";
  if (emptyNotice) emptyNotice.style.display = "none";
  if (resultsBox) resultsBox.classList.remove('hidden-results');

  // 3. Mathematical Formula Execution
  const baseCrankingCurrent = ((ratingKW * 1000) / voltage) * numStarters;
  const crankingCurrentReq = baseCrankingCurrent * factorA * factorB * factorC;
  const totalAuxAh = auxLoad * backupHours;

  const customContainer = document.getElementById('custom-inputs-container');
  let specAh = 0;
  let specCca = 0;

  if (selectedModel === "CUSTOM") {
    customContainer.style.display = "block";
    specAh = Math.max(0, getInputValue('custom-ah', 0));
    specCca = Math.max(0, getInputValue('custom-cca', 0));
    
    // Safety fallback block for custom battery fields if zeroed out
    if (specAh <= 0 || specCca <= 0) {
      if (resultsBox) resultsBox.classList.add('hidden-results');
      if (errorBox) {
        errorBox.style.display = "block";
        errorBox.innerHTML = "⚠️ <strong>Invalid Input Detected:</strong> Custom Unit Capacity and CCA ratings must be greater than 0.";
      }
      return;
    }
  } else {
    customContainer.style.display = "none";
    specAh = batteryDatabase[selectedModel].ah;
    specCca = batteryDatabase[selectedModel].cca;
  }
  
  const totalSystemCca = specCca * parallelCount;
  const totalSystemAh = specAh * parallelCount;
  const unitVoltageBaseline = 12; 
  const totalQuantity = (voltage / unitVoltageBaseline) * parallelCount;

  // 4. Update the View Screen
  document.getElementById('out-base-cranking').innerText = baseCrankingCurrent.toFixed(2);
  document.getElementById('out-req-cranking').innerText = crankingCurrentReq.toFixed(2);
  document.getElementById('out-req-aux').innerText = totalAuxAh.toFixed(2);
  
  document.getElementById('out-sys-cca').innerText = totalSystemCca;
  document.getElementById('out-sys-ah').innerText = totalSystemAh;
  document.getElementById('out-qty').innerText = Math.ceil(totalQuantity);

  // 5. Run Compliance Badge Assessment
  if (totalSystemCca >= crankingCurrentReq && totalSystemAh >= totalAuxAh) {
    statusDiv.innerText = "✅ SAFE / PASS";
    statusDiv.className = "status-box pass";
  } else {
    statusDiv.innerText = "❌ INSUFFICIENT CAPACITY";
    statusDiv.className = "status-box fail";
  }

  // Write print layout dataset strings
  document.querySelectorAll('.input-row').forEach(row => {
    const field = row.querySelector('input, select');
    if (field) {
      if (field.tagName === 'SELECT') {
        row.setAttribute('data-print-value', field.options[field.selectedIndex].text);
      } else {
        row.setAttribute('data-print-value', field.value !== "" ? field.value : field.placeholder || "");
      }
    }
  });
}

// Reset Button Execution Logic
document.getElementById('reset-btn').addEventListener('click', () => {
  const allInputs = document.querySelectorAll('.calculator-container input');
  
  allInputs.forEach(input => {
    input.value = "";        
    input.placeholder = "";  
  });

  // Explicitly wipe the Project Title input field and reapply default placeholder layout
  const projectNameInput = document.getElementById('project-name');
  if (projectNameInput) {
    projectNameInput.value = "";
    projectNameInput.placeholder = "e.g. Generator Room B Standby System";
  }

  document.getElementById('battery-model').value = "XP1300";
  
  // Re-inject pristine error template text before triggering structural calculation cycle
  const errorBox = document.getElementById('validation-error-box');
  if (errorBox) {
    errorBox.innerHTML = "⚠️ <strong>Invalid Input Detected:</strong> Voltage, Number of Starters, and Number of Batteries must be greater than 0.";
  }
  
  calculateSizing();
});

// Print PDF Handler with Project Name Title File Generator
document.getElementById('pdf-btn').addEventListener('click', () => {
  // Pulls custom typed project name, strips spaces/symbols, defaults to 'BatterySizing' if blank
  const projectNameField = document.getElementById('project-name');
  const rawProjectName = (projectNameField && projectNameField.value) || "BatterySizing";
  const formattedProjectName = rawProjectName.replace(/[^a-zA-Z0-9]/g, "_");
  
  const now = new Date();
  const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timeStamp = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  
  const originalTitle = document.title;
  document.title = `${formattedProjectName}_${dateStamp}_${timeStamp}`;
  window.print();
  
  setTimeout(() => {
    document.title = originalTitle;
  }, 100);
});

// Attach live input trackers to all input elements for real-time adjustments
document.querySelectorAll('input, select').forEach(element => {
  element.addEventListener('input', calculateSizing);
});

// Initialize form configuration loop on initial page boot
calculateSizing();