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
  Table,
  Building2,
  AlertTriangle,
  Flame,
  Radio,
  FileText,
  Sparkles
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

const JURISDICTIONS = [
  'All',
  'BPSC',
  'UPPSC',
  'MPSC',
  'MPPSC',
  'OPSC',
  'RPSC',
  'Allahabad High Court'
];

const CATEGORIES = [
  'All',
  'Notification / Recruitment',
  'Admit Card',
  'Result',
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
  const [copiedHash, setCopiedHash] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedText, setLastSyncedText] = useState('Live');

  const allNotices = noticesData?.notices || [];

  // Metrics
  const metrics = useMemo(() => {
    const total = allNotices.length;
    const critical = allNotices.filter((n) => n.priority === 'CRITICAL').length;
    const high = allNotices.filter((n) => n.priority === 'HIGH').length;
    const urgent = critical + high;
    const commissions = new Set(allNotices.map((n) => n.jurisdiction)).size;
    return { total, urgent, critical, commissions };
  }, [allNotices]);

  // Filtering
  const filteredNotices = useMemo(() => {
    return allNotices.filter((item) => {
      // Jurisdiction filter
      if (
        selectedJurisdiction !== 'All' &&
        !item.jurisdiction.toLowerCase().includes(selectedJurisdiction.toLowerCase())
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
      setTimeout(() => setCopiedHash(null), 2000);
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
        setLastSyncedText('Just now');
      }
    } catch (e) {
      console.log('Refresh failed:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  return (
    <div className="app-container">
      {/* Top Executive Header */}
      <header className="header-glass">
        <div className="brand-section">
          <div className="brand-logo-badge">PW</div>
          <div>
            <div className="brand-title">
              Exam Intelligence Radar
              <span className="live-pulse">
                <span className="pulse-dot"></span>
                24/7 Live
              </span>
            </div>
            <div className="brand-subtitle">
              Physics Wallah Real-Time Circular Monitor • 6 State PSCs + Judiciary
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
            className="btn-header"
          >
            <Bell size={14} />
            <span>Telegram Bot</span>
          </a>

          <a
            href="https://github.com/deep4nsh/pw-exam-intelligence"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-header primary"
          >
            <GitHubIcon size={14} />
            <span>GitHub Repository</span>
          </a>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span>Verified Official Notices</span>
            <div className="metric-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-sub">Across active commissions</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Urgent Campaign Opportunities</span>
            <div className="metric-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Flame size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: '#fbbf24' }}>{metrics.urgent}</div>
          <div className="metric-sub">Admit cards, results & schedules</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Commissions Covered</span>
            <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <Building2 size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.commissions} Portals</div>
          <div className="metric-sub">BPSC, UPPSC, MPSC, MPPSC, OPSC, RPSC, HC</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Scraper Pipeline Status</span>
            <div className="metric-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <Radio size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: '#34d399', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pulse-dot" style={{ display: 'inline-block' }}></span>
            Active 24/7
          </div>
          <div className="metric-sub">Runs every 20 mins via GitHub Actions</div>
        </div>
      </section>

      {/* Search & Filter Controls */}
      <section className="controls-section">
        {/* Search Bar */}
        <div className="search-bar-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by exam name, keywords (e.g., OAS, Rajyaseva, 72nd CCE, Admit Card, Cutoff)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* State / Jurisdiction Pills */}
        <div className="filter-group">
          <span className="filter-label">State / Body:</span>
          {JURISDICTIONS.map((j) => (
            <button
              key={j}
              className={`filter-pill ${selectedJurisdiction === j ? 'active' : ''}`}
              onClick={() => setSelectedJurisdiction(j)}
            >
              {j}
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
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* Results Header */}
      <div className="results-meta">
        <div>
          Showing <span className="results-count">{filteredNotices.length}</span> of {allNotices.length} verified circulars
        </div>
        {(selectedJurisdiction !== 'All' || selectedCategory !== 'All' || selectedPriority !== 'All' || search) && (
          <button
            onClick={() => {
              setSelectedJurisdiction('All');
              setSelectedCategory('All');
              setSelectedPriority('All');
              setSearch('');
            }}
            style={{ color: '#818cf8', fontSize: '13px', fontWeight: 600, textDecoration: 'underline' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Notices Grid */}
      {filteredNotices.length > 0 ? (
        <main className="cards-grid">
          {filteredNotices.map((item) => {
            const isCopied = copiedHash === item.hash;
            const priorityClass =
              item.priority === 'CRITICAL'
                ? 'priority-critical'
                : item.priority === 'HIGH'
                ? 'priority-high'
                : 'priority-normal';

            return (
              <article key={item.hash} className="notice-card">
                <div>
                  <div className="card-top">
                    <div className="card-tags">
                      <span className="tag-jurisdiction">{item.jurisdiction}</span>
                      <span className="tag-category">{item.category}</span>
                    </div>
                    <span className={`tag-priority ${priorityClass}`}>{item.priority}</span>
                  </div>

                  <div className="exam-title">{item.exam}</div>
                  <h3 className="notice-headline">{item.title}</h3>

                  {/* Marketing Hook Box */}
                  <div className="hook-box">
                    <div className="hook-header">
                      <span className="hook-title-label">
                        <Sparkles size={13} />
                        Suggested Marketing Play
                      </span>
                      <button
                        className={`btn-copy-hook ${isCopied ? 'copied' : ''}`}
                        onClick={() => handleCopyHook(item.hash, item.marketingAction)}
                        title="Copy marketing play to clipboard"
                      >
                        {isCopied ? (
                          <>
                            <Check size={12} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy Hook</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="hook-text">"{item.marketingAction}"</p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="card-bottom">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-pdf-link"
                  >
                    <span>View Official Circular / PDF</span>
                    <ExternalLink size={13} />
                  </a>
                  <span className="card-hash" title="SHA-256 Hash">
                    #{item.hash?.slice(0, 8)}
                  </span>
                </div>
              </article>
            );
          })}
        </main>
      ) : (
        <div className="empty-state">
          <h3>No notices match your current filters</h3>
          <p>Try clearing your search keyword or switching the State / Category pills.</p>
        </div>
      )}

      {/* Footer */}
      <footer className="footer-bar">
        <div>
          Physics Wallah Exam Intelligence Network • Automated 24/7 via GitHub Actions
        </div>
        <div>
          Real-time alerts connected to Telegram (@pw_exam_updates_bot), Google Sheets & Email Digests.
        </div>
      </footer>
    </div>
  );
}
