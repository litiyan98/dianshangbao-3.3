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

const POLLING_INTERVAL_MS = 3000;
const POLLING_TIMEOUT_MS = 5 * 60 * 1000;

const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  userId,
  selectedPackage,
  onClose,
  onPaid,
  onToast
}) => {
  const [step, setStep] = useState<PaymentStep>('select');
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

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-stone-900/75 backdrop-blur-xl" onClick={handleClose} />
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/20 bg-white/95 shadow-2xl p-6 md:p-7">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 transition-colors flex items-center justify-center"
        >
          <X size={16} />
        </button>

        {step === 'select' ? (
          <>
            <div className="text-center space-y-2 mb-6">
              <p className="text-[11px] tracking-[0.2em] uppercase font-black text-[#002FA7]">Pricing Center</p>
              <h3 className="text-[24px] font-black text-stone-900">选择适合您的扩容方案</h3>
              <p className="text-[13px] text-stone-500">解锁更多创作算力，持续稳定出图与文案产能</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {RECHARGE_PACKAGES.map((pkg) => {
                const isRecommended = !!pkg.recommended;
                return (
                  <div
                    key={pkg.packageType}
                    className={`rounded-2xl p-4 border shadow-sm transition-all bg-white flex flex-col justify-between ${
                      isRecommended
                        ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/20 shadow-[0_8px_24px_rgba(59,130,246,0.18)]'
                        : 'border-stone-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[14px] font-black text-stone-900">{pkg.label}</p>
                        {isRecommended ? (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black tracking-wide">
                            🔥 最热销
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[26px] font-black text-stone-900 leading-none">￥{pkg.amount}</p>
                      <p className="text-[12px] text-stone-600">{pkg.imageQuota}张极速出图 + {pkg.vipDays}天无限文案VIP</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectPackage(pkg)}
                      className={`mt-4 w-full py-2.5 rounded-xl text-[12px] font-black transition-all ${
                        isRecommended
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-blue-400/30 hover:opacity-95'
                          : 'bg-stone-900 text-white hover:bg-[#002FA7]'
                      }`}
                    >
                      立即解锁
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-5">
              <button
                type="button"
                onClick={handleBackToSelect}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-[12px] font-bold hover:bg-stone-50 transition-colors"
              >
                <ArrowLeft size={14} />
                返回重选套餐
              </button>
              <div className="text-right">
                <p className="text-[11px] tracking-[0.18em] uppercase font-black text-[#002FA7]">Secure Checkout</p>
                <p className="text-[13px] text-stone-600">
                  {activePackage ? `${activePackage.label} · ¥${activePackage.amount}` : '支付信息加载中'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 flex flex-col items-center gap-4 min-h-[320px] justify-center">
              {loading ? (
                <div className="flex flex-col items-center gap-3 text-stone-500">
                  <Loader2 className="w-8 h-8 animate-spin text-[#002FA7]" />
                  <p className="text-[12px] font-bold">正在生成专属安全支付码...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-[12px] font-bold text-red-500">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (activePackage) void createOrder(activePackage);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#002FA7] text-white text-[12px] font-black hover:opacity-90 transition-opacity"
                  >
                    <RefreshCw size={14} />
                    重试获取二维码
                  </button>
                </div>
              ) : qrCode ? (
                <>
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-100">
                    <QRCodeSVG value={qrCode} size={220} />
                  </div>
                  <p className="text-[12px] text-stone-600 font-bold inline-flex items-center gap-2">
                    {payStatus === 'success' ? <CheckCircle2 size={16} className="text-green-500" /> : <ScanLine size={16} className="text-[#002FA7]" />}
                    {payStatus === 'success' ? '支付成功，正在同步权益...' : '请使用支付宝扫码付款'}
                  </p>
                  {outTradeNo && (
                    <p className="text-[10px] text-stone-400 font-mono break-all text-center">订单号：{outTradeNo}</p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-stone-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-[12px] font-semibold">收银台初始化中...</p>
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
