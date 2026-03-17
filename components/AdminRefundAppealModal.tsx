import React, { useEffect, useMemo, useState } from 'react';
import { Coins, RefreshCw, ShieldAlert, X } from 'lucide-react';
import type {
  AdminRefundAppealActionType,
  AdminRefundAppealDetail,
  AdminRefundAppealListItem,
} from '../types';

interface AdminRefundAppealModalProps {
  open: boolean;
  appeals: AdminRefundAppealListItem[];
  selectedAppealId: string | null;
  detail: AdminRefundAppealDetail | null;
  isListLoading: boolean;
  isDetailLoading: boolean;
  isActionLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onSelectAppeal: (appealId: string) => void;
  onSubmitAction: (payload: {
    appealId: string;
    actionType: AdminRefundAppealActionType;
    refundTokens?: number;
    note?: string | null;
  }) => Promise<void>;
}

const ACTION_OPTIONS: Array<{ value: AdminRefundAppealActionType; label: string }> = [
  { value: 'MARK_UNDER_REVIEW', label: '转为审核中' },
  { value: 'APPROVE_TOKEN_REFUND', label: '通过并退回 Token' },
  { value: 'RESOLVE_NO_REFUND', label: '核查完成，不退款' },
  { value: 'REJECT_APPEAL', label: '驳回申诉' },
];

function getStatusClass(status: string) {
  if (status === 'REFUNDED') return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (status === 'REJECTED') return 'bg-rose-50 text-rose-600 border-rose-200';
  if (status === 'UNDER_REVIEW') return 'bg-amber-50 text-amber-600 border-amber-200';
  return 'bg-stone-100 text-stone-600 border-stone-200';
}

function getPriorityClass(priority: AdminRefundAppealListItem['review_priority']) {
  if (priority === 'high') return 'bg-rose-50 text-rose-600 border-rose-200';
  if (priority === 'review') return 'bg-amber-50 text-amber-600 border-amber-200';
  return 'bg-emerald-50 text-emerald-600 border-emerald-200';
}

const AdminRefundAppealModal: React.FC<AdminRefundAppealModalProps> = ({
  open,
  appeals,
  selectedAppealId,
  detail,
  isListLoading,
  isDetailLoading,
  isActionLoading,
  onClose,
  onRefresh,
  onSelectAppeal,
  onSubmitAction,
}) => {
  const [actionType, setActionType] = useState<AdminRefundAppealActionType>('APPROVE_TOKEN_REFUND');
  const [refundTokens, setRefundTokens] = useState('1');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!detail?.appeal) return;
    if (actionType === 'APPROVE_TOKEN_REFUND') {
      setRefundTokens(String(Math.max(1, detail.appeal.requested_refund_tokens || 1)));
    }
  }, [detail, actionType]);

  const chargedTokenTotal = useMemo(
    () => detail?.ledger.reduce((total, item) => total + (item.action_type === 'CHARGE' ? item.token_delta : 0), 0) || 0,
    [detail],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm overflow-y-auto p-3 md:p-6">
      <div className="mx-auto flex max-h-[calc(100dvh-24px)] w-full max-w-[1360px] flex-col overflow-hidden rounded-[32px] border border-white/50 bg-[#f8f7f4] shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-stone-200/80 px-5 py-4 md:px-7">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-stone-400">Appeal Desk</p>
            <h2 className="mt-1 text-[22px] font-black tracking-tight text-stone-900">退款申诉台</h2>
            <p className="mt-1 text-[13px] text-stone-500">查看用户申诉、核对扣费与到账情况，并直接处理 Token 退回。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-[12px] font-bold text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
            >
              <RefreshCw size={14} />
              刷新
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-900"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-b border-stone-200/80 bg-white/65 px-4 py-4 xl:border-b-0 xl:border-r">
            <div className="mb-3">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-stone-400">Appeals</p>
              <p className="mt-1 text-[13px] text-stone-500">{isListLoading ? '正在读取申诉列表...' : `共 ${appeals.length} 条申诉`}</p>
            </div>
            <div className="space-y-3">
              {appeals.map((appeal) => (
                <button
                  key={appeal.id}
                  type="button"
                  onClick={() => onSelectAppeal(appeal.id)}
                  className={`w-full rounded-[24px] border px-4 py-3 text-left transition ${
                    selectedAppealId === appeal.id
                      ? 'border-stone-900 bg-stone-900 text-white shadow-lg'
                      : 'border-stone-200 bg-white text-stone-900 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black">{appeal.title}</p>
                      <p className={`mt-1 text-[11px] ${selectedAppealId === appeal.id ? 'text-white/70' : 'text-stone-500'}`}>
                        用户 {appeal.user_id}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${selectedAppealId === appeal.id ? 'border-white/20 bg-white/10 text-white' : getPriorityClass(appeal.review_priority)}`}>
                      {appeal.review_priority === 'high' ? '优先处理' : appeal.review_priority === 'review' ? '待审核' : '已处理'}
                    </span>
                  </div>
                  <div className={`mt-3 flex flex-wrap gap-2 text-[11px] ${selectedAppealId === appeal.id ? 'text-white/75' : 'text-stone-500'}`}>
                    <span>{appeal.appeal_type}</span>
                    <span>{appeal.source_type}</span>
                    <span>{appeal.created_at || '--'}</span>
                  </div>
                </button>
              ))}
              {!isListLoading && appeals.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-stone-200 bg-stone-50 px-4 py-10 text-center text-[13px] text-stone-500">
                  暂无待处理申诉
                </div>
              ) : null}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            {!detail || isDetailLoading ? (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-stone-200 bg-white/70 px-6 text-center text-[14px] text-stone-500">
                {isDetailLoading ? '正在读取申诉详情...' : '左侧选择一条申诉，即可查看生成记录和处理动作。'}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${getStatusClass(detail.appeal.status)}`}>{detail.appeal.status}</span>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-black text-stone-600">{detail.appeal.appeal_type}</span>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-black text-stone-600">{detail.appeal.source_type}</span>
                    </div>
                    <h3 className="mt-4 text-[19px] font-black text-stone-900">{detail.appeal.title}</h3>
                    <div className="mt-3 grid gap-3 text-[12px] text-stone-500 sm:grid-cols-2">
                      <p>申诉单：<span className="font-semibold text-stone-700">{detail.appeal.id}</span></p>
                      <p>用户 ID：<span className="font-semibold text-stone-700">{detail.appeal.user_id}</span></p>
                      <p>申请 Token：<span className="font-semibold text-stone-700">{detail.appeal.requested_refund_tokens}</span></p>
                      <p>申请金额：<span className="font-semibold text-stone-700">{detail.appeal.requested_refund_amount}</span></p>
                      <p>自动核查：<span className="font-semibold text-stone-700">{detail.appeal.auto_check_result || '-'}</span></p>
                      <p>创建时间：<span className="font-semibold text-stone-700">{detail.appeal.created_at || '-'}</span></p>
                    </div>
                    {detail.appeal.description ? (
                      <div className="mt-4 rounded-[20px] bg-stone-50 px-4 py-3 text-[13px] text-stone-600">{detail.appeal.description}</div>
                    ) : null}
                    {detail.appeal.resolution_summary ? (
                      <div className="mt-3 rounded-[20px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
                        {detail.appeal.resolution_summary}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-stone-900">
                      <ShieldAlert size={16} />
                      <h3 className="text-[15px] font-black">处理动作</h3>
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-stone-400">动作</span>
                        <select
                          value={actionType}
                          onChange={(event) => setActionType(event.target.value as AdminRefundAppealActionType)}
                          className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[13px] font-semibold text-stone-800 outline-none transition focus:border-stone-400"
                        >
                          {ACTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {actionType === 'APPROVE_TOKEN_REFUND' ? (
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-stone-400">退回 Token</span>
                          <input
                            value={refundTokens}
                            onChange={(event) => setRefundTokens(event.target.value.replace(/[^\d]/g, ''))}
                            className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[13px] font-semibold text-stone-800 outline-none transition focus:border-stone-400"
                          />
                        </label>
                      ) : null}

                      <label className="block">
                        <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-stone-400">管理员备注</span>
                        <textarea
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          className="min-h-[120px] w-full rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-[13px] leading-6 text-stone-800 outline-none transition focus:border-stone-400"
                          placeholder="例如：已核对账单与扣费流水，退回本次异常消耗的 Token。"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => {
                          void onSubmitAction({
                            appealId: detail.appeal.id,
                            actionType,
                            refundTokens: actionType === 'APPROVE_TOKEN_REFUND' ? Math.max(1, Number(refundTokens || 0)) : undefined,
                            note: note.trim() || null,
                          });
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-[13px] font-black text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Coins size={15} />
                        {isActionLoading ? '处理中...' : '提交处理动作'}
                      </button>
                    </div>
                  </div>
                </div>

                {detail.related_job ? (
                  <div className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[16px] font-black text-stone-900">关联生成任务</h3>
                        <p className="mt-1 text-[12px] text-stone-500">
                          {detail.related_job.id} · {detail.related_job.mode} · {detail.related_job.status} · 已扣 {chargedTokenTotal} Token
                        </p>
                      </div>
                      <div className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-black text-stone-600">
                        {detail.related_job.trace_id || '无 Trace'}
                      </div>
                    </div>

                    {detail.outputs.length ? (
                      <div className="mt-4 grid gap-4 lg:grid-cols-3">
                        {detail.outputs.map((output) => (
                          <div key={output.id} className="rounded-[22px] border border-stone-200 bg-stone-50 p-3">
                            <div className="aspect-[4/5] overflow-hidden rounded-[18px] bg-white">
                              {output.image_url ? (
                                <img src={output.image_url} alt={`output-${output.slot_index}`} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[12px] text-stone-400">暂无图片</div>
                              )}
                            </div>
                            <div className="mt-3 space-y-1 text-[12px] text-stone-500">
                              <p className="font-semibold text-stone-700">第 {output.slot_index + 1} 张 · {output.status}</p>
                              <p>{output.model_name || '未知模型'}</p>
                              <p>{output.charged_tokens > 0 ? `已扣 ${output.charged_tokens} Token` : '未扣费'}</p>
                              {output.error_message ? <p className="text-rose-500">{output.error_message}</p> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {detail.ledger.length ? (
                      <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                        <p className="text-[13px] font-black text-stone-900">扣费与补偿流水</p>
                        <div className="mt-3 space-y-2 text-[12px] text-stone-500">
                          {detail.ledger.map((item) => (
                            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-stone-700">{item.action_type}</p>
                                <p className="truncate">{item.reason || '-'}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-stone-900">{item.token_delta}</p>
                                <p>{item.created_at || '--'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminRefundAppealModal;
