const axios = require('axios');
const crypto = require('crypto');

// Configurações
const debug = true;
const ClientID = "sjsmr9rtnsn8fgj7rrce";
const ClientSecret = "9bb34ec30170490eb03dd45532f1bf53";
const BaseUrl = "https://openapi.tuyaus.com";
const EmptyBodyEncoded = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const deviceIds = "eb8faf00e42469ffaahezh";

// Função para gerar a assinatura HMAC-SHA256
function generateSignature(stringToSign, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex')
    .toUpperCase();
}

// Obter token de acesso
async function getAccessToken() {
  const tuyatime = `${Date.now()}`; // Gera um timestamp a cada requisição
  const URL = "/v1.0/token?grant_type=1";
  const StringToSign = `${ClientID}${tuyatime}GET\n${EmptyBodyEncoded}\n\n${URL}`;
  if (debug) console.log(`StringToSign is now: ${StringToSign}`);

  const AccessTokenSign = generateSignature(StringToSign, ClientSecret);
  if (debug) console.log(`AccessTokenSign is now: ${AccessTokenSign}`);

  try {''
    const response = await axios.get(`${BaseUrl}${URL}`, {
      headers: {
        'sign_method': 'HMAC-SHA256',
        'client_id': ClientID,
        't': tuyatime,
        'mode': 'cors',
        'Content-Type': 'application/json',
        'sign': AccessTokenSign,
      },
    });
    if (debug) console.log(`AccessTokenResponse is now:`, response.data);
    return response.data.result.access_token;
  } catch (error) {
    console.error("Error fetching Access Token:", error.message);
    throw error;
  }
}

// Obter status do dispositivo
async function getDeviceStatus(accessToken, deviceIds) {
  const tuyatime = `${Date.now()}`; // Gera um timestamp a cada requisição
  const URL = `/v1.0/iot-03/devices/status?device_ids=${deviceIds}`;
  const StringToSign = `${ClientID}${accessToken}${tuyatime}GET\n${EmptyBodyEncoded}\n\n${URL}`;
  if (debug) console.log(`StringToSign is now: ${StringToSign}`);

  const RequestSign = generateSignature(StringToSign, ClientSecret);
  if (debug) console.log(`RequestSign is now: ${RequestSign}`);

  try {
    const response = await axios.get(`${BaseUrl}${URL}`, {
      headers: {
        'sign_method': 'HMAC-SHA256',
        'client_id': ClientID,
        't': tuyatime,
        'mode': 'cors',
        'Content-Type': 'application/json',
        'sign': RequestSign,
        'access_token': accessToken,
      },
    });
    if (debug) console.log(`RequestResponse is now:`, response.data);
    return response.data.result;
  } catch (error) {
    console.error("Error fetching Device Status:", error.message);
    throw error;
  }
}

// Função para obter os dados do dispositivo (token + status)
let cachedData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // Cache válido por 5 minutos

async function fetchTuyaDataWithCache(deviceIds) {
  if (cachedData && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log("Retornando dados do cache.");
    return cachedData;
  }

  const accessToken = await getAccessToken();
  const deviceStatus = await getDeviceStatus(accessToken, deviceIds);

  cachedData = deviceStatus; // Atualiza o cache
  cacheTimestamp = Date.now(); // Atualiza o timestamp
  console.log("Dados atualizados no cache.");
  return cachedData;
}

// Variavel para checar temperatura no ar
let checkTemperature = null;

// Função para extrair temperatura e umidade do status do dispositivo
function extractTemperatureAndHumidity(deviceStatus) {
  let temperature = null;
  let humidity = null;

  deviceStatus.forEach((device) => {
    device.status.forEach((item) => {
      if (item.code === 'va_temperature') {
        temperature = item.value / 10; // Normalizar para °C, se necessário
      } else if (item.code === 'va_humidity') {
        humidity = item.value / 10;
      }
    });
  });

  console.log("Temperatura:", JSON.stringify(temperature, null, 2));
  console.log("Humidade:", JSON.stringify(humidity, null, 2));

  if (temperature === null || humidity === null) {
    throw new Error('Não foi possível encontrar temperatura ou umidade no status do dispositivo.');
  }

  return { temperature, humidity };

}

// Função para obter e atualizar a temperatura atual do dispositivo
async function updateTemperature() {
  try {
    // Obtém o status do dispositivo utilizando a função com cache para evitar chamadas redundantes
    const deviceStatus = await fetchTuyaDataWithCache(deviceIds);

    // Extrai a temperatura e a umidade do status do dispositivo retornado
    const { temperature } = extractTemperatureAndHumidity(deviceStatus);

    // Atualiza a variável global `checkTemperature` com a temperatura obtida
    checkTemperature = temperature;

    // Loga a temperatura atualizada no console para fins de depuração
    console.log("Temperatura check atualizada:", checkTemperature);
  } catch (error) {
    // Em caso de erro, exibe uma mensagem de erro no console com detalhes
    console.error("Erro ao atualizar temperatura check:", error.message);
  }
}

// Exportações
module.exports = {
  getAccessToken,
  getDeviceStatus,
  fetchTuyaDataWithCache,
  extractTemperatureAndHumidity,
  deviceIds,
  ClientID,
  ClientSecret,
  getAccessToken,
  generateSignature,
  BaseUrl,
  EmptyBodyEncoded,
  debug,
  getTemperature: () => checkTemperature,
  updateTemperature,
};
  
// Apenas para testes manuais ou depuração, não necessário na execução contínua
if (debug) {
  (async function () {
    try {
      const deviceStatus = await fetchTuyaDataWithCache(deviceIds);
      console.log("Device Status:", deviceStatus);

      const { temperature, humidity } = extractTemperatureAndHumidity(deviceStatus);
      console.log("Temperatura:", temperature, "Humidade:", humidity, "Check Temperature:", checkTemperature);
    } catch (error) {
      console.error("An error occurred:", error.message);
    }
  })(); 
}

// Exporte a função no arquivo tuya.js
function generateSignature(stringToSign, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex')
    .toUpperCase();
}

// Adicione a função getAccessToken ao module.exports no tuya.js
async function getAccessToken() {
  const tuyatime = `${Date.now()}`;
  const URL = "/v1.0/token?grant_type=1";
  const StringToSign = `${ClientID}${tuyatime}GET\n${EmptyBodyEncoded}\n\n${URL}`;
  const AccessTokenSign = generateSignature(StringToSign, ClientSecret);

  try {
    const response = await axios.get(`${BaseUrl}${URL}`, {
      headers: {
        sign_method: "HMAC-SHA256",
        client_id: ClientID,
        t: tuyatime,
        mode: "cors",
        "Content-Type": "application/json",
        sign: AccessTokenSign,
      },
    });
    return response.data.result.access_token;
  } catch (error) {
    console.error("Error fetching Access Token:", error.message);
    throw error;
  }
}

