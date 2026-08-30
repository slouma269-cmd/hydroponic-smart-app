// MQTT Configuration - greenhouse/GH001
const MQTT_CONFIG = {
  // استخدام منفذ WebSocket الآمن (Port 8884) مع المسار الأصلي لـ HiveMQ
  host: 'wss://broker.hivemq.com:8884/mqtt',
  clientId: 'HydroponicApp_' + Math.random().toString(16).substr(2, 8),
  topics: {
    sensors: 'greenhouse/GH001/sensors',
    devices: 'greenhouse/GH001/devices',
    commands: 'greenhouse/GH001/commands'
  }
};

let mqttClient = null;

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initMQTT();
  initCharts();
});

// Navigation Switcher
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
        <label style="display:block;">Target EC: <input type="number" step="0.1" value="1.8" class="input-field"></label>
        <button class="btn-primary" onclick="closeSubPage()">حفظ وتزامن</button>
      </div>`;
  } else if (subType === 'sub-mqtt') {
    title.innerText = "إعدادات MQTT والشبكة";
    content.innerHTML = `
      <div class="card">
        <label style="display:block;">Broker Host:</label>
        <input type="text" id="cfg-host" value="${MQTT_CONFIG.host}" class="input-field">
        <label style="display:block;">Greenhouse ID Topic:</label>
        <input type="text" id="cfg-topic" value="${MQTT_CONFIG.topics.sensors}" class="input-field" readonly>
        <button class="btn-primary" onclick="closeSubPage()">حفظ وإعادة الاتصال</button>
      </div>`;
  } else {
    title.innerText = "الصفحة الفرعية";
    content.innerHTML = `<p style="color:#64748b; margin-top:10px;">المحتوى قيد التطوير...</p>`;
  }
}

function closeSubPage() {
  document.getElementById('sub-page-modal').classList.remove('open');
}

// MQTT Client Connection Engine
function initMQTT() {
  const statusTag = document.getElementById('global-status-tag');
  
  try {
    // الاتصال مع تحديد Client ID فريد وتفعيل Reconnect تلقائياً
    mqttClient = mqtt.connect(MQTT_CONFIG.host, {
      clientId: MQTT_CONFIG.clientId,
      keepalive: 60,
      reconnectPeriod: 2000,
      clean: true
    });

    mqttClient.on('connect', () => {
      console.log('Connected to HiveMQ MQTT Broker!');
      
      // تحديث حالة الواجهة إلى متصل باللون الأخضر
      statusTag.className = 'connection-tag online';
      statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> متصل (GH001)';

      // الاشتراك في الـ Topics الخاصة بـ greenhouse/GH001
      mqttClient.subscribe(MQTT_CONFIG.topics.sensors, (err) => {
        if (!err) {
          console.log(`Subscribed successfully to: ${MQTT_CONFIG.topics.sensors}`);
        }
      });
      mqttClient.subscribe(MQTT_CONFIG.topics.devices);
    });

    mqttClient.on('message', (topic, payload) => {
      console.log(`Received payload from [${topic}]:`, payload.toString());
      try {
        const data = JSON.parse(payload.toString());
        if (topic === MQTT_CONFIG.topics.sensors) {
          updateSensorUI(data);
        }
      } catch (e) {
        console.error("Error parsing MQTT JSON:", e);
      }
    });

    mqttClient.on('offline', () => {
      statusTag.className = 'connection-tag offline';
      statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> غير متصل';
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Error: ', err);
      statusTag.className = 'connection-tag offline';
      statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> خطأ اتصال';
    });

  } catch (e) {
    console.error('MQTT Initialization Failed', e);
  }
}

// Dynamic Sensor UI Updater
function updateSensorUI(data) {
  if (data.airTemp !== undefined) document.getElementById('dash-air-temp').innerHTML = `${data.airTemp} <small>°C</small>`;
  if (data.airHum !== undefined) document.getElementById('dash-air-hum').innerHTML = `${data.airHum} <small>%</small>`;
  if (data.waterTemp !== undefined) document.getElementById('dash-water-temp').innerHTML = `${data.waterTemp} <small>°C</small>`;
  if (data.waterLevel !== undefined) document.getElementById('dash-water-level').innerHTML = `${data.waterLevel} <small>%</small>`;
  
  if (data.ph !== undefined) {
    document.getElementById('dash-ph').innerText = data.ph;
    document.getElementById('gauge-ph-val').innerText = data.ph;
  }
  if (data.ec !== undefined) {
    document.getElementById('dash-ec').innerText = data.ec;
    document.getElementById('gauge-ec-val').innerText = `${data.ec} mS/cm`;
  }
}

// Device Control Command Publisher
function toggleDevice(deviceId, state) {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify({ 
      device: deviceId, 
      state: state ? "ON" : "OFF",
      timestamp: new Date().toISOString()
    });
    
    mqttClient.publish(MQTT_CONFIG.topics.commands, payload);
    console.log(`Published Command to ${MQTT_CONFIG.topics.commands}: ${payload}`);
  } else {
    alert('التطبيق غير متصل بسيرفر MQTT. يرجى التأكد من شبكة الإنترنت.');
  }
}

// Render Charts
function initCharts() {
  const ctx = document.getElementById('chart-temp').getContext('2d');
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
  }
}

// Device Switch Control
function toggleDevice(deviceId, state) {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify({ device: deviceId, state: state ? "ON" : "OFF" });
    mqttClient.publish(MQTT_CONFIG.topics.commands, payload);
    console.log(`Command Sent: ${payload}`);
  } else {
    alert('التطبيق غير متصل بالسيرفر!');
  }
}

// Chart.js Configuration
function initCharts() {
  const ctx = document.getElementById('chart-temp').getContext('2d');
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

