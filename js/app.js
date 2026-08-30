const MQTT_CONFIG = {
    host: 'wss://99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud:8884/mqtt',
    options: {
        username: 'hydro01-test',
        password: 'Atef269269',
        clientId: 'WebClient_' + Math.random().toString(16).substr(2, 8),
    },
    topics: { telemetry: 'greenhouse/GH001/telemetry', commands: 'greenhouse/GH001/commands' }
};

let client = null;
let alertLogs = [];
let tempChart = null;

// التشغيل الابتدائي
document.addEventListener('DOMContentLoaded', () => {
    initMQTT();
    initChart();
    if ("Notification" in window) Notification.requestPermission();
});

// إعداد MQTT
function initMQTT() {
    const status = document.getElementById('global-status-tag');
    client = mqtt.connect(MQTT_CONFIG.host, MQTT_CONFIG.options);

    client.on('connect', () => {
        status.className = 'connection-tag online';
        status.innerHTML = '<i class="fa-solid fa-circle"></i> متصل';
        client.subscribe(MQTT_CONFIG.topics.telemetry);
    });

    client.on('message', (topic, payload) => {
        const data = JSON.parse(payload.toString());
        updateSensorUI(data);
        evaluateAlarms(data);
        if(data.air_temp) updateChart(data.air_temp);
    });

    client.on('offline', () => {
        status.className = 'connection-tag offline';
        status.innerHTML = '<i class="fa-solid fa-circle"></i> غير متصل';
    });
}

// تحديث الواجهة
function updateSensorUI(data) {
    // تحديث النصوص والقيم مع ألوان ذكية
    const setVal = (id, val, isCritical) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = id.includes('dash') && id !== 'dash-ph' ? `${val} <small>${id.includes('temp') ? '°C' : id.includes('hum') ? '%' : 'mS'}</small>` : val;
        el.className = isCritical ? 'card-value value-critical' : 'card-value value-good';
    };

    if(data.air_temp !== undefined) setVal('dash-air-temp', data.air_temp, data.air_temp > 30);
    if(data.air_hum !== undefined) setVal('dash-air-hum', data.air_hum, data.air_hum < 40);
    if(data.ph !== undefined) setVal('dash-ph', data.ph, data.ph < 5.5 || data.ph > 6.5);
    if(data.ec !== undefined) setVal('dash-ec', data.ec, data.ec > 2.5);

    // إدارة وضع التشغيل وقفل الأزرار
    if(data.mode) {
        const mode = data.mode.toUpperCase();
        document.getElementById('dash-mode-val').innerText = mode === 'AUTO' ? 'تلقائي (AUTO)' : 'يدوي (MANUAL)';
        document.getElementById('btn-mode-auto').classList.toggle('active', mode === 'AUTO');
        document.getElementById('btn-mode-manual').classList.toggle('active', mode === 'MANUAL');
        document.getElementById('manual-controls-group').classList.toggle('disabled-overlay', mode === 'AUTO');
    }

    // تحديث حالة السويتشات
    if(data.pump !== undefined) document.getElementById('dev-pump').checked = (data.pump === 'ON' || data.pump === true);
    if(data.fan !== undefined) document.getElementById('dev-fan').checked = (data.fan === 'ON' || data.fan === true);
}

// إرسال الأوامر
function toggleDevice(device, state) {
    const cmd = JSON.stringify({ device, action: state ? "ON" : "OFF" });
    client.publish(MQTT_CONFIG.topics.commands, cmd);
}

function promptModeChange(newMode) {
    const modal = document.getElementById('mode-confirm-modal');
    document.getElementById('mode-confirm-text').innerText = `هل تريد التحويل إلى الوضع ${newMode === 'AUTO' ? 'التلقائي' : 'اليدوي'}؟`;
    document.getElementById('btn-confirm-action').onclick = () => {
        client.publish(MQTT_CONFIG.topics.commands, JSON.stringify({ mode: newMode }));
        modal.classList.remove('open');
    };
    modal.classList.add('open');
}

// الرسوم البيانية
function initChart() {
    const ctx = document.getElementById('chart-temp').getContext('2d');
    tempChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'حرارة الهواء', data: [], borderColor: '#16a34a', tension: 0.4 }] },
        options: { responsive: true, scales: { y: { beginAtZero: false } } }
    });
}

function updateChart(val) {
    const time = new Date().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
    tempChart.data.labels.push(time);
    tempChart.data.datasets[0].data.push(val);
    if(tempChart.data.labels.length > 10) { tempChart.data.labels.shift(); tempChart.data.datasets[0].data.shift(); }
    tempChart.update();
}

// التنبيهات
function evaluateAlarms(data) {
    const now = new Date().toLocaleTimeString();
    if(data.air_temp > 32) triggerAlarm("حرارة عالية!", `وصلت الحرارة إلى ${data.air_temp}`, now);
    if(data.ph < 5.0) triggerAlarm("خلل pH!", "مستوى الحموضة منخفض جداً", now);
}

function triggerAlarm(title, msg, time) {
    if(!alertLogs.some(l => l.title === title)) {
        alertLogs.unshift({title, msg, time});
        if(Notification.permission === "granted") new Notification(title, {body: msg});
    }
}

// الملاحة والمودال
function switchTab(tabId, btn) {
    document.querySelectorAll('.page-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function openSubPage(type) {
    const modal = document.getElementById('sub-page-modal');
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title');
    
    if(type === 'sub-alerts') {
        title.innerText = "سجل التنبيهات";
        body.innerHTML = alertLogs.length ? alertLogs.map(l => `<div class="alert-item"><b>${l.title}</b><br>${l.msg}<br><small>${l.time}</small></div>`).join('') : "لا توجد تنبيهات";
    }
    modal.classList.add('open');
}

function closeSubPage() { document.getElementById('sub-page-modal').classList.remove('open'); }
function closeModeModal() { document.getElementById('mode-confirm-modal').classList.remove('open'); }
function reconnectMQTT() { client.end(); initMQTT(); closeSubPage(); }
