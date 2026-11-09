import { useState, useEffect } from 'react';
import type { Ad, AdAnalyticsDay } from '@/lib/types';
import { fetchAdvertiserAds, createAdCampaign, toggleAdStatus, fetchAdAnalytics } from '@/lib/api';
import {
  TrendingUp,
  MousePointer,
  Eye,
  DollarSign,
  Plus,
  Play,
  Pause,
  ExternalLink,
  Sparkles,
  BarChart3,
  Calendar,
  Layers,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface AdManagerScreenProps {
  onBack?: () => void;
}

export default function AdManagerScreen({ onBack }: AdManagerScreenProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [analytics, setAnalytics] = useState<AdAnalyticsDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New ad form
  const [brandName, setBrandName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [ctaText, setCtaText] = useState('Shop Now');
  const [budget, setBudget] = useState(250);
  const [targetDemographics, setTargetDemographics] = useState('Creators, Tech Enthusiasts, Photographers');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const adsList = await fetchAdvertiserAds();
      setAds(adsList);
      if (adsList.length > 0) {
        setSelectedAd(adsList[0]);
        const stats = await fetchAdAnalytics(adsList[0].id);
        setAnalytics(stats);
      }
    } catch (err) {
      console.error('Failed to load ads data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectAd = async (ad: Ad) => {
    setSelectedAd(ad);
    try {
      const stats = await fetchAdAnalytics(ad.id);
      setAnalytics(stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleToggleStatus = async (ad: Ad) => {
    const nextStatus = ad.status === 'active' ? 'paused' : 'active';
    try {
      const updated = await toggleAdStatus(ad.id, nextStatus);
      setAds((prev) => prev.map((a) => (a.id === ad.id ? updated : a)));
      if (selectedAd?.id === ad.id) setSelectedAd(updated);
    } catch (err) {
      console.error('Failed to toggle ad status:', err);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !mediaUrl.trim() || !targetUrl.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await createAdCampaign({
        brand_name: brandName.trim() || 'My Brand',
        brand_logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&q=80',
        title: title.trim(),
        description: description.trim(),
        media_url: mediaUrl.trim(),
        target_url: targetUrl.trim(),
        cta_text: ctaText,
        budget: budget,
        target_demographics: targetDemographics,
      });

      setAds((prev) => [created, ...prev]);
      setSelectedAd(created);
      setShowCreateModal(false);

      // Reset form
      setTitle('');
      setDescription('');
      setMediaUrl('');
      setTargetUrl('');
    } catch (err) {
      console.error('Failed to create ad:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aggregate stats across all ads
  const totalImpressions = ads.reduce((sum, a) => sum + (a.impressions_count || 0), 0);
  const totalClicks = ads.reduce((sum, a) => sum + (a.clicks_count || 0), 0);
  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const totalBudget = ads.reduce((sum, a) => sum + (a.budget || 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top Navigation */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Snoo Ad Manager
            </h1>
            <p className="text-xs text-white/50">Native sponsored campaigns & performance analytics</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* KPI Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 relative overflow-hidden">
            <div className="flex items-center justify-between text-white/50 mb-2">
              <span className="text-xs font-medium">Total Impressions</span>
              <Eye className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">{totalImpressions.toLocaleString()}</p>
            <span className="text-[10px] text-emerald-400 font-medium">↑ +14.2% this week</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 relative overflow-hidden">
            <div className="flex items-center justify-between text-white/50 mb-2">
              <span className="text-xs font-medium">Total Clicks</span>
              <MousePointer className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-white">{totalClicks.toLocaleString()}</p>
            <span className="text-[10px] text-emerald-400 font-medium">↑ +8.5% CTR rate</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 relative overflow-hidden">
            <div className="flex items-center justify-between text-white/50 mb-2">
              <span className="text-xs font-medium">Avg Click-Through (CTR)</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">{overallCtr}%</p>
            <span className="text-[10px] text-white/40">Industry avg: 1.8%</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 relative overflow-hidden">
            <div className="flex items-center justify-between text-white/50 mb-2">
              <span className="text-xs font-medium">Active Budget</span>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">${totalBudget.toLocaleString()}</p>
            <span className="text-[10px] text-white/40">Across {ads.length} campaigns</span>
          </div>
        </div>

        {/* Campaigns Grid & Selected Campaign Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Campaigns ({ads.length})
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-white/40">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                <span className="text-xs">Loading campaigns...</span>
              </div>
            ) : ads.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-white/40 text-xs">
                No active campaigns yet. Click "New Campaign" to launch one!
              </div>
            ) : (
              ads.map((ad) => {
                const isSelected = selectedAd?.id === ad.id;
                const isActive = ad.status === 'active';
                return (
                  <div
                    key={ad.id}
                    onClick={() => handleSelectAd(ad)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/5'
                        : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white truncate max-w-[160px]">
                        {ad.title}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(ad);
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 transition-colors ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30'
                        }`}
                      >
                        {isActive ? <Play className="w-2.5 h-2.5 fill-emerald-400" /> : <Pause className="w-2.5 h-2.5" />}
                        {ad.status}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-white/50">
                      <span>{ad.brand_name}</span>
                      <span>Budget: ${ad.budget}</span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-white/40 block text-[10px]">Impressions</span>
                        <span className="font-semibold text-white">
                          {ad.impressions_count.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[10px]">Clicks</span>
                        <span className="font-semibold text-amber-400">
                          {ad.clicks_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Campaign Analytics Deep Dive */}
          <div className="lg:col-span-2 space-y-4">
            {selectedAd ? (
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
                  <div>
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                      {selectedAd.brand_name}
                    </span>
                    <h3 className="text-xl font-bold text-white mb-1">{selectedAd.title}</h3>
                    <p className="text-xs text-white/60 max-w-md">{selectedAd.description}</p>
                  </div>

                  <a
                    href={selectedAd.target_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 self-start"
                  >
                    <span>Target URL</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Campaign Visual & Targeting */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/60 border border-white/10">
                    <img
                      src={selectedAd.media_url}
                      alt={selectedAd.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-amber-400 font-bold border border-amber-500/30">
                      Ad Preview
                    </div>
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-amber-500 text-black font-bold text-[10px]">
                      {selectedAd.cta_text}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">
                        Audience Targeting
                      </h4>
                      <p className="text-xs text-white/90 bg-white/5 p-2.5 rounded-xl border border-white/5 mb-3">
                        {selectedAd.target_demographics || 'Broad Audience (All creators)'}
                      </p>
                      <div className="space-y-1.5 text-xs text-white/60">
                        <div className="flex justify-between">
                          <span>Placement:</span>
                          <span className="text-white">Main Feed & Reels Feed</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Frequency:</span>
                          <span className="text-white">Every 5-7 Posts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className={selectedAd.status === 'active' ? 'text-emerald-400 font-semibold' : 'text-zinc-400'}>
                            {selectedAd.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-white/40">Daily Cap:</span>
                      <span className="font-bold text-amber-400">${selectedAd.budget}/day</span>
                    </div>
                  </div>
                </div>

                {/* Daily Engagement Breakdown Chart */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                    7-Day Engagement Performance
                  </h4>

                  <div className="space-y-2">
                    {analytics.map((day) => {
                      const dayCtr =
                        day.impressions > 0
                          ? ((day.clicks / day.impressions) * 100).toFixed(1)
                          : '0.0';
                      const maxImp = Math.max(...analytics.map((d) => d.impressions), 1);
                      const fillPct = Math.min(100, Math.round((day.impressions / maxImp) * 100));

                      return (
                        <div
                          key={day.date}
                          className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-4 text-xs"
                        >
                          <div className="w-20 font-mono text-[11px] text-white/50 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {day.date.slice(5)}
                          </div>

                          <div className="flex-1">
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-1">
                              <div
                                style={{ width: `${fillPct}%` }}
                                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-white/40">
                              <span>{day.impressions.toLocaleString()} views</span>
                              <span>{day.clicks} clicks</span>
                            </div>
                          </div>

                          <div className="w-16 text-right">
                            <span className="font-bold text-amber-400 text-xs">{dayCtr}%</span>
                            <span className="block text-[9px] text-white/30">CTR</span>
                          </div>

                          <div className="w-14 text-right">
                            <span className="font-semibold text-white text-xs">${day.spend}</span>
                            <span className="block text-[9px] text-white/30">Spend</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-white/40">Select a campaign to view analytics.</div>
            )}
          </div>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#12131e] border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Create Sponsored Campaign
            </h2>
            <p className="text-xs text-white/50 mb-5">
              Launch native promoted cards into the Snoo creator feed.
            </p>

            <form onSubmit={handleCreateAd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Lumina Optics, Peak Sound"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">Campaign Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., The Ultimate Cine Lens for Next-Gen Creators"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">Ad Copy / Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe your offer or product..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">Media URL (Image / Video Cover)</label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">Destination URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://yourbrand.com/offer"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">Call To Action (CTA)</label>
                  <select
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="Shop Now">Shop Now</option>
                    <option value="Learn More">Learn More</option>
                    <option value="Claim 20% Off">Claim 20% Off</option>
                    <option value="Download Now">Download Now</option>
                    <option value="Subscribe">Subscribe</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">Daily Budget ($)</label>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value) || 50)}
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">Target Audience</label>
                  <input
                    type="text"
                    value={targetDemographics}
                    onChange={(e) => setTargetDemographics(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Launch Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
