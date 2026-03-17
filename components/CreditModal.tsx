import React, { useEffect, useMemo, useState } from 'react';
import { X, Copy, Loader2, Share2 } from 'lucide-react';
import GloveIcon from './GloveIcon';
import type { RefundAppealListResponse, RefundAppealSourceType, RefundAppealType } from '../types';
import { getRefundAppeals, submitRefundAppeal } from '../utils/geminiService';

export type CreditTab = 'invite' | 'recharge' | 'appeal';
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

interface ReferralSummary {
  success: boolean;
  invite_code: string | null;
  stats?: {
    registered_count: number;
    first_paid_count: number;
    total_referrer_tokens: number;
    total_buyer_tokens: number;
  };
  rules?: ReferralRule[];
}

const APPEAL_OPTIONS: Array<{
  value: RefundAppealType;
  label: string;
  sourceType: RefundAppealSourceType;
  defaultTitle: string;
  helper: string;
}> = [
  {
    value: 'GENERATION_CHARGE',
    label: '生成失败疑似扣费',
    sourceType: 'generation_job',
    defaultTitle: '生成失败疑似扣费申诉',
    helper: '适用于单图、矩阵或详情页生成后未正常出图，但怀疑被扣了 Token。',
  },
  {
    value: 'DUPLICATE_CHARGE',
    label: '重复扣费',
    sourceType: 'generation_job',
    defaultTitle: '重复扣费申诉',
    helper: '适用于同一张图或同一批任务看起来被重复扣费的情况。',
  },
  {
    value: 'PAYMENT_MISSING_TOKENS',
    label: '充值成功未到账',
    sourceType: 'payment_order',
    defaultTitle: '充值成功未到账申诉',
    helper: '适用于支付成功但算力没有到账的情况，可填写订单号辅助核查。',
  },
  {
    value: 'PAYMENT_REFUND',
    label: '申请充值退款',
    sourceType: 'payment_order',
    defaultTitle: '充值订单退款申请',
    helper: '适用于充值订单退款诉求，管理员会人工审核处理。',
  },
];

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
  const [appealSummary, setAppealSummary] = useState<RefundAppealListResponse | null>(null);
  const [isAppealLoading, setIsAppealLoading] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  const [isAppealSubmitting, setIsAppealSubmitting] = useState(false);
  const [appealType, setAppealType] = useState<RefundAppealType>('GENERATION_CHARGE');
  const [appealSourceType, setAppealSourceType] = useState<RefundAppealSourceType>('generation_job');
  const [appealSourceId, setAppealSourceId] = useState('');
  const [appealTitle, setAppealTitle] = useState('生成失败疑似扣费申诉');
  const [appealDescription, setAppealDescription] = useState('');
  const [appealRequestedTokens, setAppealRequestedTokens] = useState('1');
  const [appealRequestedAmount, setAppealRequestedAmount] = useState('');
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
        if (!cancelled) setSummaryError(error?.message || '邀请中心加载失败');
      } finally {
        if (!cancelled) setIsSummaryLoading(false);
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [open, currentTab, userId]);

  useEffect(() => {
    if (!open || currentTab !== 'appeal' || !userId) return;
    let cancelled = false;

    const loadAppeals = async () => {
      setIsAppealLoading(true);
      setAppealError(null);
      try {
        const data = await getRefundAppeals(userId);
        if (!cancelled) {
          setAppealSummary(data);
          if (!appealSourceId) {
            const firstJobId = data.recent_generation_jobs?.[0]?.id || '';
            if (firstJobId) setAppealSourceId(firstJobId);
          }
        }
      } catch (error: any) {
        if (!cancelled) setAppealError(error?.message || '申诉记录加载失败');
      } finally {
        if (!cancelled) setIsAppealLoading(false);
      }
    };

    void loadAppeals();
    return () => {
      cancelled = true;
    };
  }, [open, currentTab, userId]);

  useEffect(() => {
    const option = APPEAL_OPTIONS.find((item) => item.value === appealType);
    if (!option) return;
    setAppealSourceType(option.sourceType);
    setAppealTitle((prev) => (prev.trim() ? prev : option.defaultTitle));
    if (option.sourceType !== 'generation_job') {
      setAppealRequestedTokens('0');
    } else if (!appealRequestedTokens) {
      setAppealRequestedTokens('1');
    }
  }, [appealType]);

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
  const appealOption = APPEAL_OPTIONS.find((item) => item.value === appealType) || APPEAL_OPTIONS[0];
  const recentJobs = appealSummary?.recent_generation_jobs || [];

  const handleSubmitAppeal = async () => {
    if (!userId) {
      showToast('请先登录后再提交申诉');
      return;
    }
    if (!appealTitle.trim()) {
      showToast('请填写申诉标题');
      return;
    }
    if (appealSourceType === 'generation_job' && !appealSourceId.trim()) {
      showToast('请先选择一条需要核查的生成任务');
      return;
    }

    setIsAppealSubmitting(true);
    try {
      const result = await submitRefundAppeal({
        userId,
        appealType,
        sourceType: appealSourceType,
        sourceId: appealSourceId.trim() || null,
        title: appealTitle.trim(),
        description: appealDescription.trim(),
        requestedRefundTokens: Math.max(0, Number(appealRequestedTokens || 0)),
        requestedRefundAmount: Math.max(0, Number(appealRequestedAmount || 0)),
      });
      showToast(result?.message || '申诉已提交');
      setAppealDescription('');
      setAppealRequestedAmount('');
      if (appealSourceType !== 'generation_job') {
        setAppealSourceId('');
      }
      const refreshed = await getRefundAppeals(userId);
      setAppealSummary(refreshed);
    } catch (error: any) {
      showToast(error?.message || '申诉提交失败');
    } finally {
      setIsAppealSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${currentTab === 'invite' ? 'max-w-2xl' : 'max-w-5xl'} bg-white rounded-[2rem] shadow-2xl border border-stone-200 overflow-hidden`}>
        <button onClick={onClose} className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full border border-stone-200 bg-white/95 shadow-sm hover:bg-stone-50 hover:border-stone-300 transition-colors flex items-center justify-center">
          <X size={16} />
        </button>

        <div className="px-6 md:px-8 py-5 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3 pr-12">
            <GloveIcon size={24} />
            <div>
              <p className="text-[16px] font-black text-stone-900">算力资产中心</p>
              <p className="text-[12px] text-stone-500">生图剩余：{credits ?? '--'} 张 · VIP：{vipStatusText}</p>
            </div>
          </div>
        </div>

        <div className="px-6 md:px-8 pt-5">
          <div className="grid grid-cols-3 gap-2 bg-stone-100 p-1 rounded-xl max-w-md">
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
            <button
              onClick={() => switchTab('appeal')}
              className={`h-10 rounded-lg text-[12px] font-black transition-all ${currentTab === 'appeal' ? 'bg-white text-[#111827] shadow-sm' : 'text-stone-500'}`}
            >
              退款与申诉
            </button>
          </div>
        </div>

        <div className="px-6 md:px-8 py-5">
          {currentTab === 'invite' ? (
            <div className="space-y-4">
              {isSummaryLoading ? (
                <div className="rounded-[2rem] border border-stone-200 bg-stone-50 p-10 flex items-center justify-center text-stone-500 gap-3">
                  <Loader2 size={18} className="animate-spin" />
                  邀请中心加载中...
                </div>
              ) : summaryError ? (
                <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 text-[13px] text-red-500 font-semibold">{summaryError}</div>
              ) : (
                <>
                  <div className="rounded-[2rem] border border-stone-200 bg-[#fafafa] px-5 py-5 md:px-6 md:py-6">
                    <div className="flex items-center gap-4 md:gap-5">
                      <div className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-[1.75rem] bg-white shadow-sm border border-stone-200 flex items-center justify-center">
                        <GloveIcon size={58} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[22px] md:text-[26px] font-black tracking-tight text-[#1d1d1f] leading-tight">邀请好友，双方得 Token</h3>
                        <p className="text-[13px] text-gray-500 mt-2 leading-6">好友首充后自动到账。复制链接或系统分享即可。</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-4">
                    <div className="rounded-[2rem] border border-stone-200 bg-white p-5 space-y-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">邀请码</p>
                        <p className="text-[22px] font-black text-[#1d1d1f] mt-2">{summary?.invite_code || inviteCode || '--'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">邀请链接</p>
                        <p className="text-[13px] text-stone-700 break-all mt-2 leading-6">{inviteLink || '邀请码生成中...'}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <button
                          onClick={handleCopy}
                          className="w-full h-11 rounded-xl bg-[#111827] text-white text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#1a2333] transition-colors"
                        >
                          <Copy size={14} />
                          复制链接
                        </button>
                        {canNativeShare ? (
                          <button
                            onClick={handleShare}
                            className="w-full h-11 rounded-xl border border-stone-200 bg-stone-50 text-[13px] font-bold text-stone-700 flex items-center justify-center gap-2 hover:bg-stone-100 transition-colors"
                          >
                            <Share2 size={14} />
                            直接分享
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-stone-200 bg-[#fafafa] p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">已邀请</p>
                          <p className="text-[22px] font-black text-[#1d1d1f] mt-2">{stats.registered_count}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">返还</p>
                          <p className="text-[22px] font-black text-[#1d1d1f] mt-2">{stats.total_referrer_tokens}</p>
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">奖励</p>
                        <div className="space-y-1.5 mt-2">
                          {rules.slice(0, 3).map((rule) => (
                            <p key={rule.package_type} className="text-[12px] text-stone-600 leading-5">
                              <span className="font-semibold text-[#1d1d1f]">{rule.package_name}</span>
                              <span className="text-stone-400"> · </span>
                              新用户 +{rule.buyer_bonus_tokens} / 邀请人 +{rule.referrer_bonus_tokens}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : currentTab === 'recharge' ? (
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
          ) : (
            <div className="space-y-4">
              <div className="rounded-[1.5rem] border border-stone-200 bg-[#fafafa] px-4 py-4">
                <p className="text-[18px] font-black text-stone-900">退款与申诉中心</p>
                <p className="mt-2 text-[13px] leading-6 text-stone-500">
                  生成失败疑似扣费、重复扣费、充值成功未到账，都可以在这里提交。系统会先自动核查，再进入人工处理。
                </p>
              </div>

              {isAppealLoading ? (
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-8 flex items-center justify-center gap-3 text-stone-500">
                  <Loader2 size={18} className="animate-spin" />
                  正在读取申诉记录...
                </div>
              ) : appealError ? (
                <div className="rounded-[1.5rem] border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-500">
                  {appealError}
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[1.5rem] border border-stone-200 bg-white p-4 space-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">申诉类型</p>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {APPEAL_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setAppealType(option.value);
                              setAppealSourceType(option.sourceType);
                              setAppealTitle(option.defaultTitle);
                            }}
                            className={`rounded-[1.25rem] border px-4 py-4 text-left transition-all ${
                              appealType === option.value ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-stone-50 text-stone-800'
                            }`}
                          >
                            <p className="text-[14px] font-black">{option.label}</p>
                            <p className={`mt-2 text-[12px] leading-5 ${appealType === option.value ? 'text-white/75' : 'text-stone-500'}`}>
                              {option.helper}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">关联任务 / 订单</span>
                        {appealSourceType === 'generation_job' && recentJobs.length ? (
                          <select
                            value={appealSourceId}
                            onChange={(event) => setAppealSourceId(event.target.value)}
                            className="w-full h-12 rounded-xl border border-stone-200 bg-stone-50 px-4 text-[13px] font-semibold text-stone-800 outline-none focus:border-stone-400"
                          >
                            {recentJobs.map((job) => (
                              <option key={job.id} value={job.id}>
                                {job.id} · {job.mode} · {job.status} · 已扣 {job.charged_tokens}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={appealSourceId}
                            onChange={(event) => setAppealSourceId(event.target.value)}
                            placeholder={appealSourceType === 'generation_job' ? '填写 jobId' : '填写订单号或扣费记录号'}
                            className="w-full h-12 rounded-xl border border-stone-200 bg-stone-50 px-4 text-[13px] font-semibold text-stone-800 outline-none focus:border-stone-400"
                          />
                        )}
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">申诉标题</span>
                        <input
                          value={appealTitle}
                          onChange={(event) => setAppealTitle(event.target.value)}
                          className="w-full h-12 rounded-xl border border-stone-200 bg-stone-50 px-4 text-[13px] font-semibold text-stone-800 outline-none focus:border-stone-400"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">
                          {appealSourceType === 'generation_job' ? '申请退回 Token' : '申请退款金额'}
                        </span>
                        <input
                          value={appealSourceType === 'generation_job' ? appealRequestedTokens : appealRequestedAmount}
                          onChange={(event) => {
                            const cleanValue = event.target.value.replace(/[^\d.]/g, '');
                            if (appealSourceType === 'generation_job') {
                              setAppealRequestedTokens(cleanValue.replace(/\..*/, ''));
                            } else {
                              setAppealRequestedAmount(cleanValue);
                            }
                          }}
                          placeholder={appealSourceType === 'generation_job' ? '例如 1 / 3' : '例如 99'}
                          className="w-full h-12 rounded-xl border border-stone-200 bg-stone-50 px-4 text-[13px] font-semibold text-stone-800 outline-none focus:border-stone-400"
                        />
                      </label>

                      <label className="block md:col-span-2">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">补充说明</span>
                        <textarea
                          value={appealDescription}
                          onChange={(event) => setAppealDescription(event.target.value)}
                          placeholder={
                            appealOption?.value === 'GENERATION_CHARGE'
                              ? '例如：矩阵第 3 张生成失败，但看起来被扣费了。'
                              : '补充你看到的异常情况，系统会先自动核查。'
                          }
                          className="min-h-[120px] w-full rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] leading-6 text-stone-800 outline-none focus:border-stone-400"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleSubmitAppeal();
                      }}
                      disabled={isAppealSubmitting}
                      className="w-full h-12 rounded-xl bg-[#111827] text-white text-[13px] font-bold transition-colors hover:bg-[#1a2333] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isAppealSubmitting ? '正在提交申诉...' : '提交申诉'}
                    </button>
                  </div>

                  <div className="rounded-[1.5rem] border border-stone-200 bg-[#fafafa] p-4 space-y-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400 font-mono">最近记录</p>
                      <p className="mt-2 text-[13px] text-stone-500">系统会先自动核查扣费和到账情况，再进入人工审核。</p>
                    </div>

                    <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                      {(appealSummary?.items || []).map((item) => (
                        <div key={item.id} className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[14px] font-black text-stone-900 truncate">{item.title}</p>
                              <p className="mt-1 text-[12px] text-stone-500">{item.created_at || '--'}</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                              item.status === 'REFUNDED'
                                ? 'bg-emerald-50 text-emerald-600'
                                : item.status === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-600'
                                  : item.status === 'UNDER_REVIEW'
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-stone-100 text-stone-600'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          {item.auto_check_result ? (
                            <p className="mt-2 text-[12px] text-stone-500 leading-5">系统核查：{item.auto_check_result}</p>
                          ) : null}
                          {item.resolution_summary ? (
                            <p className="mt-2 text-[12px] text-stone-700 leading-5">{item.resolution_summary}</p>
                          ) : null}
                        </div>
                      ))}

                      {!appealSummary?.items?.length ? (
                        <div className="rounded-[1.25rem] border border-dashed border-stone-200 bg-white px-4 py-10 text-center text-[13px] text-stone-500">
                          暂无申诉记录
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditModal;
