// HiveMQ Cloud Credentials & Topics Configuration
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

// System Alarm Thresholds
const ALARM_LIMITS = {
  maxAirTemp: 32.0,  
  minAirTemp: 15.0,  
  minWaterLevel: 20, 
  minPh: 5.5,        
  maxPh: 6.8         
};

// Log storage for alarms
let alertLogs = [];

// App Startup
document.addEventListener("DOMContentLoaded", () => {
  initMQTT();
  initCharts();
  checkNotificationStatus();
});

// Request Browser Notification Permission
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

// Push Browser Notification
function sendPushNotification(title, message) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body: message,
      icon: "https://cdn-icons-png.flaticon.com/512/628/628324.png",
      tag: title 
    });
  }
}

// Navigation Controller
function switchTab(tabId, btnElement) {
  document.querySelectorAll('.page-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  btnElement.classList.add('active');
}

// Menu Sub-Page Modal Controller
function openSubPage(subType) {
  const modal = document.getElementById('sub-page-modal');
  const title = document.getElementById('modal-title');
  const content = document.getElementById('modal-content');

  modal.classList.add('open');

  if (subType === 'sub-alerts') {
    title.innerText = "سجل الإنذارات والتنبيهات";
    
    let logsHtml = alertLogs.length === 0 
      ? `<p style="color:#64748b; text-align:center; padding: 20px;">لا توجد إنذارات حالية، النظام يعمل بشكل ممتاز 👍</p>`
      : alertLogs.map(log => `
          <div style="background:#fef2f2; border-right:4px solid #ef4444; padding:10px 12px; border-radius:6px; margin-bottom:8px;">
            <div style="font-weight:bold; color:#991b1b; font-size:0.9rem;">${log.title}</div>
            <div style="color:#7f1d1d; font-size:0.85rem;">${log.message}</div>
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
          • حرارة الهواء القصوى: ${ALARM_LIMITS.maxAirTemp} °C<br>
          • أدنى مستوى للخزان: ${ALARM_LIMITS.minWaterLevel} %<br>
          • نطاق الحموضة (pH): ${ALARM_LIMITS.minPh} - ${ALARM_LIMITS.maxPh}
        </div>
      </div>
      <h4 style="margin-bottom:8px;">السجل الحالي (${alertLogs.length})</h4>
      <div style="max-height: 250px; overflow-y: auto;">
        ${logsHtml}
      </div>`;
  } else if (subType === 'sub-nutrients') {
    title.innerText = "إدارة المغذيات";
    content.innerHTML = `
      <div class="card">
        <h4>تحديد الأهداف (Target Limits)</h4>
        <label style="display:block; margin-top:10px;">Target pH: <input type="number" step="0.1" value="6.0" class="input-field"></label>
        <label style="display:block; margin-top:10px;">Target EC: <input type="number" step="0.1" value="1.8" class="input-field"></label>
        <button class="btn-primary" style="margin-top:15px; width:100%;" onclick="closeSubPage()">حفظ وتزامن</button>
      </div>`;
  } else if (subType === 'sub-mqtt') {
    title.innerText = "إعدادات HiveMQ Cloud";
    content.innerHTML = `
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

// Mode Confirmation Modal Functions
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

// MQTT Connection Engine
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
      console.log('Successfully connected to HiveMQ Cloud Cluster!');
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
        console.error("JSON Error:", e);
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
    console.error('MQTT Exception:', e);
  }
}

function reconnectMQTT() {
  initMQTT();
  closeSubPage();
}

// Evaluate Sensor Limits and Trigger Alarms
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
    sendPushNotification(title, message);
  }
}

// Dynamic UI Updater
function updateSensorUI(data) {
  const setHtml = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val;
  };

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  const setProgress = (selector, val) => {
    const el = document.querySelector(selector);
    if (el) el.value = parseFloat(val) || 0;
  };

  if (data.air_temp !== undefined) setHtml('dash-air-temp', `${data.air_temp} <small>°C</small>`);
  if (data.air_hum !== undefined) setHtml('dash-air-hum', `${data.air_hum} <small>%</small>`);
  if (data.water_temp !== undefined) setHtml('dash-water-temp', `${data.water_temp} <small>°C</small>`);
  if (data.tank_level !== undefined) setHtml('dash-water-level', `${data.tank_level} <small>%</small>`);

  if (data.ph !== undefined) {
    setText('dash-ph', data.ph);
    setText('gauge-ph-val', data.ph);
    setProgress('#tab-monitoring progress[max="14"]', data.ph);
  }
  
  if (data.ec !== undefined) {
    setHtml('dash-ec', `${data.ec} <small>mS</small>`);
    setText('gauge-ec-val', `${data.ec} mS/cm`);
    setProgress('#tab-monitoring progress[max="5"]', data.ec);
  }

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

function updateModeUI(mode) {
  const modeValEl = document.getElementById('dash-mode-val');
  const btnAuto = document.getElementById('btn-mode-auto');
  const btnManual = document.getElementById('btn-mode-manual');

  if (modeValEl) {
    modeValEl.innerText = mode === 'AUTO' ? 'تلقائي (AUTO)' : 'يدوي (MANUAL)';
  }

  if (btnAuto && btnManual) {
    if (mode === 'AUTO') {
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

  const deviceSwitches = document.querySelectorAll('#tab-controls input[type="checkbox"]');
  deviceSwitches.forEach(sw => {
    sw.disabled = (mode === 'AUTO');
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

function initCharts() {
  const canvas = document.getElementById('chart-temp');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['01:00', '02:00', '03:00', '04:00', '05:00'],
      datasets: [{
        label: 'الحرارة C°',
        data: [26, 27.5, 28.5, 28, 29],
        borderColor: '#ea580c',
        backgroundColor: 'rgba(234, 88, 12, 0.1)',
        fill: true,
        tension: 0.4
      }]
    }
  });
                                      }
      
