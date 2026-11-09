import type { PostInsights } from '@/lib/types';
import Modal from './Modal';
import {
  TrendingUp,
  Eye,
  Bookmark,
  Share2,
  Clock,
  Users,
  Activity,
  BarChart3,
  Loader2,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  insights: PostInsights | null;
  loading?: boolean;
}

export default function PostInsightsModal({ open, onClose, insights, loading = false }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Post Insights">
      {loading || !insights ? (
        <div className="flex flex-col items-center justify-center py-12 text-white/40">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <span className="text-sm">Calculating real-time analytics…</span>
        </div>
      ) : (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto no-scrollbar pb-2">
          {/* Top Banner Metric */}
          <div className="bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-orange-500/10 border border-pink-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Engagement Rate
              </span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                High Performance
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold tracking-tight tabular-nums text-white">
                {insights.total_engagement_rate}%
              </span>
              <span className="text-xs text-white/50">
                (Likes + Comments + Shares + Saves / Views)
              </span>
            </div>
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <MetricCard
              icon={<Eye className="w-4 h-4 text-sky-400" />}
              label="Total Impressions"
              value={insights.impressions}
              subtitle="Total times displayed"
            />
            <MetricCard
              icon={<Users className="w-4 h-4 text-purple-400" />}
              label="Accounts Reached"
              value={insights.reach}
              subtitle={`${insights.unique_viewers} unique viewers`}
            />
            <MetricCard
              icon={<Clock className="w-4 h-4 text-amber-400" />}
              label="Avg. View Duration"
              value={`${insights.avg_view_duration_sec}s`}
              subtitle="Time spent on viewport"
            />
            <MetricCard
              icon={<Bookmark className="w-4 h-4 text-pink-400" />}
              label="Saves / Bookmarks"
              value={insights.saves}
              subtitle={`${insights.shares} shares to DMs & link`}
            />
          </div>

          {/* Engagement Trend Over Time */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-pink-400" />
                Impressions & Engagement Trend
              </span>
              <span className="text-[11px] text-white/40">Last 5 Days</span>
            </div>

            <div className="flex items-end justify-between gap-3 h-28 pt-4">
              {insights.trend.map((t) => {
                const maxVal = Math.max(...insights.trend.map((x) => x.views), 1);
                const heightPct = Math.max(15, Math.round((t.views / maxVal) * 100));
                return (
                  <div key={t.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] text-white/50 tabular-nums">{t.views}</span>
                    <div className="w-full max-w-[28px] bg-white/5 rounded-t-lg relative flex flex-col justify-end overflow-hidden" style={{ height: `${heightPct}%` }}>
                      <div
                        className="w-full bg-gradient-to-t from-pink-500 to-orange-400 rounded-t-lg"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-white/60 font-medium">{t.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Viewer Demographics */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                Top Viewer Creator Segments
              </span>
            </div>
            <div className="space-y-2.5">
              {insights.top_demographics.map((demo) => (
                <div key={demo.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/80">{demo.label}</span>
                    <span className="font-semibold text-white tabular-nums">{demo.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-pink-500 rounded-full"
                      style={{ width: `${demo.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-white/5 rounded-lg">{icon}</div>
        <span className="text-xs text-white/60 font-medium truncate">{label}</span>
      </div>
      <div className="text-xl font-bold tracking-tight text-white tabular-nums">{value}</div>
      <div className="text-[11px] text-white/40 truncate mt-0.5">{subtitle}</div>
    </div>
  );
}
