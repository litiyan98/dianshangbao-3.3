import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, Share2, X } from 'lucide-react';
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

interface InviteLinkItem {
  id: string;
  invite_code: string;
  label: string;
  channel: string;
  is_default: boolean;
  status: string;
  created_at: string | null;
  registered_count: number;
  first_paid_count: number;
  total_referrer_tokens: number;
}

interface LegacyInviteSource {
  bind_source: string;
  registered_count: number;
  first_paid_count: number;
  total_referrer_tokens: number;
}

interface InviteLinksResponse {
  success: boolean;
  invite_code: string | null;
  links?: InviteLinkItem[];
  legacy_sources?: LegacyInviteSource[];
  message?: string;
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

const LINK_CHANNEL_PRESETS = ['xiaohongshu', 'wechat-group', 'douyin-live', 'private-chat'];

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
  const [inviteLinks, setInviteLinks] = useState<InviteLinkItem[]>([]);
  const [legacySources, setLegacySources] = useState<LegacyInviteSource[]>([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkChannel, setNewLinkChannel] = useState('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const currentTab = activeTab ?? internalTab;

  const resolvedInviteCode = useMemo(() => {
    return (summary?.invite_code || inviteCode || '').trim();
  }, [summary?.invite_code, inviteCode]);

  const defaultInviteLink = useMemo(() => {
    return inviteLinks.find((item) => item.is_default) || inviteLinks[0] || null;
  }, [inviteLinks]);

  const baseInviteLink = useMemo(() => {
    if (!resolvedInviteCode) return '';
    if (typeof window === 'undefined') return `/?invite=${resolvedInviteCode}`;
    return `${window.location.origin}/?invite=${resolvedInviteCode}`;
  }, [resolvedInviteCode]);

  const canNativeShare = useMemo(() => {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }, []);

  const vipStatusText = useMemo(() => {
    if (!vipExpireDate) return '免费试用中';
    const ts = Date.parse(vipExpireDate);
    if (!Number.isFinite(ts) || ts <= Date.now()) return '免费试用中';
    return `${vipExpireDate.slice(0, 10)} 到期`;
  }, [vipExpireDate]);

  const stats = summary?.stats || {
    registered_count: 0,
    first_paid_count: 0,
    total_referrer_tokens: 0,
    total_buyer_tokens: 0,
  };
  const rules = summary?.rules || [];

  const buildInviteLinkUrl = (link?: Partial<InviteLinkItem> | null) => {
    if (!resolvedInviteCode) return '';
    const params = new URLSearchParams({ invite: resolvedInviteCode });
    if (link?.id) params.set('linkId', link.id);
    if (link?.channel && link.channel !== 'landing') params.set('channel', link.channel);
    if (typeof window === 'undefined') return `/?${params.toString()}`;
    return `${window.location.origin}/?${params.toString()}`;
  };

  const defaultInviteLinkUrl = defaultInviteLink ? buildInviteLinkUrl(defaultInviteLink) : baseInviteLink;

  useEffect(() => {
    if (!open || currentTab !== 'invite' || !userId) return;
    let cancelled = false;

    const loadInviteCenter = async () => {
      setIsSummaryLoading(true);
      setSummaryError(null);
      try {
        const [summaryRes, linksRes] = await Promise.all([
          fetch(`/api/referral/me?userId=${encodeURIComponent(userId)}`),
          fetch(`/api/referral/links?userId=${encodeURIComponent(userId)}`),
        ]);

        const summaryData = (await summaryRes.json().catch(() => null)) as ReferralSummary | null;
        const linksData = (await linksRes.json().catch(() => null)) as InviteLinksResponse | null;

        if (!summaryRes.ok || !summaryData?.success) {
          throw new Error((summaryData as any)?.message || '邀请中心加载失败');
        }
        if (!linksRes.ok || !linksData?.success) {
          throw new Error(linksData?.message || '邀请链接加载失败');
        }

        if (!cancelled) {
          setSummary(summaryData);
          setInviteLinks(Array.isArray(linksData.links) ? linksData.links : []);
          setLegacySources(Array.isArray(linksData.legacy_sources) ? linksData.legacy_sources : []);
        }
      } catch (error: any) {
        if (!cancelled) {
          setSummaryError(error?.message || '邀请中心加载失败');
        }
      } finally {
        if (!cancelled) {
          setIsSummaryLoading(false);
        }
      }
    };

    void loadInviteCenter();
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

  const handleCopyDefaultLink = async () => {
    const targetLink = defaultInviteLinkUrl || baseInviteLink;
    if (!targetLink) {
      showToast('邀请码尚未生成，请稍后重试');
      return;
    }

    try {
      await navigator.clipboard.writeText(targetLink);
      showToast(defaultInviteLink?.label ? `已复制${defaultInviteLink.label}` : '邀请链接已复制');
    } catch (error) {
      console.error('[CreditModal] copy default link failed:', error);
      showToast('复制失败，请手动复制链接');
    }
  };

  const handleShareDefaultLink = async () => {
    const targetLink = defaultInviteLinkUrl || baseInviteLink;
    if (!targetLink) {
      showToast('邀请码尚未生成，请稍后重试');
      return;
    }
    if (!canNativeShare) {
      await handleCopyDefaultLink();
      return;
    }

    try {
      await navigator.share({
        title: '电商宝 Pro 邀请链接',
        text: '我在用电商宝 Pro 做商品主图，注册后首充可获得额外 Token。',
        url: targetLink,
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      console.error('[CreditModal] share default link failed:', error);
      showToast('系统分享失败，请改用复制链接');
    }
  };

  const handleCopySpecificLink = async (link: InviteLinkItem) => {
    const targetLink = buildInviteLinkUrl(link);
    if (!targetLink) {
      showToast('邀请码尚未生成，请稍后重试');
      return;
    }

    try {
      await navigator.clipboard.writeText(targetLink);
      showToast(`已复制${link.label}`);
    } catch (error) {
      console.error('[CreditModal] copy specific link failed:', error);
      showToast('复制失败，请手动复制链接');
    }
  };

  const handleCreateLink = async () => {
    if (isCreatingLink) return;
    if (!newLinkLabel.trim()) {
      showToast('请先填写链接名称');
      return;
    }

    try {
      setIsCreatingLink(true);
      const response = await fetch('/api/referral/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          label: newLinkLabel.trim(),
          channel: newLinkChannel.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as InviteLinksResponse | null;
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || '创建邀请链接失败');
      }
      setInviteLinks(Array.isArray(data.links) ? data.links : []);
      setLegacySources(Array.isArray(data.legacy_sources) ? data.legacy_sources : []);
      setNewLinkLabel('');
      setNewLinkChannel('');
      showToast('邀请链接已创建');
    } catch (error: any) {
      console.error('[CreditModal] create link failed:', error);
      showToast(error?.message || '创建邀请链接失败');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handlePurchase = (pkg: RechargePackage) => {
    if (onPurchase) {
      onPurchase(pkg);
      return;
    }
    showToast(`正在呼出支付宝... · ${pkg.label}`);
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white/95 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50"
        >
          <X size={16} />
        </button>

        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-5 md:px-8">
          <div className="flex items-center gap-3 pr-12">
            <GloveIcon size={24} />
            <div>
              <p className="text-[16px] font-black text-stone-900">算力资产中心</p>
              <p className="text-[12px] text-stone-500">生图剩余：{credits ?? '--'} 张 · VIP：{vipStatusText}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pt-5 md:px-8">
          <div className="grid max-w-xs grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
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

        <div className="px-6 py-5 md:px-8">
          {currentTab === 'invite' ? (
            <div className="space-y-4">
              {isSummaryLoading ? (
                <div className="flex items-center justify-center gap-3 rounded-[2rem] border border-stone-200 bg-stone-50 p-10 text-stone-500">
                  <Loader2 size={18} className="animate-spin" />
                  邀请中心加载中...
                </div>
              ) : summaryError ? (
                <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 text-[13px] font-semibold text-red-500">{summaryError}</div>
              ) : (
                <>
                  <div className="rounded-[2rem] border border-stone-200 bg-[#fafafa] px-5 py-5 md:px-6 md:py-6">
                    <div className="flex items-center gap-4 md:gap-5">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.75rem] border border-stone-200 bg-white shadow-sm md:h-24 md:w-24">
                        <GloveIcon size={58} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[22px] font-black leading-tight tracking-tight text-[#1d1d1f] md:text-[26px]">邀请好友，双方得 Token</h3>
                        <p className="mt-2 text-[13px] leading-6 text-gray-500">现在每条邀请链接都有独立 linkId，可分别统计注册数、首充数和返还数据。</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-4 rounded-[2rem] border border-stone-200 bg-white p-5">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">邀请码</p>
                        <p className="mt-2 text-[22px] font-black text-[#1d1d1f]">{resolvedInviteCode || '--'}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">默认链接</p>
                        <p className="mt-2 break-all text-[13px] leading-6 text-stone-700">{defaultInviteLinkUrl || baseInviteLink || '邀请码生成中...'}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          onClick={() => void handleCopyDefaultLink()}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#111827] text-[13px] font-bold text-white transition-colors hover:bg-[#1a2333]"
                        >
                          <Copy size={14} />
                          复制默认链接
                        </button>
                        {canNativeShare ? (
                          <button
                            onClick={() => void handleShareDefaultLink()}
                            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 text-[13px] font-bold text-stone-700 transition-colors hover:bg-stone-100"
                          >
                            <Share2 size={14} />
                            分享默认链接
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-4 rounded-[2rem] border border-stone-200 bg-[#fafafa] p-5">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">已邀请</p>
                          <p className="mt-2 text-[22px] font-black text-[#1d1d1f]">{stats.registered_count}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">已首充</p>
                          <p className="mt-2 text-[22px] font-black text-[#1d1d1f]">{stats.first_paid_count}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">返还</p>
                          <p className="mt-2 text-[22px] font-black text-[#1d1d1f]">{stats.total_referrer_tokens}</p>
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-3">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">奖励规则</p>
                        <div className="mt-2 space-y-1.5">
                          {rules.slice(0, 3).map((rule) => (
                            <p key={rule.package_type} className="text-[12px] leading-5 text-stone-600">
                              <span className="font-semibold text-[#1d1d1f]">{rule.package_name}</span>
                              <span className="text-stone-400"> · </span>
                              新用户 +{rule.buyer_bonus_tokens} / 邀请人 +{rule.referrer_bonus_tokens}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-stone-200 bg-white p-5 md:p-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">创建新链接</p>
                    <h4 className="mt-2 text-[20px] font-black tracking-tight text-[#1d1d1f]">为不同投放场景生成独立链接</h4>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_0.8fr_auto]">
                      <input
                        value={newLinkLabel}
                        onChange={(event) => setNewLinkLabel(event.target.value)}
                        className="h-11 rounded-xl border border-stone-200 bg-stone-50 px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                        placeholder="链接名称，例如：小红书主页挂链"
                      />
                      <input
                        value={newLinkChannel}
                        onChange={(event) => setNewLinkChannel(event.target.value)}
                        className="h-11 rounded-xl border border-stone-200 bg-stone-50 px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                        placeholder="渠道，例如：xiaohongshu"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateLink()}
                        disabled={isCreatingLink}
                        className="flex h-11 items-center justify-center rounded-xl bg-[#111827] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1a2333] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCreatingLink ? <Loader2 size={16} className="animate-spin" /> : '创建链接'}
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {LINK_CHANNEL_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setNewLinkChannel(preset)}
                          className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-[12px] font-bold text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-900"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[12px] leading-6 text-stone-500">创建后系统会生成独立 `linkId`。以后每条链接带来的注册数、首充数和返还都会分开显示。</p>
                  </div>

                  <div className="rounded-[2rem] border border-stone-200 bg-white p-5 md:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">邀请链接</p>
                        <h4 className="mt-2 text-[20px] font-black tracking-tight text-[#1d1d1f]">每条链接的独立数据</h4>
                      </div>
                      <div className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-500">
                        共 {inviteLinks.length} 条链接
                      </div>
                    </div>

                    {inviteLinks.length > 0 ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {inviteLinks.map((item) => (
                          <div key={item.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-[16px] font-black text-stone-900">{item.label}</p>
                                  {item.is_default ? (
                                    <span className="rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                                      Default
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-[11px] leading-5 text-stone-500">渠道：{item.channel} · ID：{item.id}</p>
                                <p className="mt-2 break-all text-[12px] leading-5 text-stone-600">{buildInviteLinkUrl(item)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleCopySpecificLink(item)}
                                className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[12px] font-bold text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-900"
                              >
                                复制链接
                              </button>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-3">
                              <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                                <p className="text-[11px] text-stone-400">注册</p>
                                <p className="mt-2 text-[20px] font-black text-stone-900">{item.registered_count}</p>
                              </div>
                              <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                                <p className="text-[11px] text-stone-400">首充</p>
                                <p className="mt-2 text-[20px] font-black text-stone-900">{item.first_paid_count}</p>
                              </div>
                              <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                                <p className="text-[11px] text-stone-400">返还</p>
                                <p className="mt-2 text-[20px] font-black text-stone-900">{item.total_referrer_tokens}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 px-5 py-6 text-[13px] leading-6 text-stone-500">
                        还没有邀请链接。先创建一条新链接，系统就会开始为它单独累计注册数和首充数。
                      </div>
                    )}
                  </div>

                  {legacySources.length > 0 ? (
                    <div className="rounded-[2rem] border border-stone-200 bg-white p-5 md:p-6">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">历史来源</p>
                      <h4 className="mt-2 text-[20px] font-black tracking-tight text-[#1d1d1f]">旧版链接遗留数据</h4>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {legacySources.map((item) => (
                          <div key={item.bind_source} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4">
                            <p className="text-[15px] font-black text-stone-900">{item.bind_source}</p>
                            <div className="mt-4 grid grid-cols-3 gap-3">
                              <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                                <p className="text-[11px] text-stone-400">注册</p>
                                <p className="mt-2 text-[20px] font-black text-stone-900">{item.registered_count}</p>
                              </div>
                              <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                                <p className="text-[11px] text-stone-400">首充</p>
                                <p className="mt-2 text-[20px] font-black text-stone-900">{item.first_paid_count}</p>
                              </div>
                              <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                                <p className="text-[11px] text-stone-400">返还</p>
                                <p className="mt-2 text-[20px] font-black text-stone-900">{item.total_referrer_tokens}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-[1.5rem] border border-violet-100 bg-violet-50 px-4 py-3 text-[13px] font-medium text-violet-700">
                受邀新用户完成首充后，可额外获得平台 Token，加赠权益将在支付成功后自动到账。
              </div>
              {RECHARGE_PACKAGES.map((pkg) => {
                const bonus = REFERRAL_BONUS_BY_PACKAGE[pkg.packageType];
                return (
                  <button
                    key={pkg.packageType}
                    onClick={() => handlePurchase(pkg)}
                    className={`w-full rounded-2xl border bg-white p-4 text-left transition-all hover:border-[#111827] hover:shadow-sm ${
                      pkg.recommended ? 'border-[#111827] ring-2 ring-[#111827]/5' : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-black text-stone-900">{pkg.label}</p>
                        <p className="mt-1 text-[12px] text-stone-500">￥{pkg.amount} · {pkg.imageQuota} 张极速出图 + {pkg.vipDays} 天文案引擎</p>
                      </div>
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold tracking-wide text-stone-500">{pkg.recommended ? '推荐' : '可选'}</span>
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
