// ==========================================
// 1. HiveMQ Cloud Credentials & Config
// ==========================================
const MQTT_CONFIG = {
  host: 'wss://99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud:8884/mqtt',
  options: {
    username: 'hydro01-test',
    password: 'Atef269269',
    clientId: 'Hydroponic_Web_' + Math.floor(Math.random() * 100000),
    keepalive: 60,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    clean: true
  },
  topics: {
    telemetry: 'greenhouse/GH001/telemetry',
    commands: 'greenhouse/GH001/commands'
  }
};

let mqttClient = null;
let pendingModeChange = null;

// ==========================================
// 2. Dynamic Optimal Ranges & System Storage
// ==========================================
let SENSOR_RANGES = JSON.parse(localStorage.getItem('hydro_sensor_ranges')) || {
  ph:         { name: 'الحموضة (pH)', min: 5.5, max: 6.5, gaugeMin: 0, gaugeMax: 14, color: '#22c55e' },
  ec:         { name: 'الملوحة (EC)', min: 1.2, max: 2.0, gaugeMin: 0, gaugeMax: 4,  color: '#8b5cf6' },
  waterTemp:  { name: 'حرارة الماء', min: 18.0, max: 24.0, gaugeMin: 0, gaugeMax: 40, color: '#06b6d4' },
  airTemp:    { name: 'حرارة الهواء', min: 15.0, max: 32.0, gaugeMin: 0, gaugeMax: 50, color: '#ea580c' },
  airHum:     { name: 'رطوبة الهواء', min: 50, max: 80, gaugeMin: 0, gaugeMax: 100, color: '#0284c7' },
  waterLevel: { name: 'مستوى الخزان', min: 40, max: 80, gaugeMin: 0, gaugeMax: 100, color: '#3b82f6' }
};

let alertLogs = JSON.parse(localStorage.getItem('hydro_alert_logs')) || [];
let activeEditingSensor = null;

// Storage for Chart.js Instances
let charts = {
  mainWater: null,
  gauges: {}
};

// Main Active Filter States
let activeSensor = 'waterTemp';
let activeTimeRange = '24h';

// Mock Historical Datasets for Time Range Filters
const mockChartData = {
  waterTemp: {
    label: 'حرارة الماء (°C)',
    color: '#06b6d4',
    minY: 15, maxY: 30,
    '1h':  { labels: ['10m', '20m', '30m', '40m', '50m', '60m'], data: [23.1, 23.2, 23.4, 23.3, 23.5, 23.4] },
    '24h': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'], data: [22.1, 22.8, 22.2, 23.4, 22.9, 24.2, 22.6] },
    '7d':  { labels: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], data: [22.5, 23.0, 23.8, 22.9, 23.1, 24.0, 23.4] },
    '30d': { labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'], data: [22.8, 23.2, 23.6, 23.1] }
  },
  airTemp: {
    label: 'حرارة الهواء (°C)',
    color: '#ea580c',
    minY: 10, maxY: 40,
    '1h':  { labels: ['10m', '20m', '30m', '40m', '50m', '60m'], data: [27.5, 27.6, 27.8, 28.0, 27.9, 27.8] },
    '24h': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'], data: [24.0, 23.5, 26.2, 31.0, 29.5, 26.8, 25.0] },
    '7d':  { labels: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], data: [26.5, 27.2, 28.1, 27.9, 28.5, 29.0, 27.8] },
    '30d': { labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'], data: [26.0, 27.5, 28.2, 27.9] }
  },
  airHum: {
    label: 'رطوبة الهواء (%)',
    color: '#0284c7',
    minY: 20, maxY: 100,
    '1h':  { labels: ['10m', '20m', '30m', '40m', '50m', '60m'], data: [67, 68, 68, 69, 68, 68] },
    '24h': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'], data: [75, 78, 65, 55, 60, 70, 74] },
    '7d':  { labels: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], data: [68, 65, 62, 70, 72, 69, 68] },
    '30d': { labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'], data: [65, 67, 70, 68] }
  },
  waterLevel: {
    label: 'مستوى الخزان (%)',
    color: '#3b82f6',
    minY: 0, maxY: 100,
    '1h':  { labels: ['10m', '20m', '30m', '40m', '50m', '60m'], data: [75, 75, 75, 74, 74, 75] },
    '24h': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'], data: [90, 85, 80, 75, 70, 88, 85] },
    '7d':  { labels: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], data: [95, 88, 82, 75, 92, 85, 80] },
    '30d': { labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'], data: [85, 82, 88, 80] }
  },
  ph: {
    label: 'الحموضة (pH)',
    color: '#22c55e',
    minY: 4, maxY: 9,
    '1h':  { labels: ['10m', '20m', '30m', '40m', '50m', '60m'], data: [6.2, 6.2, 6.2, 6.3, 6.2, 6.2] },
    '24h': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'], data: [6.0, 6.1, 6.3, 6.2, 6.4, 6.2, 6.1] },
    '7d':  { labels: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], data: [6.1, 6.2, 6.0, 6.3, 6.2, 6.1, 6.2] },
    '30d': { labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'], data: [6.1, 6.2, 6.2, 6.1] }
  },
  ec: {
    label: 'الملوحة (EC mS/cm)',
    color: '#8b5cf6',
    minY: 0, maxY: 4,
    '1h':  { labels: ['10m', '20m', '30m', '40m', '50m', '60m'], data: [1.58, 1.58, 1.59, 1.58, 1.58, 1.58] },
    '24h': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'], data: [1.5, 1.55, 1.62, 1.58, 1.60, 1.57, 1.58] },
    '7d':  { labels: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], data: [1.5, 1.6, 1.58, 1.62, 1.55, 1.58, 1.6] },
    '30d': { labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'], data: [1.55, 1.58, 1.6, 1.57] }
  }
};

// ==========================================
// 3. Application Lifecycle
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initMQTT();
  initCharts();
  checkNotificationStatus();
});

// ==========================================
// 4. Notifications & Modals Setup
// ==========================================
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("هذا المتصفح لا يدعم إشعارات النظام.");
    return;
  }
  
  Notification.requestPermission().then(permission => {
    updateNotificationBellIcon(permission);
    if (permission === "granted") {
      new Notification("تنبيهات مزرعتي الذكية", {
        body: "تم تفعيل الإشعارات الفورية بنجاح!",
        icon: "https://cdn-icons-png.flaticon.com/512/628/628324.png"
      });
    }
  });
}

function checkNotificationStatus() {
  if ("Notification" in window) {
    updateNotificationBellIcon(Notification.permission);
  }
}

function updateNotificationBellIcon(permission) {
  const btn = document.getElementById('btn-notifications-permission');
  if (!btn) return;
  if (permission === 'granted') {
    btn.innerHTML = `<i class="fa-solid fa-bell" style="color:#16a34a;" title="الإشعارات مفعّلة"></i>`;
  } else {
    btn.innerHTML = `<i class="fa-regular fa-bell-slash" style="color:#ef4444;" title="اضغط لتفعيل الإشعارات"></i>`;
  }
}

function sendPushNotification(title, message) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body: message,
      icon: "https://cdn-icons-png.flaticon.com/512/628/628324.png",
      tag: title 
    });
  }
}

function openRangeModal(sensorKey) {
  activeEditingSensor = sensorKey;
  const config = SENSOR_RANGES[sensorKey];
  if (!config) return;

  document.getElementById('modal-sensor-name').innerText = `تعديل نطاق ${config.name}`;
  document.getElementById('input-range-min').value = config.min;
  document.getElementById('input-range-max').value = config.max;

  document.getElementById('range-edit-modal').classList.add('open');
}

function closeRangeModal() {
  document.getElementById('range-edit-modal').classList.remove('open');
  activeEditingSensor = null;
}

function confirmSaveRange() {
  if (!activeEditingSensor) return;

  const minVal = parseFloat(document.getElementById('input-range-min').value);
  const maxVal = parseFloat(document.getElementById('input-range-max').value);

  if (isNaN(minVal) || isNaN(maxVal) || minVal >= maxVal) {
    alert("يرجى إدخال قيم صحيحة (يجب أن يكون الحد الأدنى أقل من الحد الأقصى).");
    return;
  }

  SENSOR_RANGES[activeEditingSensor].min = minVal;
  SENSOR_RANGES[activeEditingSensor].max = maxVal;
  localStorage.setItem('hydro_sensor_ranges', JSON.stringify(SENSOR_RANGES));

  const txtEl = document.getElementById(`range-txt-${activeEditingSensor}`);
  if (txtEl) txtEl.innerText = `${minVal} - ${maxVal}`;

  const currentVal = parseFloat(document.getElementById(`val-gauge-${activeEditingSensor}`)?.innerText || minVal);
  if (charts.gauges[activeEditingSensor]) {
    updateGaugeChart(charts.gauges[activeEditingSensor], currentVal, SENSOR_RANGES[activeEditingSensor]);
  }

  closeRangeModal();
}

// Nav Tabs & Alerts Dialogs
function switchTab(tabId, btnElement) {
  document.querySelectorAll('.page-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  btnElement.classList.add('active');
}

function promptModeChange(newMode) {
  pendingModeChange = newMode;
  const modal = document.getElementById('mode-confirm-modal');
  const text = document.getElementById('mode-confirm-text');
  const confirmBtn = document.getElementById('btn-confirm-action');

  if (newMode === 'AUTO') {
    text.innerText = "هل أنت متأكد من التحويل للوضع التلقائي؟ سيقوم النظام بإدارة الأجهزة آلياً وتعطيل التحكم اليدوي.";
  } else {
    text.innerText = "هل أنت متأكد من التحويل للوضع اليدوي؟ ستتمكن من التحكم المباشر بمفاتيح التشغيل والإيقاف.";
  }

  confirmBtn.onclick = executeModeChange;
  modal.classList.add('open');
}

function closeModeModal() {
  const modal = document.getElementById('mode-confirm-modal');
  if (modal) modal.classList.remove('open');
  pendingModeChange = null;
}

function executeModeChange() {
  if (pendingModeChange) {
    setSystemMode(pendingModeChange);
  }
  closeModeModal();
}

// ==========================================
// 5. MQTT Engine Logic
// ==========================================
function initMQTT() {
  const statusTag = document.getElementById('global-status-tag');
  
  if (mqttClient) {
    try { mqttClient.end(true); } catch(e) {}
  }

  if (statusTag) {
    statusTag.className = 'connection-tag offline';
    statusTag.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الاتصال...';
  }

  try {
    mqttClient = mqtt.connect(MQTT_CONFIG.host, MQTT_CONFIG.options);

    mqttClient.on('connect', () => {
      if (statusTag) {
        statusTag.className = 'connection-tag online';
        statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> متصل';
      }
      mqttClient.subscribe(MQTT_CONFIG.topics.telemetry);
    });

    mqttClient.on('message', (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (topic === MQTT_CONFIG.topics.telemetry) {
          updateSensorUI(data);
          evaluateAlarms(data);
        }
      } catch (e) {
        console.error("Payload error:", e);
      }
    });

    mqttClient.on('error', () => {
      if (statusTag) {
        statusTag.className = 'connection-tag offline';
        statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> خطأ اتصال';
      }
    });

    mqttClient.on('offline', () => {
      if (statusTag) {
        statusTag.className = 'connection-tag offline';
        statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> غير متصل';
      }
    });

  } catch (e) {
    console.error('MQTT error:', e);
  }
}

function evaluateAlarms(data) {
  const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const checkAndNotify = (key, value, unit) => {
    const conf = SENSOR_RANGES[key];
    if (!conf || value === undefined) return;

    if (value < conf.min) {
      triggerAlarm(`انخفاض ${conf.name} ⚠️`, `القراءة الحالية (${value} ${unit}) أقل من الحد الأدنى (${conf.min})!`, now);
    } else if (value > conf.max) {
      triggerAlarm(`ارتفاع ${conf.name} 🔥`, `القراءة الحالية (${value} ${unit}) أعلى من الحد الأقصى (${conf.max})!`, now);
    }
  };

  checkAndNotify('airTemp', data.air_temp, '°C');
  checkAndNotify('airHum', data.air_hum, '%');
  checkAndNotify('waterTemp', data.water_temp, '°C');
  checkAndNotify('waterLevel', data.tank_level, '%');
  checkAndNotify('ph', data.ph, '');
  checkAndNotify('ec', data.ec, 'mS/cm');
}

function triggerAlarm(title, message, time) {
  const exists = alertLogs.some(log => log.title === title && log.message === message);
  if (!exists) {
    alertLogs.unshift({ title, message, time });
    localStorage.setItem('hydro_alert_logs', JSON.stringify(alertLogs));
    sendPushNotification(title, message);
  }
}

// ==========================================
// 6. Real-time UI & Dashboard Updates
// ==========================================
function updateSensorUI(data) {
  const updateVal = (key, val, unit) => {
    if (val === undefined) return;
    const txtEl = document.getElementById(`val-gauge-${key}`);
    if (txtEl) txtEl.innerText = val;

    if (charts.gauges[key]) {
      updateGaugeChart(charts.gauges[key], val, SENSOR_RANGES[key]);
    }
  };

  updateVal('airTemp', data.air_temp, '°C');
  updateVal('airHum', data.air_hum, '%');
  updateVal('waterTemp', data.water_temp, '°C');
  updateVal('waterLevel', data.tank_level, '%');
  updateVal('ph', data.ph, '');
  updateVal('ec', data.ec, 'mS/cm');

  if (data.mode !== undefined) {
    updateModeUI(String(data.mode).toUpperCase());
  }
}

function updateModeUI(mode) {
  const modeValEl = document.getElementById('dash-mode-val');
  const btnAuto = document.getElementById('btn-mode-auto');
  const btnManual = document.getElementById('btn-mode-manual');
  const lockBanner = document.getElementById('controls-lock-banner');

  if (modeValEl) modeValEl.innerText = mode === 'AUTO' ? 'تلقائي (AUTO)' : 'يدوي (MANUAL)';

  const isAuto = (mode === 'AUTO');

  if (btnAuto && btnManual) {
    btnAuto.style.background = isAuto ? '#0284c7' : '#334155';
    btnAuto.style.color = isAuto ? '#ffffff' : '#94a3b8';
    btnAuto.setAttribute('onclick', isAuto ? 'void(0)' : "promptModeChange('AUTO')");

    btnManual.style.background = !isAuto ? '#ea580c' : '#334155';
    btnManual.style.color = !isAuto ? '#ffffff' : '#94a3b8';
    btnManual.setAttribute('onclick', !isAuto ? 'void(0)' : "promptModeChange('MANUAL')");
  }

  if (lockBanner) lockBanner.style.display = isAuto ? 'flex' : 'none';

  document.querySelectorAll('#tab-controls input[type="checkbox"]').forEach(sw => {
    sw.disabled = isAuto;
  });
}

function setSystemMode(newMode) {
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(MQTT_CONFIG.topics.commands, JSON.stringify({ mode: newMode }));
    updateModeUI(newMode);
  }
}

// ==========================================
// 7. Interactive Charts Initialization Engine
// ==========================================
function initCharts() {
  initMainMonitoringChart();
  initGaugeCharts();
}

function initMainMonitoringChart() {
  const canvas = document.getElementById('chart-main-monitoring');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dataset = mockChartData[activeSensor];
  const timeData = dataset[activeTimeRange];

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, dataset.color + '66'); 
  gradient.addColorStop(1, dataset.color + '00');

  charts.mainWater = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeData.labels,
      datasets: [{
        label: dataset.label,
        data: timeData.data,
        borderColor: dataset.color,
        borderWidth: 2.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: dataset.minY, max: dataset.maxY, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function changeChartSensor(sensorKey) {
  activeSensor = sensorKey;
  updateMainChart();
}

function filterChartTime(rangeKey, btnElement) {
  document.querySelectorAll('.btn-time').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  activeTimeRange = rangeKey;
  updateMainChart();
}

function updateMainChart() {
  if (!charts.mainWater) return;

  const dataset = mockChartData[activeSensor];
  const timeData = dataset[activeTimeRange];
  const ctx = charts.mainWater.ctx;

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, dataset.color + '66');
  gradient.addColorStop(1, dataset.color + '00');

  charts.mainWater.data.labels = timeData.labels;
  charts.mainWater.data.datasets[0].label = dataset.label;
  charts.mainWater.data.datasets[0].data = timeData.data;
  charts.mainWater.data.datasets[0].borderColor = dataset.color;
  charts.mainWater.data.datasets[0].backgroundColor = gradient;
  
  charts.mainWater.options.scales.y.min = dataset.minY;
  charts.mainWater.options.scales.y.max = dataset.maxY;

  charts.mainWater.update();
}

function initGaugeCharts() {
  Object.keys(SENSOR_RANGES).forEach(key => {
    const conf = SENSOR_RANGES[key];
    const initialVal = (conf.min + conf.max) / 2;
    charts.gauges[key] = createSemiGauge(`gauge-${key}`, initialVal, conf);
    
    const txtEl = document.getElementById(`range-txt-${key}`);
    if (txtEl) txtEl.innerText = `${conf.min} - ${conf.max}`;
  });
}

function createSemiGauge(elementId, value, conf) {
  const canvas = document.getElementById(elementId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [value - conf.gaugeMin, conf.gaugeMax - value],
        backgroundColor: [conf.color, '#e2e8f0'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      rotation: -90,
      circumference: 180,
      cutout: '75%',
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false }
      }
    }
  });
}

function updateGaugeChart(gaugeInstance, val, conf) {
  if (!gaugeInstance || !conf) return;
  const currentVal = Math.max(conf.gaugeMin, Math.min(val, conf.gaugeMax));
  
  const isOutOfRange = val < conf.min || val > conf.max;
  gaugeInstance.data.datasets[0].backgroundColor[0] = isOutOfRange ? '#ef4444' : conf.color;

  gaugeInstance.data.datasets[0].data = [currentVal - conf.gaugeMin, conf.gaugeMax - currentVal];
  gaugeInstance.update();
  }
  
