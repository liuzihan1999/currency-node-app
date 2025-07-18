const express = require("express");
const axios = require("axios");
const router = express.Router();

const BaseExchangeRate = require("../models/BaseExchangeRate");
const Currency = require("../models/Currency");

// [xe-feature-02] Store historical exchange rates (USD → all)
router.get("/xe-feature-02/fetch-history", async (req, res) => {
  const { start = "2024-07-01", end = "2024-07-07" } = req.query;

  try {
    const allCurrencies = await Currency.findAll();
    const symbols = allCurrencies.map(c => c.code).join(",");

    const response = await axios.get("https://api.exchangerate.host/timeseries", {
      params: {
        base: "USD",
        start_date: start,
        end_date: end,
        symbols,
      },
    });

    const data = response.data;
    const insertList = [];

    for (const [date, dailyRates] of Object.entries(data.rates)) {
      for (const [target, rate] of Object.entries(dailyRates)) {
        insertList.push({
          base: "USD",
          target,
          rate,
          date,
        });
      }
    }

    await BaseExchangeRate.bulkCreate(insertList, {
      ignoreDuplicates: true,
    });

    res.json({ message: `Stored ${insertList.length} base exchange rate records` });
  } catch (err) {
    console.error("Error fetching historical exchange rates", err);
    res.status(500).json({ error: "Failed to fetch or store rates" });
  }
});

module.exports = router;
