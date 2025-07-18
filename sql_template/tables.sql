-- 1. users 用户表

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 2. currencies 货币表
CREATE TABLE currencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,  -- 如 USD, EUR
  name VARCHAR(100) NOT NULL
);
-- 3. base_exchange_rates 基准汇率表（USD ➝ 其他） 用于存储每天 USD ➝ 各种目标货币 的汇率
CREATE TABLE base_exchange_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  base VARCHAR(10) NOT NULL DEFAULT 'USD',
  target VARCHAR(10) NOT NULL,      -- 如 EUR, CNY
  rate DECIMAL(10, 6) NOT NULL,     -- USD ➝ target
  date DATE NOT NULL,
  UNIQUE KEY uniq_rate (target, date)
);

-- 4. exchange_rates 计算后存储的所有组合（可选，可做缓存）  通过 base 表推算得来的 CNY ➝ EUR、GBP ➝ JPY 等组合
CREATE TABLE exchange_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  rate DECIMAL(10, 6) NOT NULL,
  date DATE NOT NULL,
  UNIQUE KEY uniq_full (from_currency, to_currency, date)
);

