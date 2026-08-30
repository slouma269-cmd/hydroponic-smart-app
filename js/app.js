// MQTT Global Configuration with Fallbacks
const MQTT_CONFIG = {
  // الخادم الرئيسي والبديل للتأكد من عمل الاتصال في كافة المتصفحات
  primaryBroker: 'wss://broker.hivemq.com:8884/mqtt',
  fallbackBroker: 'wss://broker.emqx.io:8084/mqtt',
  
  clientId: 'Hydroponic_Web_' + Math.floor(Math.random() * 100000),
  
  topics: {
    sensors: 'greenhouse/GH001/sensors',
    devices: 'greenhouse/GH001/devices',
    commands: 'greenhouse/GH001/commands'
  }
};

let mqttClient = null;

// App Startup
document.addEventListener("DOMContentLoaded", () => {
  initMQTT(MQTT_CONFIG.primaryBroker);
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
        <label style="display:block; margin-bottom:5px;">حالة الاتصال الحالية:</label>
        <button class="btn-primary" style="background:#0284c7; margin-bottom:15px;" onclick="reconnectMQTT()">إعادة الاتصال بالخادم الآن 🔄</button>
        <label style="display:block;">Greenhouse ID:</label>
        <input type="text" value="GH001" class="input-field" readonly>
      </div>`;
  } else {
    title.innerText = "الصفحة الفرعية";
    content.innerHTML = `<p style="color:#64748b; margin-top:10px;">المحتوى قيد التطوير...</p>`;
  }
}

function closeSubPage() {
  document.getElementById('sub-page-modal').classList.remove('open');
}

// MQTT Engine Real-Time Communications
function initMQTT(brokerUrl) {
  const statusTag = document.getElementById('global-status-tag');
  
  // قطع أي اتصال سابق إن وجد
  if (mqttClient) {
    try { mqttClient.end(true); } catch(e) {}
  }

  statusTag.className = 'connection-tag offline';
  statusTag.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الاتصال...';

  try {
    mqttClient = mqtt.connect(brokerUrl, {
      clientId: MQTT_CONFIG.clientId,
      keepalive: 60,
      reconnectPeriod: 3000,
      connectTimeout: 5000,
      clean: true
    });

    mqttClient.on('connect', () => {
      console.log(`Connected successfully to MQTT Broker: ${brokerUrl}`);
      statusTag.className = 'connection-tag online';
      statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> متصل (GH001)';

      // Subscribe to topics
      mqttClient.subscribe(MQTT_CONFIG.topics.sensors);
      mqttClient.subscribe(MQTT_CONFIG.topics.devices);
    });

    mqttClient.on('message', (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (topic === MQTT_CONFIG.topics.sensors) {
          updateSensorUI(data);
        }
      } catch (e) {
        console.error("JSON Error:", e);
      }
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Error:', err);
      // تجربة الخادم البديل في حال فشل الخادم الرئيسي
      if (brokerUrl === MQTT_CONFIG.primaryBroker) {
        console.warn('Switching to Fallback Broker...');
        initMQTT(MQTT_CONFIG.fallbackBroker);
      } else {
        statusTag.className = 'connection-tag offline';
        statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> غير متصل';
      }
    });

    mqttClient.on('offline', () => {
      statusTag.className = 'connection-tag offline';
      statusTag.innerHTML = '<i class="fa-solid fa-circle"></i> غير متصل';
    });

  } catch (e) {
    console.error('MQTT Init Exception:', e);
  }
}

function reconnectMQTT() {
  initMQTT(MQTT_CONFIG.primaryBroker);
  closeSubPage();
}

// Dynamic UI Update
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

// Control Relays Command Publisher
function toggleDevice(deviceId, state) {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify({ 
      device: deviceId, 
      state: state ? "ON" : "OFF"
    });
    mqttClient.publish(MQTT_CONFIG.topics.commands, payload);
  } else {
    alert('تعذر إرسال الأمر: التطبيق غير متصل بالسيرفر حالياً.');
  }
}

// Render History Charts
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
