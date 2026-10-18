import React, { useState, useMemo, useEffect } from 'react';
import initialNoticesData from './data/notices.json';
import {
  ShieldCheck,
  Search,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Bell,
  Building2,
  Flame,
  Radio,
  FileText,
  Sparkles,
  X,
  LayoutGrid,
  List,
  Share2,
  Send
} from 'lucide-react';
import './App.css';

function GitHubIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

const JURISDICTION_INFO = {
  'BPSC': { name: 'BPSC', state: 'Bihar', icon: '🏛️', cssClass: 'comm-bpsc' },
  'UPPSC': { name: 'UPPSC', state: 'Uttar Pradesh', icon: '🏛️', cssClass: 'comm-uppsc' },
  'MPPSC': { name: 'MPPSC', state: 'Madhya Pradesh', icon: '🏛️', cssClass: 'comm-mppsc' },
  'RPSC': { name: 'RPSC', state: 'Rajasthan', icon: '🏛️', cssClass: 'comm-rpsc' },
  'OPSC': { name: 'OPSC', state: 'Odisha', icon: '🏛️', cssClass: 'comm-opsc' },
  'MPSC': { name: 'MPSC', state: 'Maharashtra', icon: '🏛️', cssClass: 'comm-mpsc' },
  'Judiciary': { name: 'Pan-India Judiciary', state: 'High Courts & SCI', icon: '⚖️', cssClass: 'comm-judiciary' },
  'Allahabad': { name: 'Pan-India Judiciary', state: 'High Courts & SCI', icon: '⚖️', cssClass: 'comm-judiciary' },
  'ADA': { name: 'ADA & Prosecution', state: 'HPSC / PPSC / APO', icon: '🏛️', cssClass: 'comm-ada' },
  'Bar': { name: 'Bar Advocacy & Law', state: 'AIBE / BCI', icon: '📜', cssClass: 'comm-advocacy' }
};

function getCommissionMeta(jurisdiction = '') {
  const j = (jurisdiction || '').toUpperCase();
  if (j.includes('BPSC')) return JURISDICTION_INFO['BPSC'];
  if (j.includes('UPPSC')) return JURISDICTION_INFO['UPPSC'];
  if (j.includes('MPPSC')) return JURISDICTION_INFO['MPPSC'];
  if (j.includes('RPSC')) return JURISDICTION_INFO['RPSC'];
  if (j.includes('OPSC')) return JURISDICTION_INFO['OPSC'];
  if (j.includes('MPSC')) return JURISDICTION_INFO['MPSC'];
  if (j.includes('ADA') || j.includes('PROSECUTION')) return JURISDICTION_INFO['ADA'];
  if (j.includes('BAR') || j.includes('ADVOCACY') || j.includes('AIBE')) return JURISDICTION_INFO['Bar'];
  if (j.includes('JUDICIARY') || j.includes('ALLAHABAD') || j.includes('HIGH COURT') || j.includes('SCI')) return JURISDICTION_INFO['Judiciary'];
  return { name: jurisdiction, state: 'Official Portal', icon: '🏛️', cssClass: 'comm-bpsc' };
}

const JURISDICTION_FILTERS = [
  'All',
  'Pan-India Judiciary',
  'ADA & Prosecution',
  'Bar Advocacy & Law',
  'UPPSC',
  'BPSC',
  'MPPSC',
  'RPSC',
  'OPSC',
  'MPSC'
];

const CATEGORIES = [
  'All',
  'Admit Card',
  'Result',
  'Notification / Recruitment',
  'Exam Schedule',
  'Corrigendum / Revision',
  'Important Notice'
];

const PRIORITIES = ['All', 'CRITICAL', 'HIGH', 'NORMAL'];

export default function App() {
  const [noticesData, setNoticesData] = useState(initialNoticesData);
  const [search, setSearch] = useState('');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [copiedHash, setCopiedHash] = useState(null);
  const [copiedPdfHash, setCopiedPdfHash] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const allNotices = noticesData?.notices || [];

  // Show floating toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = allNotices.length;
    const critical = allNotices.filter((n) => n.priority === 'CRITICAL').length;
    const high = allNotices.filter((n) => n.priority === 'HIGH').length;
    const urgent = critical + high;
    const commissions = new Set(allNotices.map((n) => n.jurisdiction)).size;
    return { total, urgent, critical, commissions };
  }, [allNotices]);

  // Counts by Jurisdiction
  const countsByJurisdiction = useMemo(() => {
    const counts = { All: allNotices.length };
    JURISDICTION_FILTERS.forEach((j) => {
      if (j !== 'All') {
        counts[j] = allNotices.filter((n) =>
          n.jurisdiction?.toLowerCase().includes(j.toLowerCase())
        ).length;
      }
    });
    return counts;
  }, [allNotices]);

  // Filtering
  const filteredNotices = useMemo(() => {
    return allNotices.filter((item) => {
      // Jurisdiction filter
      if (
        selectedJurisdiction !== 'All' &&
        !item.jurisdiction?.toLowerCase().includes(selectedJurisdiction.toLowerCase())
      ) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // Priority filter
      if (selectedPriority !== 'All' && item.priority !== selectedPriority) {
        return false;
      }

      // Search query
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesExam = item.exam?.toLowerCase().includes(query);
        const matchesJurisdiction = item.jurisdiction?.toLowerCase().includes(query);
        const matchesHook = item.marketingAction?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesExam && !matchesJurisdiction && !matchesHook) {
          return false;
        }
      }

      return true;
    });
  }, [allNotices, selectedJurisdiction, selectedCategory, selectedPriority, search]);

  // Copy Marketing Hook to Clipboard
  const handleCopyHook = (hash, text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedHash(hash);
      showToast('Marketing play copied to clipboard!');
      setTimeout(() => setCopiedHash(null), 2000);
    }
  };

  // Copy PDF Link
  const handleCopyPdfUrl = (hash, url) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedPdfHash(hash);
      showToast('Official PDF link copied to clipboard!');
      setTimeout(() => setCopiedPdfHash(null), 2000);
    }
  };

  // Optional manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('./notices.json?t=' + Date.now());
      if (res.ok) {
        const fresh = await res.json();
        setNoticesData(fresh);
        showToast('Radar synced with latest cloud circulars!');
      }
    } catch (e) {
      console.log('Refresh failed:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  return (
    <div className="app-container">
      {/* Top Clean Executive Header */}
      <header className="header-white">
        <div className="brand-section">
          <div className="brand-logo-badge">PW</div>
          <div>
            <div className="brand-title">
              Exam Intelligence Radar
              <span className="live-pulse">
                <span className="pulse-dot"></span>
                24/7 Live Sync
              </span>
            </div>
            <div className="brand-subtitle">
              Physics Wallah Official Circular Monitor • 6 State PSCs + Pan-India Judiciary
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            onClick={handleRefresh}
            className="btn-header"
            disabled={isRefreshing}
            title="Reload verified notices"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Radar'}</span>
          </button>

          <a
            href="https://t.me/pw_exam_updates_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-header telegram"
          >
            <Send size={14} />
            <span>Telegram Bot & Menu</span>
          </a>

          <a
            href="https://github.com/deep4nsh/pw-exam-intelligence"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-header"
          >
            <GitHubIcon size={14} />
            <span>GitHub Repository</span>
          </a>
        </div>
      </header>

      {/* Telegram Interactive Menu Callout */}
      <div className="telegram-callout">
        <div className="callout-left">
          <div className="callout-icon">
            <Send size={16} />
          </div>
          <div>
            <div className="callout-title">Interactive Telegram Menu Active for All Members</div>
            <div className="callout-desc">
              All team members can tap the 8-option inline menu in the Telegram group to trigger on-demand state circular syncs anytime.
            </div>
          </div>
        </div>
        <a
          href="https://t.me/pw_exam_updates_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="callout-btn"
        >
          <span>Open Bot Menu</span>
          <ExternalLink size={12} />
        </a>
      </div>

      {/* KPI Cards Row (White Theme) */}
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span>Verified Official Notices</span>
            <div className="metric-icon-box" style={{ background: '#eef2ff', color: '#4f46e5' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-sub">Across 7 official state commission portals</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Urgent Campaign Opportunities</span>
            <div className="metric-icon-box" style={{ background: '#fffbeb', color: '#d97706' }}>
              <Flame size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: '#d97706' }}>{metrics.urgent}</div>
          <div className="metric-sub">Admit cards, results & schedule revisions</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Commissions Covered</span>
            <div className="metric-icon-box" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <Building2 size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.commissions} Portals</div>
          <div className="metric-sub">BPSC, UPPSC, MPPSC, RPSC, OPSC, MPSC, Pan-India Judiciary</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Cloud Scraper Pipeline</span>
            <div className="metric-icon-box" style={{ background: '#f0f9ff', color: '#0284c7' }}>
              <Radio size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: '#16a34a', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pulse-dot"></span>
            Active 24/7
          </div>
          <div className="metric-sub">Automated cloud scan every 5 minutes (₹0 cost)</div>
        </div>
      </section>

      {/* Search & Filter Controls (White Card) */}
      <section className="controls-card">
        {/* Search Row & View Toggle */}
        <div className="search-row">
          <div className="search-bar-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search circulars, exams (e.g. 72nd CCE, Rajyaseva, OAS, Admit Card, Cutoff)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="search-clear-btn"
                onClick={() => setSearch('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="view-switcher">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Cards Grid View"
            >
              <LayoutGrid size={15} />
              <span>Grid</span>
            </button>
            <button
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Compact Table View"
            >
              <List size={15} />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* State / Jurisdiction Pills with Live Counts */}
        <div className="filter-group">
          <span className="filter-label">State / Portal:</span>
          {JURISDICTION_FILTERS.map((j) => (
            <button
              key={j}
              className={`filter-pill ${selectedJurisdiction === j ? 'active' : ''}`}
              onClick={() => setSelectedJurisdiction(j)}
            >
              <span>{j}</span>
              <span className="filter-pill-count">{countsByJurisdiction[j] || 0}</span>
            </button>
          ))}
        </div>

        {/* Category Pills */}
        <div className="filter-group">
          <span className="filter-label">Category:</span>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`filter-pill ${selectedCategory === c ? 'active' : ''}`}
              onClick={() => setSelectedCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Priority Filter */}
        <div className="filter-group">
          <span className="filter-label">Priority:</span>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              className={`filter-pill ${selectedPriority === p ? 'active' : ''}`}
              onClick={() => setSelectedPriority(p)}
            >
              {p === 'CRITICAL' ? '🚨 Critical' : p === 'HIGH' ? '⚠️ High' : p === 'NORMAL' ? '🟢 Normal' : 'All'}
            </button>
          ))}
        </div>
      </section>

      {/* Results Meta Bar */}
      <div className="results-meta">
        <div>
          Showing <span className="results-count">{filteredNotices.length}</span> of {allNotices.length} verified official circulars
        </div>
        {(selectedJurisdiction !== 'All' || selectedCategory !== 'All' || selectedPriority !== 'All' || search) && (
          <button
            onClick={() => {
              setSelectedJurisdiction('All');
              setSelectedCategory('All');
              setSelectedPriority('All');
              setSearch('');
            }}
            className="btn-reset-filters"
          >
            <X size={12} />
            <span>Reset All Filters</span>
          </button>
        )}
      </div>

      {/* Main Content: Grid vs Table View */}
      {filteredNotices.length > 0 ? (
        viewMode === 'grid' ? (
          <main className="cards-grid">
            {filteredNotices.map((item) => {
              const isCopied = copiedHash === item.hash;
              const isPdfCopied = copiedPdfHash === item.hash;
              const meta = getCommissionMeta(item.jurisdiction, item.state);
              const isUrgent = item.priority === 'CRITICAL' || item.priority === 'HIGH';

              const priorityBorderClass =
                item.priority === 'CRITICAL'
                  ? 'priority-critical-border'
                  : item.priority === 'HIGH'
                  ? 'priority-high-border'
                  : 'priority-normal-border';

              const priorityTagClass =
                item.priority === 'CRITICAL'
                  ? 'critical'
                  : item.priority === 'HIGH'
                  ? 'high'
                  : 'normal';

              return (
                <article key={item.hash} className={`notice-card ${priorityBorderClass}`}>
                  <div>
                    {/* Card Top: Commission Badge & Priority */}
                    <div className="card-top">
                      <div className="card-tags">
                        <span className={`tag-commission ${meta.cssClass}`}>
                          {meta.icon} {meta.name} • {meta.state}
                        </span>
                        <span className="tag-category">{item.category}</span>
                      </div>
                      <span className={`tag-priority ${priorityTagClass}`}>
                        {item.priority === 'CRITICAL' ? '🚨 Critical' : item.priority === 'HIGH' ? '⚠️ High' : '🟢 Normal'}
                      </span>
                    </div>

                    {/* Exam Name Sub-header */}
                    <div className="exam-subtitle">{item.exam}</div>

                    {/* Notice Headline */}
                    <h3 className="notice-headline">{item.title}</h3>

                    {/* Marketing Strategy Box */}
                    <div className={`hook-box-white ${isUrgent ? 'urgent' : ''}`}>
                      <div className="hook-header">
                        <span className="hook-title-label">
                          <Sparkles size={13} />
                          Marketing & Outreach Play
                        </span>
                        <button
                          className={`btn-copy-hook ${isCopied ? 'copied' : ''}`}
                          onClick={() => handleCopyHook(item.hash, item.marketingAction)}
                          title="Copy marketing play to clipboard"
                        >
                          {isCopied ? (
                            <>
                              <Check size={12} />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy Play</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="hook-text">"{item.marketingAction}"</p>
                    </div>
                  </div>

                  {/* Card Bottom: PDF Link & Verified Source */}
                  <div className="card-bottom">
                    <div className="card-actions-left">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-pdf-link primary"
                      >
                        <FileText size={13} />
                        <span>View Official PDF</span>
                        <ExternalLink size={12} />
                      </a>

                      <button
                        className="btn-copy-url"
                        onClick={() => handleCopyPdfUrl(item.hash, item.url)}
                        title="Copy official PDF URL"
                      >
                        {isPdfCopied ? <Check size={12} color="#16a34a" /> : <Share2 size={12} />}
                        <span>{isPdfCopied ? 'Copied URL' : 'Copy Link'}</span>
                      </button>
                    </div>

                    <span className="verified-pill">
                      <ShieldCheck size={11} />
                      <span>gov.in Verified</span>
                    </span>
                  </div>
                </article>
              );
            })}
          </main>
        ) : (
          /* Modern Compact Table View */
          <div className="table-container">
            <table className="notices-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>State / Commission</th>
                  <th>Notice Headline & Exam</th>
                  <th style={{ width: '130px' }}>Category</th>
                  <th style={{ width: '100px' }}>Priority</th>
                  <th>Marketing Action Play</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Official PDF</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotices.map((item) => {
                  const meta = getCommissionMeta(item.jurisdiction);
                  const isCopied = copiedHash === item.hash;

                  return (
                    <tr key={item.hash}>
                      <td>
                        <span className={`tag-commission ${meta.cssClass}`}>
                          {meta.icon} {meta.name}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {meta.state}
                        </div>
                      </td>
                      <td>
                        <div className="table-title">{item.title}</div>
                        <div className="table-exam">{item.exam}</div>
                      </td>
                      <td>
                        <span className="tag-category">{item.category}</span>
                      </td>
                      <td>
                        <span className={`tag-priority ${item.priority.toLowerCase()}`}>
                          {item.priority === 'CRITICAL' ? '🚨 Critical' : item.priority === 'HIGH' ? '⚠️ High' : '🟢 Normal'}
                        </span>
                      </td>
                      <td>
                        <div className="table-play">"{item.marketingAction}"</div>
                        <button
                          onClick={() => handleCopyHook(item.hash, item.marketingAction)}
                          style={{
                            fontSize: '11px',
                            color: isCopied ? '#16a34a' : 'var(--pw-brand)',
                            fontWeight: 700,
                            marginTop: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {isCopied ? <Check size={11} /> : <Copy size={11} />}
                          <span>{isCopied ? 'Copied' : 'Copy Play'}</span>
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-pdf-link"
                          style={{ padding: '5px 10px', fontSize: '11.5px' }}
                        >
                          <span>PDF</span>
                          <ExternalLink size={11} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="empty-state">
          <h3>No notices match your current filters</h3>
          <p>Try clearing your search query or switching the State / Category pills above.</p>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="floating-toast">
          <Check size={15} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="footer-bar">
        <div>
          Physics Wallah Exam Intelligence Network • Automated 24/7 via GitHub Actions
        </div>
        <div>
          Official Commissions: BPSC, UPPSC, MPPSC, RPSC, OPSC, MPSC & Pan-India High Courts (DJS, RJS, MP, UP & SCI).
        </div>
      </footer>
    </div>
  );
}
