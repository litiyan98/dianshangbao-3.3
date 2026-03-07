import React, { useMemo, useState } from 'react';
import { X, Copy } from 'lucide-react';
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

interface CreditModalProps {
  open: boolean;
  onClose: () => void;
  credits: number | null;
  vipExpireDate?: string | null;
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
  inviteCode,
  activeTab,
  onTabChange,
  onToast,
  onPurchase
}) => {
  const [internalTab, setInternalTab] = useState<CreditTab>('invite');
  const currentTab = activeTab ?? internalTab;

  const inviteLink = useMemo(() => {
    if (!inviteCode) return '';
    if (typeof window === 'undefined') return `/?invite=${inviteCode}`;
    return `${window.location.origin}/?invite=${inviteCode}`;
  }, [inviteCode]);

  const vipStatusText = useMemo(() => {
    if (!vipExpireDate) return '免费试用中';
    const ts = Date.parse(vipExpireDate);
    if (!Number.isFinite(ts) || ts <= Date.now()) return '免费试用中';
    return `${vipExpireDate.slice(0, 10)} 到期`;
  }, [vipExpireDate]);

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
      showToast('复制成功');
    } catch (error) {
      console.error('[CreditModal] copy failed:', error);
      showToast('复制失败，请手动复制链接');
    }
  };

  const handlePurchase = (pkg: RechargePackage) => {
    if (onPurchase) {
      onPurchase(pkg);
      return;
    }
    showToast(`正在呼出支付宝... (测试环境预留) · ${pkg.label}`);
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden">
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
          <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => switchTab('invite')}
              className={`h-10 rounded-lg text-[12px] font-black transition-all ${currentTab === 'invite' ? 'bg-white text-[#002FA7] shadow-sm' : 'text-stone-500'}`}
            >
              邀请赚算力
            </button>
            <button
              onClick={() => switchTab('recharge')}
              className={`h-10 rounded-lg text-[12px] font-black transition-all ${currentTab === 'recharge' ? 'bg-white text-[#002FA7] shadow-sm' : 'text-stone-500'}`}
            >
              补充金币
            </button>
          </div>
        </div>

        <div className="px-6 md:px-8 py-6">
          {currentTab === 'invite' ? (
            <div className="space-y-4">
              <h3 className="text-[18px] font-black text-stone-900">邀请 1 位电商同行，双方各得 10 金币！</h3>
              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50">
                <p className="text-[12px] text-stone-500 mb-2">专属邀请链接</p>
                <p className="text-[12px] font-mono break-all text-stone-800">{inviteLink || '邀请码生成中...'}</p>
              </div>
              <button
                onClick={handleCopy}
                className="w-full h-11 rounded-xl bg-[#002FA7] text-white text-[13px] font-black flex items-center justify-center gap-2 hover:bg-[#0B3AB8] transition-colors"
              >
                <Copy size={14} />
                一键复制
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {RECHARGE_PACKAGES.map((pkg) => (
                <button
                  key={pkg.packageType}
                  onClick={() => handlePurchase(pkg)}
                  className={`w-full text-left p-4 rounded-2xl border bg-white hover:border-[#002FA7] hover:shadow-sm transition-all ${
                    pkg.recommended ? 'border-[#002FA7] ring-2 ring-[#002FA7]/15' : 'border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-black text-stone-900">{pkg.label}</p>
                    {pkg.recommended ? (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black tracking-widest">
                        🔥 强烈推荐
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[12px] text-stone-500 mt-1">￥{pkg.amount} · {pkg.imageQuota}张极速出图 + {pkg.vipDays}天文案VIP</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditModal;
