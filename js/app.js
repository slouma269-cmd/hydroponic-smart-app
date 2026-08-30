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
// 2. Alarm Limits & Local Logs
// ==========================================
const ALARM_LIMITS = {
  maxAirTemp: 32.0,  
  minAirTemp: 15.0,  
  minWaterLevel: 20, 
  minPh: 5.5,        
  maxPh: 6.8         
};

let alertLogs = JSON.parse(localStorage.getItem('hydro_alert_logs')) || [];

// Storage for Chart.js Instances
let charts = {
  mainWater: null,
  devicesStatus: null,
  gauges: {}
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
// 4. Browser Notifications
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

// ==========================================
// 5. Tabs & Modals Navigation
// ==========================================
function switchTab(tabId, btnElement) {
  document.querySelectorAll('.page-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  btnElement.classList.add('active');
}

function openSubPage(subType) {
  const modal = document.getElementById('sub-page-modal');
  const title = document.getElementById('modal-title');

  modal.classList.add('open');

  if (subType === 'sub-alerts') {
    title.innerText = "سجل الإنذارات والتنبيهات";
    renderAlertLogsUI();
  } else if (subType === 'sub-nutrients') {
    title.innerText = "إدارة المغذيات";
    document.getElementById('modal-content').innerHTML = `
      <div class="card">
        <h4>تحديد الأهداف (Target Limits)</h4>
        <label style="display:block; margin-top:10px;">Target pH: <input type="number" step="0.1" value="6.0" class="input-field"></label>
        <label style="display:block; margin-top:10px;">Target EC: <input type="number" step="0.1" value="1.8" class="input-field"></label>
        <button class="btn-primary" style="margin-top:15px; width:100%;" onclick="closeSubPage()">حفظ وتزامن</button>
      </div>`;
  } else if (subType === 'sub-mqtt') {
    title.innerText = "إعدادات HiveMQ Cloud";
    document.getElementById('modal-content').innerHTML = `
      <div class="card">
        <label style="display:block; margin-bottom:5px;">حالة الاتصال بالكلود:</label>
        <button class="btn-primary" style="background:#0284c7; margin-bottom:15px; width:100%;" onclick="reconnectMQTT()">إعادة الاتصال 🔄</button>
        <label style="display:block; margin-top:10px;">Cloud Host:</label>
        <input type="text" value="99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud" class="input-field" readonly>
        <label style="display:block; margin-top:10px;">User:</label>
        <input type="text" value="hydro01-test" class="input-field" readonly>
      </div>`;
  }
}

function closeSubPage() {
  document.getElementById('sub-page-modal').classList.remove('open');
}

function renderAlertLogsUI() {
  const content = document.getElementById('modal-content');
  let logsHtml = alertLogs.length === 0 
    ? `<div style="text-align:center; padding: 25px; color:#64748b;">
         <i class="fa-solid fa-circle-check" style="font-size:2rem; color:#16a34a; margin-bottom:8px;"></i>
         <p>لا توجد إنذارات حالية، جميع القراءات ممتازة 👍</p>
       </div>`
    : alertLogs.map(log => `
        <div class="alert-log-item">
          <div style="font-weight:bold; color:#991b1b; font-size:0.9rem;">${log.title}</div>
          <div style="color:#7f1d1d; font-size:0.85rem; margin-top:2px;">${log.message}</div>
          <div style="color:#94a3b8; font-size:0.75rem; margin-top:4px;">${log.time}</div>
        </div>
      `).join('');

  content.innerHTML = `
    <div class="card" style="margin-bottom: 12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h4 style="margin:0;">حدود التنبيه الحالية</h4>
        <button onclick="requestNotificationPermission()" class="btn-primary" style="padding:4px 10px; font-size:0.8rem;">تفعيل الإشعارات 🔔</button>
      </div>
      <div style="font-size:0.85rem; color:#64748b; margin-top:8px;">
        • حرارة الهواء: ${ALARM_LIMITS.minAirTemp}°C - ${ALARM_LIMITS.maxAirTemp}°C<br>
        • أدنى مستوى للخزان: ${ALARM_LIMITS.minWaterLevel} %<br>
        • نطاق الحموضة (pH): ${ALARM_LIMITS.minPh} - ${ALARM_LIMITS.maxPh}
      </div>
    </div>
    
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <h4 style="margin:0;">السجل الحالي (${alertLogs.length})</h4>
      ${alertLogs.length > 0 ? `<button onclick="clearAlertLogs()" class="btn-danger-sm">مسح السجل 🗑️</button>` : ''}
    </div>
    <div style="max-height: 250px; overflow-y: auto;">
      ${logsHtml}
    </div>`;
}

function clearAlertLogs() {
  alertLogs = [];
  localStorage.removeItem('hydro_alert_logs');
  renderAlertLogsUI();
}

// Mode Confirmation Dialogs
function promptModeChange(newMode) {
  pendingModeChange = newMode;
  const modal = document.getElementById('mode-confirm-modal');
  const text = document.getElementById('mode-confirm-text');
  const confirmBtn = document.getElementById('btn-confirm-action');

  if (newMode === 'AUTO') {
    text.innerText = "هل أنت متأكد من التحويل للوضع التلقائي؟ سيقوم النظام بإدارة الأجهزة آلياً وتعطيل التحكم اليدوي لمنع التضارب.";
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
// 6. MQTT Client Logic
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
      console.log('Connected to HiveMQ Cloud successfully!');
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
        console.error("Payload JSON parsing error:", e);
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
    console.error('MQTT connection error:', e);
  }
}

function reconnectMQTT() {
  initMQTT();
  closeSubPage();
}

// Evaluate limits and push alarms
function evaluateAlarms(data) {
  const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  if (data.air_temp !== undefined && data.air_temp > ALARM_LIMITS.maxAirTemp) {
    triggerAlarm("ارتفاع درجة الحرارة 🔥", `درجة حرارة الهواء ارتفعت إلى ${data.air_temp}°C!`, now);
  }

  if (data.tank_level !== undefined && data.tank_level < ALARM_LIMITS.minWaterLevel) {
    triggerAlarm("انخفاض مستوى الخزان ⚠️", `مستوى خزان الماء انخفض إلى ${data.tank_level}%!`, now);
  }

  if (data.ph !== undefined) {
    if (data.ph < ALARM_LIMITS.minPh || data.ph > ALARM_LIMITS.maxPh) {
      triggerAlarm("انحراف مستوى pH 🧪", `مستوى الحموضة حالياً هو ${data.ph} وخارج النطاق الآمن!`, now);
    }
  }
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
// 7. Dynamic Telemetry & UI Updates
// ==========================================
function updateSensorUI(data) {
  const setHtml = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val;
  };

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  // 1. Dashboard Values & Conditional Formatting
  if (data.air_temp !== undefined) {
    setHtml('dash-air-temp', `${data.air_temp} <small>°C</small>`);
    applyCardStatus('card-air-temp', data.air_temp, ALARM_LIMITS.minAirTemp, ALARM_LIMITS.maxAirTemp);
  }

  if (data.air_hum !== undefined) setHtml('dash-air-hum', `${data.air_hum} <small>%</small>`);
  
  if (data.water_temp !== undefined) {
    setHtml('dash-water-temp', `${data.water_temp} <small>°C</small>`);
    if (charts.gauges.waterTemp) {
      updateGaugeChart(charts.gauges.waterTemp, data.water_temp, 10, 30);
    }
  }
  
  if (data.tank_level !== undefined) {
    setHtml('dash-water-level', `${data.tank_level} <small>%</small>`);
    applyCardStatus('card-water-level', data.tank_level, ALARM_LIMITS.minWaterLevel, 100);
    if (charts.gauges.waterLevel) {
      updateGaugeChart(charts.gauges.waterLevel, data.tank_level, 0, 100);
    }
  }

  if (data.ph !== undefined) {
    setText('dash-ph', data.ph);
    applyCardStatus('card-ph', data.ph, ALARM_LIMITS.minPh, ALARM_LIMITS.maxPh);
    if (charts.gauges.ph) {
      updateGaugeChart(charts.gauges.ph, data.ph, 0, 14);
    }
  }
  
  if (data.ec !== undefined) {
    setHtml('dash-ec', `${data.ec} <small>mS</small>`);
    if (charts.gauges.ec) {
      updateGaugeChart(charts.gauges.ec, data.ec, 0, 3);
    }
  }

  // 2. Mode & Device Controls State
  if (data.mode !== undefined) {
    updateModeUI(String(data.mode).toUpperCase());
  }

  if (data.pump !== undefined) {
    const el = document.getElementById('dev-pump1');
    if (el) el.checked = (String(data.pump).toUpperCase() === 'ON');
  }
  
  if (data.fan !== undefined) {
    const el = document.getElementById('dev-fan1');
    if (el) el.checked = (String(data.fan).toUpperCase() === 'ON');
  }
  
  if (data.pad !== undefined) {
    const el = document.getElementById('dev-pad');
    if (el) el.checked = (String(data.pad).toUpperCase() === 'ON');
  }
}

function applyCardStatus(cardId, value, minLimit, maxLimit) {
  const card = document.getElementById(cardId);
  if (!card) return;

  card.classList.remove('status-normal', 'status-danger');

  if (value < minLimit || value > maxLimit) {
    card.classList.add('status-danger');
  } else {
    card.classList.add('status-normal');
  }
}

function updateModeUI(mode) {
  const modeValEl = document.getElementById('dash-mode-val');
  const btnAuto = document.getElementById('btn-mode-auto');
  const btnManual = document.getElementById('btn-mode-manual');
  const lockBanner = document.getElementById('controls-lock-banner');

  if (modeValEl) {
    modeValEl.innerText = mode === 'AUTO' ? 'تلقائي (AUTO)' : 'يدوي (MANUAL)';
  }

  const isAuto = (mode === 'AUTO');

  if (btnAuto && btnManual) {
    if (isAuto) {
      btnAuto.style.background = '#0284c7';
      btnAuto.style.color = '#ffffff';
      btnAuto.setAttribute('onclick', 'void(0)');
      
      btnManual.style.background = '#334155';
      btnManual.style.color = '#94a3b8';
      btnManual.setAttribute('onclick', "promptModeChange('MANUAL')");
    } else {
      btnManual.style.background = '#ea580c';
      btnManual.style.color = '#ffffff';
      btnManual.setAttribute('onclick', 'void(0)');

      btnAuto.style.background = '#334155';
      btnAuto.style.color = '#94a3b8';
      btnAuto.setAttribute('onclick', "promptModeChange('AUTO')");
    }
  }

  if (lockBanner) {
    lockBanner.style.display = isAuto ? 'flex' : 'none';
  }

  const deviceSwitches = document.querySelectorAll('#tab-controls input[type="checkbox"]');
  deviceSwitches.forEach(sw => {
    sw.disabled = isAuto;
  });
}

function setSystemMode(newMode) {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify({ mode: newMode });
    mqttClient.publish(MQTT_CONFIG.topics.commands, payload);
    updateModeUI(newMode);
  } else {
    alert('التطبيق غير متصل بالسيرفر حالياً!');
  }
}

function toggleDevice(deviceId, state) {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify({ 
      device: deviceId, 
      state: state ? "ON" : "OFF"
    });
    mqttClient.publish(MQTT_CONFIG.topics.commands, payload);
  } else {
    alert('التطبيق غير متصل بالسيرفر حالياً!');
  }
}

// ==========================================
// Dynamic Monitoring Chart Logic (Sensor & Time Filters)
// ==========================================
let activeSensor = 'waterTemp';
let activeTimeRange = '24h';

// Mock Historical Datasets for Filters
const mockChartData = {
  waterTemp: {
    label: 'حرارة الماء (°C)',
    color: '#0284c7',
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
    color: '#06b6d4',
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

// Change Sensor Event handler
function changeChartSensor(sensorKey) {
  activeSensor = sensorKey;
  updateMainChart();
}

// Change Time Filter Event handler
function filterChartTime(rangeKey, btnElement) {
  document.querySelectorAll('.btn-time').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  activeTimeRange = rangeKey;
  updateMainChart();
}

// Update Dynamic Line Chart
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

// Gauges Helper Functions
function createSemiGauge(elementId, value, min, max, color) {
  const canvas = document.getElementById(elementId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [value - min, max - value],
        backgroundColor: [color, '#e2e8f0'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      rotation: -90,
      circumference: 180,
      cutout: '80%',
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false }
      }
    }
  });
}

function initGaugeCharts() {
  charts.gauges.ph = createSemiGauge('gauge-ph', 6.2, 0, 14, '#22c55e');
  charts.gauges.ec = createSemiGauge('gauge-ec', 1.58, 0, 3, '#0284c7');
  charts.gauges.waterTemp = createSemiGauge('gauge-water-temp', 23.4, 10, 30, '#06b6d4');
  charts.gauges.waterLevel = createSemiGauge('gauge-water-level', 75, 0, 100, '#3b82f6');
}

function updateGaugeChart(gaugeInstance, val, min, max) {
  if (!gaugeInstance) return;
  const currentVal = Math.max(min, Math.min(val, max));
  gaugeInstance.data.datasets[0].data = [currentVal - min, max - currentVal];
  gaugeInstance.update();
}

        
