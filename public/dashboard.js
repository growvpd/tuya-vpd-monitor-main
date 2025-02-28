// URL do backend para buscar o histórico e os dados em tempo real
const apiUrl = 'https://tuya-vpd-monitor.onrender.com/vpd/history';
const realTimeUrl = 'https://tuya-vpd-monitor.onrender.com/vpd'; // Para dados em tempo real

// Função genérica para criar gráficos
async function createChart(canvasId, label, yAxisLabel, dataKey, maxAdjustment, customOptions = {}) {
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data || data.length === 0) {
      console.warn(`Nenhum dado disponível para o gráfico de ${label}.`);
      return;
    }
    
        // *** FILTRAR OS DADOS DAS ÚLTIMAS 12 HORAS ***
        const now = new Date(); // Hora atual
        const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 horas atrás
    
        // Filtrar os dados que são mais recentes que 12 horas
        const filteredData = data.filter((item) => {
          const timestamp = new Date(
            item._id.year,
            item._id.month - 1, // Ajuste para meses baseados em 0
            item._id.day,
            item._id.hour,
            item._id.minute || 0 // Use 0 se minutos não forem fornecidos
          );
          return timestamp >= twelveHoursAgo;
        });
    
        console.log("Dados filtrados (últimas 12 horas):", filteredData);
    
        // *** FIM DA FILTRAGEM ***

    // Processar os dados agregados: ajustar o horário para UTC-3
    const labels = filteredData.map((item) => {
      try {
        // Validar a existência dos campos de data
        if (
          !item._id.year ||
          !item._id.month ||
          !item._id.day ||
          !item._id.hour ||
          !item._id.minute
        ) {
          console.warn('Dados de data incompletos:', item._id);
          return 'Data Inválida'; // Retorna uma string de fallback
        }
    
        // Criar a data e ajustar para UTC-3
        const timestamp = new Date(
          item._id.year,
          item._id.month - 1,
          item._id.day,
          item._id.hour,
          item._id.minute
        );
    
        if (isNaN(timestamp.getTime())) {
          console.warn('Timestamp inválido:', item._id);
          return 'Data Inválida';
        }
    
        const localTime = new Date(timestamp.getTime() - 3 * 60 * 60 * 1000);
    
        // Formatar como hora:minuto:segundo
        return localTime.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch (error) {
        console.error('Erro ao processar data:', error);
        return 'Data Inválida';
      }
    });
    

    const chartData = filteredData.map((item) => item[dataKey]);
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    canvas.style.height = '400px';
    canvas.style.width = '100%';

    // Remover gráfico existente se já criado
    if (window[`${canvasId}Instance`]) {
      window[`${canvasId}Instance`].destroy();
    }
    const chartOptions = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `${label} por 5 Minutos`,
            data: chartData,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderWidth: 0.4,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
             // Adicionar cores aos pontos de vpd
            ...(canvasId === 'vpdChart' && {
              pointBackgroundColor: chartData.map((value) => {
                if (value < 0.4 || value > 1.6) return 'red';
                if (value >= 0.4 && value < 0.8) return 'green';
                if (value >= 0.8 && value < 1.2) return 'blue';
                if (value >= 1.2 && value <= 1.6) return 'purple';
                return 'gray';
              }),
            }),
            // Adicionar cores aos pontos de temperatura
            ...(canvasId === 'temperatureChart' && {
              pointBackgroundColor: chartData.map((value) => {
                if (value < 18 || value >= 29) return 'red';
                if (value >= 24 && value < 29) return 'green';
                if (value >= 18 && value <= 24) return 'purple';
                return 'gray';
              }),
            }),
                // Adicionar cores aos pontos de umidade
            ...(canvasId === 'humidityChart' && {
              pointBackgroundColor: chartData.map((value) => {
                if (value < 35 || value > 80) return 'red';
                if (value >= 35 && value < 51) return 'purple';
                if (value >= 51 && value < 71) return 'blue';
                if (value >= 71 && value <= 80) return 'green';
          }),
          }),
        }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Gráfico de ${label} (Agregado por 5 Minutos)`,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Tempo',
            },
          },
          y: {
            title: {
              display: true,
              text: yAxisLabel,
            },
            min: 0,
            max: Math.max(...chartData) + maxAdjustment,
          },
        },
        layout: {
          padding: {
            top: 10,
            bottom: 10,
          },
        },
        ...customOptions,
      },
    };

    if (!chartData || chartData.length === 0) {
      console.warn(`Nenhum dado válido para o gráfico de ${label}.`);
      return;
    }

    // Criar o novo gráfico
    window[`${canvasId}Instance`] = new Chart(ctx, chartOptions);
  } catch (error) {
    console.error(`Erro ao buscar dados para o gráfico de ${label}:`, error);
  }
}

// Função para exibir o VPD em tempo real
async function showRealTimeVPD() {
  try {
    const response = await fetch(realTimeUrl);
    const data = await response.json();

    const vpdElement = document.getElementById('realTimeVPD');
    const vpdValue = parseFloat(data.vpd).toFixed(2);

    // Alterar o texto e cor baseado no valor do VPD
    if (vpdValue < 0.4 || vpdValue > 1.6) {
      vpdElement.style.color = 'red';
      vpdElement.innerHTML = `VPD Atual: ${vpdValue} kPa (Danger Zone)`;
    } else if (vpdValue >= 0.4 && vpdValue < 0.8) {
      vpdElement.style.color = 'green';
      vpdElement.innerHTML = `VPD Atual: ${vpdValue} kPa (Propagation / Early Veg Stage)`;
    } else if (vpdValue >= 0.8 && vpdValue < 1.2) {
      vpdElement.style.color = 'blue';
      vpdElement.innerHTML = `VPD Atual: ${vpdValue} kPa (Late Veg / Early Flower Stage)`;
    } else if (vpdValue >= 1.2 && vpdValue <= 1.6) {
      vpdElement.style.color = 'purple';
      vpdElement.innerHTML = `VPD Atual: ${vpdValue} kPa (Mid / Late Flower Stage)`;
    }
  } catch (error) {
    console.error('Erro ao buscar dados em tempo real:', error);
  }
}

// Inicializar os gráficos
createChart('vpdChart', 'VPD', 'VPD (kPa)', 'avgVPD', 0.4);
createChart('temperatureChart', 'Temperatura', 'Temperatura (°C)', 'avgTemperature', 5);
createChart('humidityChart', 'Umidade', 'Umidade (%)', 'avgHumidity', 10);

// Atualizar os gráficos e os dados periodicamente
setInterval(() => {
  createChart('vpdChart', 'VPD', 'VPD (kPa)', 'avgVPD', 0.4);
  createChart('temperatureChart', 'Temperatura', 'Temperatura (°C)', 'avgTemperature', 5);
  createChart('humidityChart', 'Umidade', 'Umidade (%)', 'avgHumidity', 10);
}, 300000);


// Função para atualizar os valores de temperatura, umidade e VPD

async function updateMetrics() {
  try {
    console.log('Atualizando métricas...');
    const response = await fetch(realTimeUrl);
    const data = await response.json();

    console.log('Dados recebidos:', data);

    // Atualizar valores na interface
    if (document.getElementById('currentTemperature')) {
      document.getElementById('currentTemperature').innerText = `${data.temperature} °C`;
    }
    if (document.getElementById('currentHumidity')) {
      document.getElementById('currentHumidity').innerText = `${data.humidity} %`;
    }
    if (document.getElementById('currentVPD')) {
      document.getElementById('currentVPD').innerText = `${parseFloat(data.vpd).toFixed(2)} kPa`;
    }
  } catch (error) {
    console.error('Erro ao buscar dados em tempo real:', error);
  }
}

// Atualizar métricas periodicamente
updateMetrics();
setInterval(updateMetrics, 15000);

showRealTimeVPD();
setInterval(showRealTimeVPD, 15000);

