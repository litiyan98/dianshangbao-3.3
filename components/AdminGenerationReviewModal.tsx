import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Coins, RefreshCw, ShieldAlert, X } from 'lucide-react';
import type {
  AdminGenerationIssueTag,
  AdminGenerationReviewActionType,
  AdminGenerationReviewDetail,
  AdminGenerationReviewListItem,
  AdminGenerationReviewOutput,
} from '../types';

interface AdminGenerationReviewModalProps {
  open: boolean;
  jobs: AdminGenerationReviewListItem[];
  selectedJobId: string | null;
  detail: AdminGenerationReviewDetail | null;
  isListLoading: boolean;
  isDetailLoading: boolean;
  isActionLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onSelectJob: (jobId: string) => void;
  onSubmitAction: (payload: {
    actionType: AdminGenerationReviewActionType;
    issueTag?: AdminGenerationIssueTag | null;
    jobId: string;
    outputId?: string | null;
    userId: string;
    tokenAmount?: number;
    note?: string | null;
  }) => Promise<void>;
}

const ACTION_OPTIONS: Array<{ value: AdminGenerationReviewActionType; label: string }> = [
  { value: 'REFUND_TOKEN', label: '退回 Token' },
  { value: 'COMPENSATE_TOKEN', label: '补偿 Token' },
  { value: 'MARK_MODEL_ISSUE', label: '标记模型问题' },
  { value: 'MARK_REFERENCE_DRIFT', label: '标记参考图干扰' },
  { value: 'MARK_USER_INPUT_ISSUE', label: '标记素材问题' },
  { value: 'RESOLVE_NO_ACTION', label: '记录已核查' },
];

const ISSUE_OPTIONS: Array<{ value: AdminGenerationIssueTag; label: string }> = [
  { value: 'MODEL_DRIFT', label: '模型漂移' },
  { value: 'REFERENCE_DRIFT', label: '参考图污染' },
  { value: 'USER_INPUT_ISSUE', label: '用户素材问题' },
  { value: 'POST_PROCESS_ISSUE', label: '后处理问题' },
  { value: 'MISCHARGE', label: '误扣费' },
  { value: 'OTHER', label: '其他' },
];

function getRiskBadgeClass(risk: AdminGenerationReviewListItem['risk_level']) {
  if (risk === 'high') return 'bg-red-50 text-red-600 border-red-200';
  if (risk === 'review') return 'bg-amber-50 text-amber-600 border-amber-200';
  return 'bg-emerald-50 text-emerald-600 border-emerald-200';
}

function getOutputStatusLabel(output: AdminGenerationReviewOutput) {
  if (output.status === 'COMPLETED') {
    return output.charged_tokens > 0 ? `成功 · 已扣 ${output.charged_tokens} Token` : '成功';
  }
  return output.error_message || '生成失败';
}

const AdminGenerationReviewModal: React.FC<AdminGenerationReviewModalProps> = ({
  open,
  jobs,
  selectedJobId,
  detail,
  isListLoading,
  isDetailLoading,
  isActionLoading,
  onClose,
  onRefresh,
  onSelectJob,
  onSubmitAction,
}) => {
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<AdminGenerationReviewActionType>('REFUND_TOKEN');
  const [issueTag, setIssueTag] = useState<AdminGenerationIssueTag>('MODEL_DRIFT');
  const [tokenAmount, setTokenAmount] = useState('1');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!detail?.outputs?.length) {
      setSelectedOutputId(null);
      return;
    }
    setSelectedOutputId((prev) => {
      if (prev && detail.outputs.some((item) => item.id === prev)) return prev;
      return detail.outputs[0]?.id || null;
    });
  }, [detail]);

  const selectedOutput = useMemo(
    () => detail?.outputs.find((item) => item.id === selectedOutputId) || null,
    [detail, selectedOutputId],
  );

  useEffect(() => {
    if (!selectedOutput) return;
    if (actionType === 'REFUND_TOKEN' || actionType === 'COMPENSATE_TOKEN') {
      setTokenAmount(String(Math.max(1, selectedOutput.charged_tokens || 1)));
    }
  }, [selectedOutput, actionType]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm overflow-y-auto p-3 md:p-6">
      <div className="mx-auto flex max-h-[calc(100dvh-24px)] w-full max-w-[1360px] flex-col overflow-hidden rounded-[32px] border border-white/50 bg-[#f8f7f4] shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-stone-200/80 px-5 py-4 md:px-7">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-stone-400">Admin Review</p>
            <h2 className="mt-1 text-[22px] font-black tracking-tight text-stone-900">生成审查台</h2>
            <p className="mt-1 text-[13px] text-stone-500">查看结果图、扣费流水，并处理货不对板与误扣费问题。</p>
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
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-stone-400">Recent Jobs</p>
                <p className="mt-1 text-[13px] text-stone-500">{isListLoading ? '正在读取审查列表...' : `共 ${jobs.length} 条任务`}</p>
              </div>
            </div>
            <div className="space-y-3">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onSelectJob(job.id)}
                  className={`w-full rounded-[24px] border px-4 py-3 text-left transition ${
                    selectedJobId === job.id
                      ? 'border-stone-900 bg-stone-900 text-white shadow-lg'
                      : 'border-stone-200 bg-white text-stone-900 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black">{job.id}</p>
                      <p className={`mt-1 text-[11px] ${selectedJobId === job.id ? 'text-white/70' : 'text-stone-500'}`}>
                        用户 {job.user_id}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${selectedJobId === job.id ? 'border-white/20 bg-white/10 text-white' : getRiskBadgeClass(job.risk_level)}`}>
                      {job.risk_level === 'high' ? '高风险' : job.risk_level === 'review' ? '待审查' : '正常'}
                    </span>
                  </div>
                  <div className={`mt-3 flex flex-wrap gap-2 text-[11px] ${selectedJobId === job.id ? 'text-white/75' : 'text-stone-500'}`}>
                    <span>{job.mode}</span>
                    <span>成功 {job.completed_outputs}</span>
                    <span>失败 {job.failed_outputs}</span>
                    <span>扣费 {job.charged_tokens}</span>
                    {job.refunded_tokens > 0 ? <span>已退 {job.refunded_tokens}</span> : null}
                  </div>
                </button>
              ))}
              {!isListLoading && jobs.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-stone-200 bg-stone-50 px-4 py-10 text-center text-[13px] text-stone-500">
                  暂无可审查任务
                </div>
              ) : null}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            {!detail || isDetailLoading ? (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-stone-200 bg-white/70 px-6 text-center text-[14px] text-stone-500">
                {isDetailLoading ? '正在读取任务详情...' : '左侧选择一条任务，即可查看生成图、扣费流水与审核动作。'}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-black text-stone-600">{detail.job.mode}</span>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-black text-stone-600">{detail.job.status}</span>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-black text-stone-600">{detail.job.stage}</span>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-black text-stone-600">进度 {detail.job.progress}%</span>
                    </div>
                    <h3 className="mt-4 text-[19px] font-black text-stone-900">任务 {detail.job.id}</h3>
                    <div className="mt-3 grid gap-3 text-[12px] text-stone-500 sm:grid-cols-2">
                      <p>用户 ID：<span className="font-semibold text-stone-700">{detail.job.user_id}</span></p>
                      <p>Trace：<span className="font-semibold text-stone-700">{detail.job.trace_id || '-'}</span></p>
                      <p>创建时间：<span className="font-semibold text-stone-700">{detail.job.created_at || '-'}</span></p>
                      <p>最后更新：<span className="font-semibold text-stone-700">{detail.job.updated_at || '-'}</span></p>
                    </div>
                    {detail.job.message ? (
                      <div className="mt-4 rounded-[20px] bg-stone-50 px-4 py-3 text-[13px] text-stone-600">{detail.job.message}</div>
                    ) : null}
                    {detail.job.error_message ? (
                      <div className="mt-3 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-600">
                        {detail.job.error_message}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-stone-900">
                      <ShieldAlert size={16} />
                      <h3 className="text-[15px] font-black">审核动作</h3>
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-stone-400">动作</span>
                        <select
                          value={actionType}
                          onChange={(event) => setActionType(event.target.value as AdminGenerationReviewActionType)}
                          className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[13px] font-semibold text-stone-800 outline-none transition focus:border-stone-400"
                        >
                          {ACTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-stone-400">问题归因</span>
                        <select
                          value={issueTag}
                          onChange={(event) => setIssueTag(event.target.value as AdminGenerationIssueTag)}
                          className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[13px] font-semibold text-stone-800 outline-none transition focus:border-stone-400"
                        >
                          {ISSUE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {(actionType === 'REFUND_TOKEN' || actionType === 'COMPENSATE_TOKEN') ? (
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-stone-400">Token 数量</span>
                          <input
                            value={tokenAmount}
                            onChange={(event) => setTokenAmount(event.target.value.replace(/[^\d]/g, ''))}
                            className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[13px] font-semibold text-stone-800 outline-none transition focus:border-stone-400"
                          />
                        </label>
                      ) : null}

                      <label className="block">
                        <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-stone-400">备注</span>
                        <textarea
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          rows={4}
                          className="w-full resize-none rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-[13px] text-stone-700 outline-none transition focus:border-stone-400"
                          placeholder="例如：疑似参考图商品漂移，先退回本张 Token。"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() =>
                          onSubmitAction({
                            actionType,
                            issueTag,
                            jobId: detail.job.id,
                            outputId: selectedOutput?.id || null,
                            userId: detail.job.user_id,
                            tokenAmount: Number(tokenAmount || 0),
                            note,
                          })
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d1d1f] px-5 py-3 text-[13px] font-black tracking-[0.18em] text-white transition hover:bg-[#002FA7] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Coins size={14} />
                        {isActionLoading ? '处理中...' : '提交处理动作'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
                  <div className="mb-4 flex items-center gap-2 text-stone-900">
                    <AlertTriangle size={16} />
                    <h3 className="text-[15px] font-black">生成结果</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {detail.outputs.map((output) => (
                      <button
                        type="button"
                        key={output.id}
                        onClick={() => setSelectedOutputId(output.id)}
                        className={`overflow-hidden rounded-[24px] border text-left transition ${
                          selectedOutput?.id === output.id ? 'border-stone-900 ring-2 ring-stone-900/10' : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="aspect-[4/5] bg-stone-100">
                          {output.image_url ? (
                            <img src={output.image_url} alt={`输出 ${output.slot_index + 1}`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-stone-400">
                              该张未产出可展示图片
                            </div>
                          )}
                        </div>
                        <div className="space-y-2 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-black text-stone-900">第 {output.slot_index + 1} 张</p>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${output.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {output.status}
                            </span>
                          </div>
                          <p className="text-[12px] text-stone-500">{getOutputStatusLabel(output)}</p>
                          <p className="truncate text-[11px] text-stone-400">{output.model_name || '未知模型'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
                    <h3 className="text-[15px] font-black text-stone-900">扣费 / 补偿流水</h3>
                    <div className="mt-4 space-y-3">
                      {detail.ledger.map((entry) => (
                        <div key={entry.id} className="rounded-[20px] border border-stone-100 bg-stone-50 px-4 py-3 text-[12px] text-stone-600">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-stone-800">{entry.action_type}</span>
                            <span className="font-semibold">{entry.token_delta} Token</span>
                          </div>
                          <p className="mt-1">{entry.reason || '无备注'}</p>
                        </div>
                      ))}
                      {detail.ledger.length === 0 ? <p className="text-[12px] text-stone-400">暂无扣费流水</p> : null}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
                    <h3 className="text-[15px] font-black text-stone-900">审核记录</h3>
                    <div className="mt-4 space-y-3">
                      {detail.actions.map((entry) => (
                        <div key={entry.id} className="rounded-[20px] border border-stone-100 bg-stone-50 px-4 py-3 text-[12px] text-stone-600">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-stone-800">{entry.action_type}</span>
                            <span>{entry.issue_tag || '未分类'}</span>
                          </div>
                          <p className="mt-1">{entry.note || '无备注'}</p>
                        </div>
                      ))}
                      {detail.actions.length === 0 ? <p className="text-[12px] text-stone-400">暂无审核记录</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminGenerationReviewModal;
