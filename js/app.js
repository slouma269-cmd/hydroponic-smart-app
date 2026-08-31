document.addEventListener("DOMContentLoaded", () => {
  initGauges();
  initHistoryCharts();
});

// Switch Tabs Logic
function switchTab(tabId, navElement) {
  document.querySelectorAll('.page-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  navElement.classList.add('active');
}

// Toggle Submenu Accordion
function toggleMenu(headerElement) {
  const menuItem = headerElement.parentElement;
  menuItem.classList.toggle('active');

  const icon = headerElement.querySelector('.arrow-icon');
  if (menuItem.classList.contains('active')) {
    icon.className = 'fa-solid fa-chevron-down arrow-icon';
  } else {
    icon.className = 'fa-solid fa-chevron-left arrow-icon';
  }
}

// Initialize Quick Semi-Circle Gauges for Monitoring Tab
function initGauges() {
  createGauge('gauge-ph', 6.1, 14, '#22c55e');
  createGauge('gauge-ec', 1.8, 5, '#22c55e');
  createGauge('gauge-watertemp', 21, 40, '#f97316');
  createGauge('gauge-waterlevel', 80, 100, '#0284c7');
}

function createGauge(canvasId, value, maxVal, color) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [value, maxVal - value],
        backgroundColor: [color, '#e2e8f0'],
        borderWidth: 0
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: '75%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { tooltip: { enabled: false }, legend: { display: false } }
    }
  });
}

// Initialize History Tab Charts
function initHistoryCharts() {
  // Chart 1: Air Temp & Humidity
  const ctxEnv = document.getElementById('chart-env');
  if (ctxEnv) {
    new Chart(ctxEnv, {
      type: 'line',
      data: {
        labels: ['10:00', '12:00', '13:00', '13:00', '15:00', '15:00'],
        datasets: [
          {
            label: 'Air Temp',
            data: [27, 26, 28, 27, 28, 29],
            borderColor: '#0284c7',
            tension: 0.4,
            pointRadius: 2
          },
          {
            label: 'Humidity',
            data: [40, 42, 38, 39, 41, 40],
            borderColor: '#16a34a',
            tension: 0.4,
            pointRadius: 2
          }
        ]
      },
      options: chartOptions()
    });
  }

  // Chart 2: Water Temp & Level
  const ctxWater = document.getElementById('chart-water');
  if (ctxWater) {
    new Chart(ctxWater, {
      type: 'line',
      data: {
        labels: ['10:00', '12:00', '13:00', '13:00', '15:00', '15:00'],
        datasets: [
          {
            label: 'Water Temp',
            data: [21.5, 21.5, 21.0, 21.2, 21.5, 22.0],
            borderColor: '#ea580c',
            tension: 0.4,
            pointRadius: 2
          },
          {
            label: 'Level',
            data: [50, 55, 60, 62, 70, 80],
            borderColor: '#ca8a04',
            tension: 0.4,
            pointRadius: 2
          }
        ]
      },
      options: chartOptions()
    });
  }

  // Chart 3: pH & EC
  const ctxNutrients = document.getElementById('chart-nutrients');
  if (ctxNutrients) {
    new Chart(ctxNutrients, {
      type: 'line',
      data: {
        labels: ['10:00', '12:00', '12:00', '12:00', '13:00', '15:00'],
        datasets: [
          {
            label: 'pH',
            data: [7.5, 7.6, 7.5, 7.5, 7.6, 7.5],
            borderColor: '#9333ea',
            tension: 0.4,
            pointRadius: 2
          },
          {
            label: 'EC',
            data: [6.5, 6.2, 6.0, 5.8, 6.0, 6.1],
            borderColor: '#0891b2',
            tension: 0.4,
            pointRadius: 2
          }
        ]
      },
      options: chartOptions()
    });
  }
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { boxWidth: 8, font: { size: 9 } }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 8 } } },
      y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 8 } } }
    }
  };
    }
            
