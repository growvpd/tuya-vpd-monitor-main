const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const { 
  fetchTuyaDataWithCache, 
  extractTemperatureAndHumidity ,
  ClientID, 
  ClientSecret, 
  BaseUrl, 
  EmptyBodyEncoded, 
  deviceIds
} = require('./tuya');

// Conserto do device-control
const deviceControl = require("./device-control"); // Certifique-se do caminho correto para o arquivo device-control.js
// Middlewares necessários
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Rota para o dispositivo
app.use("/backend/device-control", deviceControl);

const app = express();
const PORT = 3000; // Porta onde o servidor vai rodar

// Configuração do MongoDB
require('dotenv').config(); // Carregar variáveis de ambiente do arquivo .env

mongoose.connect(process.env.MONGODB_URI, {})
  .then(() => console.log('Conectado ao MongoDB!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Esquema e Modelo para armazenar dados de VPD
const VPDData = mongoose.model('VPDData', new mongoose.Schema({
  temperature: Number,
  humidity: Number,
  vpd: Number,
  timestamp: { type: Date, default: Date.now },
}));

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Servir arquivos estáticos na pasta "public"
app.use(express.static(path.join(__dirname, '../public')));

// Rota para acessar o gráfico principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Rota para consultar o histórico agrupado por hora
app.get('/vpd/history', async (req, res) => {
  try {
    const history = await VPDData.aggregate([
      {
        $group: {
          _id: {
            hour: { $hour: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            minute: {$minute: "$timestamp"},
            month: { $month: "$timestamp" },
            year: { $year: "$timestamp" }
          },
          avgVPD: { $avg: "$vpd" },
          avgTemperature: { $avg: "$temperature" },
          avgHumidity: { $avg: "$humidity" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1, "_id.minute": 1  } }
    ]);

    res.json(history);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error.message);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

// Função para calcular o VPD
function calculateVPD(temperature, humidity) {
  const svp = 0.6108 * Math.exp((17.27 * temperature) / (temperature + 237.3)); // Pressão de vapor saturada (kPa)
  const avp = (humidity / 100) * svp; // Pressão de vapor atual (kPa)
  return svp - avp; // VPD
}

// Endpoint para consultar o VPD em tempo real
app.get('/vpd', async (req, res) => {
  try {
    const deviceStatus = await fetchTuyaDataWithCache(deviceIds);

    // Extrair temperatura e umidade
    const { temperature, humidity } = extractTemperatureAndHumidity(deviceStatus);

    // Calcular o VPD
    const vpd = calculateVPD(temperature, humidity);

    // Retornar os dados no formato JSON
    res.json({
      temperature,
      humidity,
      vpd: vpd.toFixed(2),
    });
  } catch (error) {
    console.error('Erro ao consultar VPD:', error.message);
    res.status(500).json({ error: 'Erro ao obter dados.' });
  }
});

// Função para salvar os dados a cada 5 minutos
async function saveVPDData() {
  try {
    const deviceStatus = await fetchTuyaDataWithCache(deviceIds);

    // Extrair temperatura e umidade
    const { temperature, humidity } = extractTemperatureAndHumidity(deviceStatus);

    // Calcular o VPD
    const vpd = calculateVPD(temperature, humidity);

    // Salvar no banco
    await new VPDData({ temperature, humidity, vpd }).save();
    console.log(`Dados salvos: Temperatura: ${temperature}, Umidade: ${humidity}, VPD: ${vpd.toFixed(2)}`);
  } catch (error) {
    console.error('Erro ao salvar dados:', error.message);
  }
}

// Configura o intervalo de 5 minutos
setInterval(saveVPDData, 5 * 60 * 1000);

// Inicia o servidor (apenas uma vez)
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

const axios = require("axios");

// Função para fazer ping no servidor a cada 5 minutos
setInterval(async () => {
  try {
    const response = await axios.get("https://tuya-vpd-monitor.onrender.com/");
    console.log(`Ping bem-sucedido: ${response.status}`);
  } catch (error) {
    console.error("Erro ao fazer ping no servidor:", error.message);
  }
}, 5 * 60 * 1000); // Executa a cada 5 minutos

// Integre o controle de dispositivo do roteador ao server.js:
const deviceControlRouter = require("./device-control");

// Adicionar rota para o controle de dispositivos
app.use("/api/device-control", deviceControlRouter);