import React, { useEffect, useMemo, useState } from 'react';
import { X, Copy, Loader2, Share2, Sparkles } from 'lucide-react';
import GloveIcon from './GloveIcon';

export type CreditTab = 'invite' | 'recharge';
export interface RechargePackage {
  packageType: string;
  label: string;
  amount: number;
  imageQuota: number;
  vipDays: number;
  recommended?: boolean;
  subject: string;
}

export const RECHARGE_PACKAGES: RechargePackage[] = [
  {
    packageType: 'starter_15_quota_7d_vip',
    label: '新手尝鲜包',
    amount: 9.9,
    imageQuota: 6,
    vipDays: 3,
    subject: '电商宝 Pro 新手尝鲜包',
  },
  {
    packageType: 'standard_80_quota_30d_vip',
    label: '电商爆单包',
    amount: 99,
    imageQuota: 70,
    vipDays: 30,
    recommended: true,
    subject: '电商宝 Pro 电商爆单包',
  },
  {
    packageType: 'enterprise_400_quota_90d_vip',
    label: '工作室尊享包',
    amount: 199,
    imageQuota: 150,
    vipDays: 90,
    subject: '电商宝 Pro 工作室尊享包',
  },
];

export const REFERRAL_BONUS_BY_PACKAGE: Record<string, { buyerBonus: number; referrerBonus: number }> = {
  starter_15_quota_7d_vip: { buyerBonus: 3, referrerBonus: 5 },
  standard_80_quota_30d_vip: { buyerBonus: 12, referrerBonus: 18 },
  enterprise_400_quota_90d_vip: { buyerBonus: 25, referrerBonus: 35 },
};

interface ReferralRule {
  package_type: string;
  package_name: string;
  buyer_bonus_tokens: number;
  referrer_bonus_tokens: number;
  unlock_copy_cooldown: number;
  status: string;
}

interface ReferralRewardItem {
  paid_order_id: string;
  package_type: string;
  buyer_bonus_tokens: number;
  referrer_bonus_tokens: number;
  status: string;
  granted_at?: string | null;
  role: 'referrer' | 'buyer';
}

interface ReferralSummary {
  success: boolean;
  invite_code: string | null;
  binding?: {
    invited_by: string | null;
    first_pay_reward_eligible: boolean;
    first_pay_reward_claimed: boolean;
  };
  stats?: {
    registered_count: number;
    first_paid_count: number;
    total_referrer_tokens: number;
    total_buyer_tokens: number;
  };
  rules?: ReferralRule[];
  recent_rewards?: ReferralRewardItem[];
}

interface CreditModalProps {
  open: boolean;
  onClose: () => void;
  credits: number | null;
  vipExpireDate?: string | null;
  userId: string;
  inviteCode: string;
  activeTab?: CreditTab;
  onTabChange?: (tab: CreditTab) => void;
  onToast?: (message: string) => void;
  onPurchase?: (pkg: RechargePackage) => void;
}

const CreditModal: React.FC<CreditModalProps> = ({
  open,
  onClose,
  credits,
  vipExpireDate,
  userId,
  inviteCode,
  activeTab,
  onTabChange,
  onToast,
  onPurchase,
}) => {
  const [internalTab, setInternalTab] = useState<CreditTab>('invite');
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const currentTab = activeTab ?? internalTab;

  const inviteLink = useMemo(() => {
    const code = (summary?.invite_code || inviteCode || '').trim();
    if (!code) return '';
    if (typeof window === 'undefined') return `/?invite=${code}`;
    return `${window.location.origin}/?invite=${code}`;
  }, [summary?.invite_code, inviteCode]);

  const canNativeShare = useMemo(() => {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }, []);

  const vipStatusText = useMemo(() => {
    if (!vipExpireDate) return '免费试用中';
    const ts = Date.parse(vipExpireDate);
    if (!Number.isFinite(ts) || ts <= Date.now()) return '免费试用中';
    return `${vipExpireDate.slice(0, 10)} 到期`;
  }, [vipExpireDate]);

  useEffect(() => {
    if (!open || currentTab !== 'invite' || !userId) return;
    let cancelled = false;

    const loadSummary = async () => {
      setIsSummaryLoading(true);
      setSummaryError(null);
      try {
        const res = await fetch(`/api/referral/me?userId=${encodeURIComponent(userId)}`);
        const data = (await res.json().catch(() => null)) as ReferralSummary | null;
        if (!res.ok || !data?.success) {
          throw new Error((data as any)?.message || '邀请中心加载失败');
        }
        if (!cancelled) setSummary(data);
      } catch (error: any) {
        if (!cancelled) {
          setSummaryError(error?.message || '邀请中心加载失败');
        }
      } finally {
        if (!cancelled) setIsSummaryLoading(false);
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [open, currentTab, userId]);

  if (!open) return null;

  const showToast = (message: string) => {
    if (onToast) onToast(message);
  };

  const switchTab = (tab: CreditTab) => {
    if (onTabChange) onTabChange(tab);
    setInternalTab(tab);
  };

  const handleCopy = async () => {
    if (!inviteLink) {
      showToast('邀请码尚未生成，请稍后重试');
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast('邀请链接已复制');
    } catch (error) {
      console.error('[CreditModal] copy failed:', error);
      showToast('复制失败，请手动复制链接');
    }
  };

  const handleShare = async () => {
    if (!inviteLink) {
      showToast('邀请码尚未生成，请稍后重试');
      return;
    }
    if (!canNativeShare) {
      await handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: '电商宝 Pro 邀请链接',
        text: '我在用电商宝 Pro 做商品主图，注册后首充可获得额外 Token。',
        url: inviteLink,
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      console.error('[CreditModal] share failed:', error);
      showToast('系统分享失败，请改用复制链接');
    }
  };

  const handlePurchase = (pkg: RechargePackage) => {
    if (onPurchase) {
      onPurchase(pkg);
      return;
    }
    showToast(`正在呼出支付宝... · ${pkg.label}`);
  };

  const stats = summary?.stats || {
    registered_count: 0,
    first_paid_count: 0,
    total_referrer_tokens: 0,
    total_buyer_tokens: 0,
  };
  const rules = summary?.rules || [];
  const recentRewards = summary?.recent_rewards || [];

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl border border-stone-200 overflow-hidden">
        <div className="px-6 md:px-8 py-5 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GloveIcon size={24} />
            <div>
              <p className="text-[16px] font-black text-stone-900">算力资产中心</p>
              <p className="text-[12px] text-stone-500">生图剩余：{credits ?? '--'} 张 · VIP：{vipStatusText}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 transition-colors flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 md:px-8 pt-5">
          <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-xl max-w-xs">
            <button
              onClick={() => switchTab('invite')}
              className={`h-10 rounded-lg text-[12px] font-black transition-all ${currentTab === 'invite' ? 'bg-white text-[#111827] shadow-sm' : 'text-stone-500'}`}
            >
              邀请中心
            </button>
            <button
              onClick={() => switchTab('recharge')}
              className={`h-10 rounded-lg text-[12px] font-black transition-all ${currentTab === 'recharge' ? 'bg-white text-[#111827] shadow-sm' : 'text-stone-500'}`}
            >
              补充算力
            </button>
          </div>
        </div>

        <div className="px-6 md:px-8 py-6">
          {currentTab === 'invite' ? (
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-stone-200 bg-[#fafafa] p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <h3 className="text-[24px] md:text-[30px] font-black tracking-tight text-[#1d1d1f]">分享视觉引擎，解锁更多算力</h3>
                    <p className="text-[14px] text-gray-500 mt-2">好友完成首充后，你们双方都会自动获得平台 Token 奖励。</p>
                  </div>
                  {summary?.binding?.first_pay_reward_eligible ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 text-violet-700 px-4 py-2 text-[12px] font-semibold">
                      <Sparkles size={14} />
                      当前账号处于受邀首充加赠状态
                    </div>
                  ) : null}
                </div>
              </div>

              {isSummaryLoading ? (
                <div className="rounded-[2rem] border border-stone-200 bg-stone-50 p-10 flex items-center justify-center text-stone-500 gap-3">
                  <Loader2 size={18} className="animate-spin" />
                  邀请中心加载中...
                </div>
              ) : summaryError ? (
                <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 text-[13px] text-red-500 font-semibold">{summaryError}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
                      <p className="text-[12px] uppercase tracking-[0.16em] text-stone-400 font-mono">邀请码</p>
                      <p className="text-[22px] font-black text-[#1d1d1f] mt-3">{summary?.invite_code || inviteCode || '--'}</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
                      <p className="text-[12px] uppercase tracking-[0.16em] text-stone-400 font-mono">已邀请注册</p>
                      <p className="text-[22px] font-black text-[#1d1d1f] mt-3">{stats.registered_count}</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
                      <p className="text-[12px] uppercase tracking-[0.16em] text-stone-400 font-mono">已首充激活</p>
                      <p className="text-[22px] font-black text-[#1d1d1f] mt-3">{stats.first_paid_count}</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
                      <p className="text-[12px] uppercase tracking-[0.16em] text-stone-400 font-mono">累计返还 Token</p>
                      <p className="text-[22px] font-black text-[#1d1d1f] mt-3">{stats.total_referrer_tokens}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
                    <div className="rounded-[2rem] border border-stone-200 bg-white p-6 space-y-4">
                      <div>
                        <p className="text-[12px] text-stone-400 font-mono uppercase tracking-[0.18em]">邀请链接</p>
                        <p className="text-[13px] text-stone-700 break-all mt-3 leading-6">{inviteLink || '邀请码生成中...'}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={handleCopy}
                          className="w-full h-11 rounded-xl bg-[#111827] text-white text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#1a2333] transition-colors"
                        >
                          <Copy size={14} />
                          复制邀请链接
                        </button>
                        {canNativeShare ? (
                          <button
                            onClick={handleShare}
                            className="w-full h-11 rounded-xl border border-stone-200 bg-stone-50 text-[13px] font-bold text-stone-700 flex items-center justify-center gap-2 hover:bg-stone-100 transition-colors"
                          >
                            <Share2 size={14} />
                            分享给好友
                          </button>
                        ) : null}
                      </div>
                      <p className="text-[12px] text-stone-500">好友注册后可获得启动算力，完成首充后双方自动到账奖励。</p>
                    </div>

                    <div className="rounded-[2rem] border border-stone-200 bg-[#fafafa] p-6 space-y-4">
                      <p className="text-[12px] text-stone-400 font-mono uppercase tracking-[0.18em]">奖励规则</p>
                      <div className="space-y-3">
                        {rules.map((rule) => (
                          <div key={rule.package_type} className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[13px] font-bold text-[#1d1d1f]">{rule.package_name}</span>
                              <span className="text-[11px] font-mono text-stone-400 uppercase">首充触发</span>
                            </div>
                            <p className="text-[12px] text-stone-500 mt-2">新用户 +{rule.buyer_bonus_tokens} Token / 邀请人 +{rule.referrer_bonus_tokens} Token</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-stone-200 bg-white p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <p className="text-[14px] font-black text-[#1d1d1f]">最近奖励</p>
                      <span className="text-[12px] text-stone-400">本人加赠 {stats.total_buyer_tokens} Token</span>
                    </div>
                    {recentRewards.length === 0 ? (
                      <div className="rounded-[1.5rem] bg-stone-50 px-4 py-6 text-[13px] text-stone-500">还没有奖励流水。邀请好友完成首充后，记录会出现在这里。</div>
                    ) : (
                      <div className="space-y-3">
                        {recentRewards.map((item) => (
                          <div key={`${item.paid_order_id}-${item.role}`} className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-stone-200 px-4 py-3">
                            <div>
                              <p className="text-[13px] font-semibold text-[#1d1d1f]">{item.role === 'referrer' ? '好友首充奖励到账' : '受邀首充加赠到账'}</p>
                              <p className="text-[12px] text-stone-400 mt-1">{item.package_type} · {item.granted_at ? String(item.granted_at).replace('T', ' ').slice(0, 16) : '等待发放'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[14px] font-black text-[#111827]">+{item.role === 'referrer' ? item.referrer_bonus_tokens : item.buyer_bonus_tokens} Token</p>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">{item.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-[1.5rem] border border-violet-100 bg-violet-50 px-4 py-3 text-[13px] text-violet-700 font-medium">
                受邀新用户完成首充后，可额外获得平台 Token，加赠权益将在支付成功后自动到账。
              </div>
              {RECHARGE_PACKAGES.map((pkg) => {
                const bonus = REFERRAL_BONUS_BY_PACKAGE[pkg.packageType];
                return (
                  <button
                    key={pkg.packageType}
                    onClick={() => handlePurchase(pkg)}
                    className={`w-full text-left p-4 rounded-2xl border bg-white hover:border-[#111827] hover:shadow-sm transition-all ${
                      pkg.recommended ? 'border-[#111827] ring-2 ring-[#111827]/5' : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-black text-stone-900">{pkg.label}</p>
                        <p className="text-[12px] text-stone-500 mt-1">￥{pkg.amount} · {pkg.imageQuota} 张极速出图 + {pkg.vipDays} 天文案引擎</p>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-stone-100 text-stone-500 font-bold tracking-wide">{pkg.recommended ? '推荐' : '可选'}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-stone-500">
                      <span>受邀首充加赠：+{bonus?.buyerBonus ?? 0} Token</span>
                      <span>邀请人返还：+{bonus?.referrerBonus ?? 0} Token</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditModal;
