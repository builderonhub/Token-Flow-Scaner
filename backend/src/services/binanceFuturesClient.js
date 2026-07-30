const axios = require("axios");
const env = require("../config/env");

const http = axios.create({
  baseURL: env.binanceRest,
  timeout: 15000,
});

async function getExchangeInfo() {
  const res = await http.get("/fapi/v1/exchangeInfo");
  return res.data;
}

async function get24hTickers() {
  const res = await http.get("/fapi/v1/ticker/24hr");
  return res.data;
}

async function getOpenInterest(symbol) {
  const res = await http.get("/fapi/v1/openInterest", {
    params: { symbol },
  });
  return res.data;
}

async function getPremiumIndex() {
  const res = await http.get("/fapi/v1/premiumIndex");
  return res.data;
}

module.exports = {
  getExchangeInfo,
  get24hTickers,
  getOpenInterest,
  getPremiumIndex,
};