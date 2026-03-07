import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, ScanLine, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { RECHARGE_PACKAGES, type RechargePackage } from './CreditModal';

interface PaymentModalProps {
  open: boolean;
  userId: string;
  selectedPackage: RechargePackage | null;
  onClose: () => void;
  onPaid?: () => Promise<void> | void;
  onToast?: (message: string) => void;
}

type PayStatus = 'idle' | 'pending' | 'success' | 'failed';
type PaymentStep = 'select' | 'pay';

type TonalPlanMeta = {
  title: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const POLLING_INTERVAL_MS = 3000;
const POLLING_TIMEOUT_MS = 5 * 60 * 1000;

const TONAL_PLAN_META: Record<string, TonalPlanMeta> = {
  starter_15_quota_7d_vip: {
    title: 'Starter / 探索版',
    features: ['6 张极速渲染阵列', '3 天基础文案引擎'],
    cta: '获取额度',
  },
  standard_80_quota_30d_vip: {
    title: 'Advanced / 专业版',
    features: ['70 张极速渲染阵列', '30 天无缝文案引擎'],
    cta: '升级算力',
  },
  enterprise_400_quota_90d_vip: {
    title: 'Ultra / 尊享版',
    features: ['150 张极速渲染阵列', '90 天无缝文案引擎'],
    cta: '获取额度',
  },
};

const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  userId,
  selectedPackage,
  onClose,
  onPaid,
  onToast
}) => {
  const [step, setStep] = useState<PaymentStep>('select');
  const [activeTab, setActiveTab] = useState<'standard' | 'pro'>('standard');
  const [activePackage, setActivePackage] = useState<RechargePackage | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [outTradeNo, setOutTradeNo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payStatus, setPayStatus] = useState<PayStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const pollingStartedAtRef = useRef<number>(0);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const resetPayState = useCallback(() => {
    setQrCode(null);
    setOutTradeNo(null);
    setLoading(false);
    setPayStatus('idle');
    setError(null);
    pollingStartedAtRef.current = 0;
  }, []);

  const resetAllState = useCallback(() => {
    clearPolling();
    resetPayState();
    setStep('select');
    setActiveTab('standard');
    setActivePackage(null);
  }, [clearPolling, resetPayState]);

  const handleClose = useCallback(() => {
    resetAllState();
    onClose();
  }, [onClose, resetAllState]);

  const launchConfetti = () => {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, zIndex: 320 });
    confetti({ particleCount: 80, spread: 100, angle: 120, origin: { x: 0, y: 0.62 }, zIndex: 320 });
    confetti({ particleCount: 80, spread: 100, angle: 60, origin: { x: 1, y: 0.62 }, zIndex: 320 });
  };

  const createOrder = useCallback(async (pkg: RechargePackage) => {
    if (!pkg || !userId) return;
    setLoading(true);
    setError(null);
    setPayStatus('pending');
    setQrCode(null);
    setOutTradeNo(null);
    pollingStartedAtRef.current = Date.now();

    try {
      const res = await fetch('/api/pay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: pkg.amount,
          packageType: pkg.packageType,
          subject: pkg.subject,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.qr_code || !data?.out_trade_no) {
        throw new Error(data?.message || data?.error || '创建订单失败，请稍后重试');
      }

      setQrCode(String(data.qr_code));
      setOutTradeNo(String(data.out_trade_no));
    } catch (err: any) {
      setPayStatus('failed');
      setError(err?.message || '创建订单失败');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleSelectPackage = (pkg: RechargePackage) => {
    setActivePackage(pkg);
    setStep('pay');
    void createOrder(pkg);
  };

  const handleBackToSelect = () => {
    clearPolling();
    resetPayState();
    setStep('select');
  };

  useEffect(() => {
    if (!open) {
      resetAllState();
      return;
    }

    const preferred = selectedPackage || RECHARGE_PACKAGES.find(pkg => pkg.recommended) || RECHARGE_PACKAGES[0] || null;
    setActivePackage(preferred);
    setStep('select');
    setActiveTab('standard');
    resetPayState();
  }, [open, selectedPackage, resetAllState, resetPayState]);

  useEffect(() => {
    if (!open || step !== 'pay' || !outTradeNo || payStatus !== 'pending') return;

    clearPolling();
    pollingRef.current = window.setInterval(async () => {
      const elapsed = Date.now() - pollingStartedAtRef.current;
      if (elapsed > POLLING_TIMEOUT_MS) {
        clearPolling();
        setPayStatus('failed');
        setError('二维码已失效，请返回重选套餐后重新支付');
        if (onToast) onToast('支付超时，二维码已失效');
        return;
      }

      try {
        const res = await fetch(`/api/pay/status?out_trade_no=${encodeURIComponent(outTradeNo)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;

        const normalized = String(data?.status || data?.trade_status || '').toUpperCase();
        if (normalized === 'PAID' || normalized === 'COMPLETED' || normalized === 'SUCCESS' || normalized === 'TRADE_SUCCESS') {
          clearPolling();
          setPayStatus('success');
          launchConfetti();
          if (onToast) onToast('支付成功，资产已到账！');
          await onPaid?.();
          window.setTimeout(() => {
            handleClose();
          }, 900);
        }
      } catch (err) {
        console.error('[PaymentModal] polling failed:', err);
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      clearPolling();
    };
  }, [open, step, outTradeNo, payStatus, clearPolling, onPaid, onToast, handleClose]);

  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  if (!open) return null;

  const activeMeta = activePackage ? TONAL_PLAN_META[activePackage.packageType] : null;
  const shellWidthClass = step === 'select' ? 'max-w-5xl' : 'max-w-3xl';
  const starterPackage = RECHARGE_PACKAGES.find(pkg => pkg.packageType === 'starter_15_quota_7d_vip') || null;
  const advancedPackage = RECHARGE_PACKAGES.find(pkg => pkg.packageType === 'standard_80_quota_30d_vip') || null;
  const ultraPackage = RECHARGE_PACKAGES.find(pkg => pkg.packageType === 'enterprise_400_quota_90d_vip') || null;

  const handleProPlanAction = (plan: 'monthly' | 'yearly') => {
    if (onToast) {
      onToast(plan === 'monthly' ? '工作室包月方案需人工开通，请联系客服升级' : '企业包年方案需人工开通，请联系客服升级');
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-white/30 backdrop-blur-xl" onClick={handleClose} />
      <div className={`relative w-full ${shellWidthClass} rounded-[2.5rem] bg-[#fafafa] border border-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-6 md:p-10 animate-[fadeInUp_0.4s_ease-out]`}>
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-6 right-6 md:top-8 md:right-8 text-gray-400 hover:text-gray-800 transition-colors"
        >
          <X size={24} />
        </button>

        {step === 'select' ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-[#1d1d1f] tracking-tight mb-3">解锁更强大的视觉大模型</h2>
              <p className="text-[15px] text-gray-500 font-medium">扩展算力边界，持续稳定输出工业级视觉资产</p>
            </div>

            <div className="flex justify-center mb-10 select-none">
              <div className="bg-gray-100/80 p-1.5 rounded-full flex items-center shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveTab('standard')}
                  className={`px-8 py-2.5 rounded-full text-[14px] font-bold transition-all duration-300 ${
                    activeTab === 'standard'
                      ? 'bg-white text-[#1d1d1f] shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  标准方案
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pro')}
                  className={`px-8 py-2.5 rounded-full text-[14px] font-bold transition-all duration-300 ${
                    activeTab === 'pro'
                      ? 'bg-[#111827] text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  专业版本
                </button>
              </div>
            </div>

            <div className="w-full max-w-5xl mx-auto transition-all duration-500">
              {activeTab === 'standard' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch animate-[fadeIn_0.4s_ease-out]">
                  <div className="group relative bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_12px_40px_rgba(59,130,246,0.12)] flex flex-col overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/0 group-hover:to-blue-50/50 transition-colors duration-500 pointer-events-none"></div>
                    <div className="mb-8 relative z-10">
                      <h3 className="text-lg font-bold text-gray-800 mb-2 font-mono uppercase tracking-wider group-hover:text-blue-500 transition-colors">Starter / 探索版</h3>
                      <div className="flex items-baseline gap-1"><span className="text-2xl font-semibold">¥</span><span className="text-4xl font-black text-[#1d1d1f]">9.9</span></div>
                    </div>
                    <ul className="space-y-4 text-[14px] text-gray-600 font-medium flex-1 relative z-10">
                      <li className="flex items-center gap-3">✦ 6 张极速渲染阵列</li>
                      <li className="flex items-center gap-3">✦ 3 天基础文案引擎</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => starterPackage && handleSelectPackage(starterPackage)}
                      disabled={!starterPackage}
                      className="relative z-10 mt-8 w-full py-3.5 bg-gray-50 text-gray-700 group-hover:bg-blue-500 group-hover:text-white rounded-xl font-bold text-[15px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      获取额度
                    </button>
                  </div>

                  <div className="group relative bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_12px_40px_rgba(139,92,246,0.15)] flex flex-col overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 to-violet-50/0 group-hover:to-violet-50/50 transition-colors duration-500 pointer-events-none"></div>
                    <div className="mb-8 relative z-10">
                      <h3 className="text-lg font-bold text-gray-800 mb-2 font-mono uppercase tracking-wider group-hover:text-violet-600 transition-colors">Advanced / 专业版</h3>
                      <div className="flex items-baseline gap-1"><span className="text-2xl font-semibold">¥</span><span className="text-4xl font-black text-[#1d1d1f]">99</span></div>
                    </div>
                    <ul className="space-y-4 text-[14px] text-gray-600 font-medium flex-1 relative z-10">
                      <li className="flex items-center gap-3">✦ 70 张极速渲染阵列</li>
                      <li className="flex items-center gap-3">✦ 30 天无缝文案引擎</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => advancedPackage && handleSelectPackage(advancedPackage)}
                      disabled={!advancedPackage}
                      className="relative z-10 mt-8 w-full py-3.5 bg-[#111827] text-white group-hover:shadow-lg group-hover:shadow-violet-500/25 rounded-xl font-bold text-[15px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      升级算力
                    </button>
                  </div>

                  <div className="group relative bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-gray-800 hover:shadow-[0_12px_40px_rgba(17,24,39,0.12)] flex flex-col overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-50/0 to-gray-50/0 group-hover:to-gray-100/50 transition-colors duration-500 pointer-events-none"></div>
                    <div className="mb-8 relative z-10">
                      <h3 className="text-lg font-bold text-gray-800 mb-2 font-mono uppercase tracking-wider group-hover:text-gray-900 transition-colors">Ultra / 尊享版</h3>
                      <div className="flex items-baseline gap-1"><span className="text-2xl font-semibold">¥</span><span className="text-4xl font-black text-[#1d1d1f]">199</span></div>
                    </div>
                    <ul className="space-y-4 text-[14px] text-gray-600 font-medium flex-1 relative z-10">
                      <li className="flex items-center gap-3">✦ 150 张极速渲染阵列</li>
                      <li className="flex items-center gap-3">✦ 90 天无缝文案引擎</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => ultraPackage && handleSelectPackage(ultraPackage)}
                      disabled={!ultraPackage}
                      className="relative z-10 mt-8 w-full py-3.5 bg-gray-50 text-gray-700 group-hover:bg-gray-900 group-hover:text-white rounded-xl font-bold text-[15px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      获取额度
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'pro' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto animate-[fadeIn_0.4s_ease-out]">
                  <div className="group relative bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-gray-800 hover:shadow-[0_12px_50px_rgba(17,24,39,0.15)] flex flex-col overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-50/0 to-gray-50/0 group-hover:to-gray-100/50 transition-colors duration-500 pointer-events-none"></div>
                    <div className="mb-8 relative z-10">
                      <h3 className="text-xl font-bold text-gray-800 mb-2 font-mono uppercase tracking-wider group-hover:text-gray-900 transition-colors">Pro / 工作室包月</h3>
                      <div className="flex items-baseline gap-1"><span className="text-2xl font-semibold">¥</span><span className="text-5xl font-black text-[#1d1d1f]">599</span><span className="text-gray-400 font-medium text-lg ml-1">/ 月</span></div>
                    </div>
                    <ul className="space-y-5 text-[15px] text-gray-600 font-medium flex-1 relative z-10">
                      <li className="flex items-center gap-3">✦ 每月 1000 组极速渲染阵列</li>
                      <li className="flex items-center gap-3">✦ 包月无缝文案引擎网络</li>
                      <li className="flex items-center gap-3">✦ 商业授权与免责保护</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleProPlanAction('monthly')}
                      className="relative z-10 mt-10 w-full py-4 bg-[#111827] text-white hover:bg-black rounded-xl font-bold text-[16px] transition-all duration-300 shadow-lg"
                    >
                      订阅包月
                    </button>
                  </div>

                  <div className="group relative bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-[#B8860B] hover:shadow-[0_12px_50px_rgba(184,134,11,0.15)] flex flex-col overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/0 to-yellow-50/0 group-hover:to-yellow-50/50 transition-colors duration-500 pointer-events-none"></div>
                    <div className="mb-8 relative z-10">
                      <h3 className="text-xl font-bold text-gray-800 mb-2 font-mono uppercase tracking-wider group-hover:text-[#B8860B] transition-colors">Max / 企业包年</h3>
                      <div className="flex items-baseline gap-1"><span className="text-2xl font-semibold">¥</span><span className="text-5xl font-black text-[#1d1d1f]">6888</span><span className="text-gray-400 font-medium text-lg ml-1">/ 年</span></div>
                    </div>
                    <ul className="space-y-5 text-[15px] text-gray-600 font-medium flex-1 relative z-10">
                      <li className="flex items-center gap-3">✦ 全年无限组满血渲染阵列</li>
                      <li className="flex items-center gap-3">✦ 专属企业级 API 调度通道</li>
                      <li className="flex items-center gap-3">✦ 1V1 专属架构师运维支持</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleProPlanAction('yearly')}
                      className="relative z-10 mt-10 w-full py-4 bg-[#B8860B] text-white hover:bg-[#9A7B00] rounded-xl font-bold text-[16px] transition-all duration-300 shadow-lg shadow-yellow-600/20"
                    >
                      联系客服升级
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-6">
              <button
                type="button"
                onClick={handleBackToSelect}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-[12px] font-semibold hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft size={14} />
                返回重选套餐
              </button>
              <div className="text-right pr-8">
                <p className="text-[11px] tracking-[0.2em] uppercase font-mono font-semibold text-gray-400">Secure Checkout</p>
                <p className="text-[13px] text-gray-500 font-medium">
                  {activeMeta ? `${activeMeta.title} · ¥${activePackage?.amount ?? '--'}` : '支付信息加载中'}
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-white p-5 flex flex-col items-center gap-4 min-h-[320px] justify-center shadow-sm">
              {loading ? (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  <p className="text-[12px] font-semibold">正在生成专属安全支付码...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-[12px] font-semibold text-red-500">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (activePackage) void createOrder(activePackage);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111827] text-white text-[12px] font-semibold hover:bg-[#1a2333] transition-colors"
                  >
                    <RefreshCw size={14} />
                    重试获取二维码
                  </button>
                </div>
              ) : qrCode ? (
                <>
                  <div className="p-3 bg-white rounded-[1.5rem] shadow-sm border border-gray-100">
                    <QRCodeSVG value={qrCode} size={220} />
                  </div>
                  <p className="text-[12px] text-gray-600 font-semibold inline-flex items-center gap-2">
                    {payStatus === 'success' ? <CheckCircle2 size={16} className="text-green-500" /> : <ScanLine size={16} className="text-violet-500" />}
                    {payStatus === 'success' ? '支付成功，正在同步权益...' : '请使用支付宝扫码付款'}
                  </p>
                  {outTradeNo && (
                    <p className="text-[10px] text-gray-400 font-mono break-all text-center">订单号：{outTradeNo}</p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-[12px] font-medium">收银台初始化中...</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
