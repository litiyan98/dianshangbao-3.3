-- 1. 为 Users 表增加专属邀请码字段（全站唯一）
ALTER TABLE Users ADD COLUMN invite_code TEXT UNIQUE;

-- 2. 为 Users 表增加拉新记录字段（记录该用户是被谁邀请的）
ALTER TABLE Users ADD COLUMN invited_by TEXT;
