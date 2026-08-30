// Sensor Configurations with Tolerances for dynamic status calculation
const sensorConfig = {
  airTemp: { min: 18.0, max: 30.0, label: 'Air Temp', unit: '°C' },
  airHum: { min: 50.0, max: 75.0, label: 'Humidity', unit: '%' },
  waterTemp: { min: 18.0, max: 24.0, label: 'Water Temp', unit: '°C' },
  waterLevel: { min: 40.0, max: 80.0, label: 'Water Level', unit: '%' },
  ph: { min: 5.5, max: 6.5, label: 'pH Level', unit: '' },
  ec: { min: 1.2, max: 2.0, label: 'EC Level', unit: 'mS/cm' }
};

// Current Values (Change values here to test alerts and text status)
let currentValues = { 
  airTemp: 27.8, 
  airHum: 88.0,   // تجاوز عالي جداً (مثال للتجربة)
  waterTemp: 23.4, 
  waterLevel: 75.0, 
  ph: 4.8,       // ضعيف جداً (مثال للتجربة)
  ec: 1.58 
};

// Historical Data for Mini Sparklines
const sparklineData = {
  airTemp: [26.1, 26.5, 27.0, 27.2, 27.5, 27.8],
  airHum: [60, 65, 70, 78, 82, 88],
  waterTemp: [22.0, 22.5, 22.8, 23.1, 23.2, 23.4],
  waterLevel: [80, 79, 78, 77, 76, 75],
  ph: [6.2, 6.0, 5.8, 5.5, 5.0, 4.8],
  ec: [1.50, 1.52, 1.55, 1.56, 1.57, 1.58]
};

let miniCharts = {};
let activeModalSensor = null;

document.addEventListener("DOMContentLoaded", () => {
  initMiniCharts();
  updateAllSensorUI();
  setupClickEvents();
});

function switchTab(tabId, element) {
  document.querySelectorAll('.page-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  element.classList.add('active');
}

// Calculate Text Status: (عادي، عالي، عالي جدا، ضعيف، ضعيف جدا)
function getStatusTextAndClass(val, min, max) {
  const range = max - min;
  
  if (val >= min && val <= max) {
    return { text: "عادي (مثالي)", class: "normal" };
  } else if (val > max) {
    if (val > max + (range * 0.3)) {
      return { text: "عالي جداً ⚠️", class: "warning-high" };
    }
    return { text: "عالي ⚠️", class: "warning-high" };
  } else {
    if (val < min - (range * 0.3)) {
      return { text: "ضعيف جداً ⚠️", class: "warning-low" };
    }
    return { text: "ضعيف ⚠️", class: "warning-low" };
  }
}

// Update UI, Text Status, and Blinking Alerts
function updateAllSensorUI() {
  for (const key in currentValues) {
    const val = currentValues[key];
    const cfg = sensorConfig[key];

    // 1. Update Numeric Value
    const valElem = document.getElementById(`val-home-${key}`);
    if (valElem) valElem.innerText = val;

    // 2. Compute Status Text
    const statusObj = getStatusTextAndClass(val, cfg.min, cfg.max);
    const statusTxtElem = document.getElementById(`status-txt-${key}`);
    if (statusTxtElem) {
      statusTxtElem.innerText = statusObj.text;
    }

    // 3. Handle Alert Blinking
    const cardElem = document.getElementById(`card-${key}`);
    if (cardElem) {
      cardElem.classList.remove('blink-alert', 'warning-low', 'warning-high');
      
      if (statusObj.class !== "normal") {
        cardElem.classList.add('blink-alert', statusObj.class);
      }
    }
  }
}

// Render Mini Sparkline Charts inside Cards
function initMiniCharts() {
  for (const key in sparklineData) {
    const ctx = document.getElementById(`spark-${key}`);
    if (!ctx) continue;

    const isDanger = currentValues[key] < sensorConfig[key].min || currentValues[key] > sensorConfig[key].max;
    const strokeColor = isDanger ? '#ef4444' : '#0284c7';

    miniCharts[key] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['', '', '', '', '', ''],
        datasets: [{
          data: sparklineData[key],
          borderColor: strokeColor,
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    });
  }
}

// Allow Modals on Card Click
function setupClickEvents() {
  for (const key in sensorConfig) {
    const cardElem = document.getElementById(`card-${key}`);
    if (cardElem) {
      cardElem.addEventListener('click', () => openRangeModal(key));
    }
  }
}

function openRangeModal(sensorKey) {
  activeModalSensor = sensorKey;
  document.getElementById('modal-sensor-name').innerText = `تعديل حدود: ${sensorConfig[sensorKey].label}`;
  document.getElementById('input-range-min').value = sensorConfig[sensorKey].min;
  document.getElementById('input-range-max').value = sensorConfig[sensorKey].max;
  document.getElementById('range-edit-modal').classList.add('active');
}

function closeRangeModal() {
  document.getElementById('range-edit-modal').classList.remove('active');
  activeModalSensor = null;
}

function confirmSaveRange() {
  if (!activeModalSensor) return;
  const newMin = parseFloat(document.getElementById('input-range-min').value);
  const newMax = parseFloat(document.getElementById('input-range-max').value);

  if (!isNaN(newMin) && !isNaN(newMax) && newMin < newMax) {
    sensorConfig[activeModalSensor].min = newMin;
    sensorConfig[activeModalSensor].max = newMax;
    updateAllSensorUI();
    closeRangeModal();
  } else {
    alert("يرجى أدخال قيمة صالحة للحد الأدنى والأقصى.");
  }
}

function requestNotificationPermission() {
  if ("Notification" in window) Notification.requestPermission();
      }
