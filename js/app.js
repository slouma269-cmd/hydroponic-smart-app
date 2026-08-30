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

// App Startup
document.addEventListener("DOMContentLoaded", () => {
  initMQTT();
  initCharts();
});

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

  if (subType === 'sub-nutrients') {
    title.innerText = "إدارة المغذيات";
    content.innerHTML = `
      <div class="card">
        <h4>تحديد الأهداف (Target Limits)</h4>
        <label style="display:block; margin-top:10px;">Target pH: <input type="number" step="0.1" value="6.0" class="input-field"></label>
        <label style="display:block; margin-top:10px;">Target EC: <input type="number" step="0.1" value="1.8" class="input-field"></label>
        <button class="btn-primary" style="margin-top:15px;" onclick="closeSubPage()">حفظ وتزامن</button>
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
  } else {
    title.innerText = "الصفحة الفرعية";
    content.innerHTML = `<p style="color:#64748b; margin-top:10px;">المحتوى قيد التطوير...</p>`;
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
    statusTag.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الاتصال بالكلود...';
  }

  try {
    mqttClient = mqtt.connect(MQTT_CONFIG.host, MQTT_CONFIG.options);

    mqttClient.on('connect', () => {
      console.log('Successfully connected to HiveMQ Cloud Cluster!');
      if (statusTag) {
        statusTag.className = 'connection-tag online';
        statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> متصل (HiveMQ Cloud)';
      }

      mqttClient.subscribe(MQTT_CONFIG.topics.telemetry, (err) => {
        if (!err) {
          console.log(`Subscribed to Cloud Topic: ${MQTT_CONFIG.topics.telemetry}`);
        }
      });
    });

    mqttClient.on('message', (topic, payload) => {
      console.log("Cloud Payload Received [" + topic + "]:", payload.toString());
      try {
        const data = JSON.parse(payload.toString());
        if (topic === MQTT_CONFIG.topics.telemetry) {
          updateSensorUI(data);
        }
      } catch (e) {
        console.error("JSON Error:", e);
      }
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
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

  // 1. Environmental & Water Values
  if (data.air_temp !== undefined) setHtml('dash-air-temp', `${data.air_temp} <small>°C</small>`);
  if (data.air_hum !== undefined) setHtml('dash-air-hum', `${data.air_hum} <small>%</small>`);
  if (data.water_temp !== undefined) setHtml('dash-water-temp', `${data.water_temp} <small>°C</small>`);
  if (data.tank_level !== undefined) setHtml('dash-water-level', `${data.tank_level} <small>%</small>`);

  // 2. Nutrients & Gauges
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

  // 3. System Mode Sync
  if (data.mode !== undefined) {
    const modeUpper = String(data.mode).toUpperCase();
    updateModeUI(modeUpper);
  }

  // 4. Relay Switches Sync
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

// Function to update System Mode Buttons and Lock/Unlock manual controls
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

  // Lock or unlock manual switches
  const deviceSwitches = document.querySelectorAll('#tab-controls input[type="checkbox"]');
  deviceSwitches.forEach(sw => {
    sw.disabled = (mode === 'AUTO');
  });
}

// Send Mode Switch Command to ESP32
function setSystemMode(newMode) {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify({ mode: newMode });
    mqttClient.publish(MQTT_CONFIG.topics.commands, payload);
    console.log("Published System Mode Command:", payload);
    
    updateModeUI(newMode);
  } else {
    alert('التطبيق غير متصل بالسيرفر حالياً!');
  }
}

// Relay Control Command Publisher
function toggleDevice(deviceId, state) {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify({ 
      device: deviceId, 
      state: state ? "ON" : "OFF"
    });
    mqttClient.publish(MQTT_CONFIG.topics.commands, payload);
    console.log("Published Command to Cloud:", payload);
  } else {
    alert('التطبيق غير متصل بالسيرفر حالياً!');
  }
}

// Render History Charts
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
      
