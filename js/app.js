// Data Configuration and Initial Ranges
const sensorConfig = {
  ph: { min: 5.5, max: 6.5, label: 'الحموضة (pH Level)', unit: '' },
  ec: { min: 1.2, max: 2.0, label: 'الملوحة (EC mS/cm)', unit: 'mS' },
  waterTemp: { min: 18.0, max: 24.0, label: 'حرارة الماء (Water Temp °C)', unit: '°C' },
  airTemp: { min: 15.0, max: 32.0, label: 'حرارة الهواء (Air Temp °C)', unit: '°C' },
  airHum: { min: 50.0, max: 80.0, label: 'رطوبة الهواء (Humidity %)', unit: '%' },
  waterLevel: { min: 40.0, max: 80.0, label: 'مستوى الخزان (Water Level %)', unit: '%' }
};

let currentValues = { ph: 6.8, ec: 1.8, waterTemp: 26.5, airTemp: 24.0, airHum: 65.0, waterLevel: 75.0 };
let currentSystemMode = "AUTO";
let activeModalSensor = null;
let mainChart = null;

document.addEventListener("DOMContentLoaded", () => {
  renderOptimalRangesText();
  updateAllSensorUI();
  initMonitoringChart();
  connectMQTT();
});

function switchTab(tabId, element) {
  document.querySelectorAll('.page-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  element.classList.add('active');
}

function renderOptimalRangesText() {
  for (const key in sensorConfig) {
    const rangeTxtElem = document.getElementById(`range-txt-${key}`);
    if (rangeTxtElem) {
      rangeTxtElem.innerText = `${sensorConfig[key].min} - ${sensorConfig[key].max}`;
    }
  }
}

// تحديث القيم وحالة المؤشر الأحمر بالصفحة الرئيسية وصفحة المراقبة
function updateAllSensorUI() {
  for (const key in currentValues) {
    const val = currentValues[key];
    
    // عناصر الصفحة الرئيسية
    const homeValElem = document.getElementById(`val-home-${key}`);
    if (homeValElem) homeValElem.innerText = `${val} ${sensorConfig[key].unit}`;

    // عناصر صفحة المراقبة
    const gaugeValElem = document.getElementById(`val-gauge-${key}`);
    if (gaugeValElem) gaugeValElem.innerText = `${val} ${sensorConfig[key].unit}`;

    const cardElem = document.getElementById(`card-${key}`);
    const indicatorElem = document.getElementById(`indicator-${key}`);

    // فحص التجاوز لإشعال الضوء الأحمر (Blink)
    if (val < sensorConfig[key].min || val > sensorConfig[key].max) {
      if (indicatorElem) indicatorElem.classList.add('danger');
      if (cardElem) cardElem.classList.add('danger-border');
    } else {
      if (indicatorElem) indicatorElem.classList.remove('danger');
      if (cardElem) cardElem.classList.remove('danger-border');
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

    renderOptimalRangesText();
    updateAllSensorUI();
    closeRangeModal();
  } else {
    alert("الرجاء إدخال نطاق صحيح.");
  }
}

function promptModeChange(newMode) {
  currentSystemMode = newMode;
  document.getElementById('dash-mode-val').innerText = newMode === "AUTO" ? "تلقائي (Automatic)" : "يدوي (Manual)";
  
  const lockBanner = document.getElementById('controls-lock-banner');
  if (lockBanner) {
    lockBanner.style.display = newMode === "AUTO" ? "flex" : "none";
  }
}

function initMonitoringChart() {
  const ctx = document.getElementById('chart-main-monitoring');
  if (!ctx) return;

  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
      datasets: [{
        label: 'حرارة الماء (°C)',
        data: [22.1, 22.5, 23.0, 24.2, 25.0, 26.5],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function changeChartSensor(sensorKey) {
  if (!mainChart) return;
  mainChart.data.datasets[0].label = sensorConfig[sensorKey].label;
  mainChart.update();
}

function filterChartTime(filter, btnElement) {
  document.querySelectorAll('.time-filter-btns .btn-time').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
}

function connectMQTT() {
  const statusElem = document.getElementById('global-status-tag');
  setTimeout(() => {
    if (statusElem) {
      statusElem.className = "connection-tag online";
      statusElem.innerHTML = '<i class="fa-solid fa-circle"></i> متصل';
    }
    promptModeChange("AUTO");
  }, 1000);
}

function requestNotificationPermission() {
  if ("Notification" in window) {
    Notification.requestPermission();
  }
  }
    
