-- 1. 用户资产表 (Users)
CREATE TABLE IF NOT EXISTS Users (
    user_id TEXT PRIMARY KEY,           -- Authing 传来的 sub/userId
    credits INTEGER NOT NULL DEFAULT 10, -- 默认赠送 10 个算力点
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 支付订单表 (Orders)
CREATE TABLE IF NOT EXISTS Orders (
    out_trade_no TEXT PRIMARY KEY,      -- 系统生成的唯一订单号 (发给支付宝的凭证)
    user_id TEXT NOT NULL,              -- 关联 Users 表的 user_id
    package_type TEXT NOT NULL,         -- 购买的套餐标识 (如: basic_50_points)
    amount DECIMAL(10, 2) NOT NULL,     -- 订单金额 (如: 19.90)
    status TEXT NOT NULL DEFAULT 'PENDING', -- 状态: PENDING / SUCCESS / FAILED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON Orders(user_id);
