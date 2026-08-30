// MQTT Global Configuration
const MQTT_CONFIG = {
  host: 'wss://broker.hivemq.com:8884/mqtt',
  topics: {
    sensors: 'greenhouse/GH001/sensors',
    devices: 'greenhouse/GH001/devices',
    commands: 'greenhouse/GH001/commands'
  }
};

let mqttClient = null;

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
        <label style="display:block;">Target EC: <input type="number" step="0.1" value="1.8" class="input-field"></label>
        <button class="btn-primary" onclick="closeSubPage()">حفظ وتزامن</button>
      </div>`;
  } else if (subType === 'sub-mqtt') {
    title.innerText = "إعدادات MQTT والشبكة";
    content.innerHTML = `
      <div class="card">
        <label style="display:block;">Broker Host:</label>
        <input type="text" value="${MQTT_CONFIG.host}" class="input-field">
        <label style="display:block;">Greenhouse ID:</label>
        <input type="text" value="GH001" class="input-field">
        <button class="btn-primary" onclick="closeSubPage()">حفظ وإعادة الاتصال</button>
      </div>`;
  } else {
    title.innerText = "الصفحة الفرعية";
    content.innerHTML = `<p style="color:#64748b; margin-top:10px;">المحتوى قيد التطوير والربط...</p>`;
  }
}

function closeSubPage() {
  document.getElementById('sub-page-modal').classList.remove('open');
}

// MQTT Engine Real-Time Communications
function initMQTT() {
  try {
    mqttClient = mqtt.connect(MQTT_CONFIG.host);

    mqttClient.on('connect', () => {
      console.log('Connected to HiveMQ WSS successfully!');
      const statusTag = document.getElementById('global-status-tag');
      statusTag.className = 'connection-tag online';
      statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> متصل';

      mqttClient.subscribe(MQTT_CONFIG.topics.sensors);
    });

    mqttClient.on('message', (topic, payload) => {
      const data = JSON.parse(payload.toString());
      if (topic === MQTT_CONFIG.topics.sensors) {
        updateSensorUI(data);
      }
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Error: ', err);
    });

  } catch (e) {
    console.error('MQTT Connection Initialization Failed', e);
  }
}

// Dynamic UI Update
function updateSensorUI(data) {
  if (data.airTemp) document.getElementById('dash-air-temp').innerHTML = `${data.airTemp} <small>°C</small>`;
  if (data.airHum) document.getElementById('dash-air-hum').innerHTML = `${data.airHum} <small>%</small>`;
  if (data.ph) {
    document.getElementById('dash-ph').innerText = data.ph;
    document.getElementById('gauge-ph-val').innerText = data.ph;
  }
  if (data.ec) {
    document.getElementById('dash-ec').innerText = data.ec;
    document.getElementById('gauge-ec-val').innerText = `${data.ec} mS/cm`;
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

