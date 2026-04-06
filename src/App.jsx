import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import './App.css';
import logo from './assets/logo.png';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// --- Icons ---
const ScraperIcon = () => <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M16.9 11.2c.4-.4.4-1 0-1.4l-2.1-2.1c-.4-.4-1-.4-1.4 0L3 18.1V21h2.9l11-10.9zm2.1-2.1L17 7l-2-2l2-2c1.2-1.2 3.1-1.2 4.2 0s1.2 3.1 0 4.2zM2 22h20v-2H2v2z"/></svg>;
const AnalyticsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M4 21h16V7H4v14zM16 3H8c-1.1 0-2 .9-2 2v2H4V3c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v2h-2V5c0-1.1-.9-2-2-2zM4 11h8v2H4v-2zm0 4h5v2H4v-2zm10-4h2v6h-2v-6z"/></svg>;
const MenuIcon = () => <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"/></svg>;
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>;

// --- Resizable Hook ---
function useResize(initialWidth, minWidth, maxWidth, direction = 'right') {
  const [width, setWidth] = useState(initialWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      const delta = direction === 'right'
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      setWidth(newWidth);
    };
    const onMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [direction, minWidth, maxWidth]);

  return [width, onMouseDown];
}

// --- Sidebar ---
function Sidebar({ activeView, onNavigate, isCollapsed, onToggle }) {
  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && (
          <div className="sidebar-brand">
            <img src={logo} alt="LEAD-X" className="sidebar-logo" />
            <span className="sidebar-title">LEAD-X</span>
          </div>
        )}
        <button className="icon-btn" onClick={onToggle} title="Toggle Sidebar">
          <MenuIcon />
        </button>
      </div>
      <nav className="sidebar-nav">
        <button onClick={() => onNavigate('scraper')} className={activeView === 'scraper' ? 'active' : ''} title="Scraper">
          <ScraperIcon />
          {!isCollapsed && <span>Scraper</span>}
        </button>
        <button onClick={() => onNavigate('analytics')} className={activeView === 'analytics' ? 'active' : ''} title="Analytics">
          <AnalyticsIcon />
          {!isCollapsed && <span>Analytics</span>}
        </button>
      </nav>
    </div>
  );
}

// --- Main App ---
function App() {
  const [activeView, setActiveView] = useState('scraper');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [queries, setQueries] = useState('coffee shop di Jakarta Selatan\nrestoran baru di Bekasi\nbarbershop di Depok');
  const [log, setLog] = useState('Menunggu perintah...');
  const [isScraping, setIsScraping] = useState(false);
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stats, setStats] = useState({ total: 0, emails: 0, websites: 0 });
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const NEW_BUSINESS_THRESHOLD = 20;

  // Resizable panels
  const [leftWidth, onLeftDragStart] = useResize(300, 220, 480, 'right');
  const [rightWidth, onRightDragStart] = useResize(360, 260, 520, 'left');

  useEffect(() => {
    window.electronAPI.onScraperUpdate((data) => {
      if (data.type === 'status') {
        setLog(data.payload);
        if (['Semua pekerjaan selesai!', 'Proses dihentikan.'].includes(data.payload)) {
          setIsScraping(false);
        }
      } else if (data.type === 'data') {
        const newLead = data.payload;
        setLeads(prev => [...prev, newLead]);
        setStats(prev => ({
          total: prev.total + 1,
          emails: newLead.email && newLead.email !== 'N/A' && newLead.email !== 'Gagal Diakses' && newLead.email !== 'Timeout' ? prev.emails + 1 : prev.emails,
          websites: newLead.website !== 'Tidak Ada' ? prev.websites + 1 : prev.websites,
        }));
      } else if (data.type === 'error') {
        setLog(`ERROR: ${data.payload}`);
        setIsScraping(false);
      }
    });
  }, []);

  const handleStartScraping = () => {
    setIsScraping(true);
    setLeads([]);
    setSelectedLead(null);
    setStats({ total: 0, emails: 0, websites: 0 });
    const queryArray = queries.split('\n').filter(q => q.trim() !== '');
    window.electronAPI.startScraping(queryArray);
  };

  const handleStopScraping = () => {
    setIsScraping(false);
    window.electronAPI.stopScraping();
    setLog('Meminta untuk berhenti...');
  };

  const handleExport = () => {
    if (leads.length > 0) {
      window.electronAPI.exportToExcel(leads);
      setExportMessage('✅ Berhasil Ekspor!');
      setTimeout(() => setExportMessage(''), 3000);
    }
  };

  const handleUpdatePhone = (newPhone) => {
    if (!selectedLead) return;
    const updatedLead = { ...selectedLead, telepon: newPhone };
    setSelectedLead(updatedLead);
    setLeads(prev => prev.map(l =>
      (l.nama === selectedLead.nama && l.alamat === selectedLead.alamat) ? updatedLead : l
    ));
  };

  const handleChatWhatsApp = (phone) => {
    if (!phone || phone === 'Tidak Ada') return;
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    const url = `https://web.whatsapp.com/send?phone=${cleaned}&text=Halo%20${encodeURIComponent(selectedLead?.nama || '')},%20saya%20menemukan%20bisnis%20Anda%20dan%20ingin%20menghubungi%20Anda.`;
    if (window.electronAPI?.openWAFirefox) {
      window.electronAPI.openWAFirefox(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const filteredLeads = useMemo(() => {
    if (!showOnlyNew) return leads;
    return leads.filter(lead => lead.jumlah_ulasan < NEW_BUSINESS_THRESHOLD);
  }, [leads, showOnlyNew]);

  const chartData = useMemo(() => {
    if (leads.length === 0) return null;
    const websiteCount = leads.filter(l => l.website !== 'Tidak Ada').length;
    const pieData = {
      labels: ['Punya Website', 'Tidak Punya'],
      datasets: [{ data: [websiteCount, leads.length - websiteCount], backgroundColor: ['#6366f1', '#a855f7'], borderColor: '#09090b', borderWidth: 2 }],
    };
    const byQuery = leads.reduce((acc, l) => { acc[l.sumber_pencarian] = (acc[l.sumber_pencarian] || 0) + 1; return acc; }, {});
    const barData = {
      labels: Object.keys(byQuery),
      datasets: [{ label: 'Prospek per Kueri', data: Object.values(byQuery), backgroundColor: '#6366f1', borderRadius: 6 }],
    };
    return { pieData, barData };
  }, [leads]);

  const chartOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#a1a1aa', font: { family: 'Inter', size: 13 } } } },
    scales: { x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } } }
  };

  return (
    <div className="app-root">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="main-content">
        {activeView === 'scraper' && (
          <>
            {/* LEFT PANEL - Command Center */}
            <div className="panel left-panel" style={{ width: leftWidth }}>
              <div className="panel-inner">
                <div className="section-label">TARGETS</div>
                <textarea
                  value={queries}
                  onChange={e => setQueries(e.target.value)}
                  placeholder="Masukkan target per baris..."
                  disabled={isScraping}
                  className="target-textarea"
                />
                {!isScraping ? (
                  <button onClick={handleStartScraping} className="btn btn-primary">
                    🚀 LAUNCH SCAN
                  </button>
                ) : (
                  <button onClick={handleStopScraping} className="btn btn-danger">
                    🛑 STOP SCAN
                  </button>
                )}

                <div className="stats-block">
                  <div className="section-label">SESSION STATS</div>
                  <div className="stats-row">
                    <div className="stat-card">
                      <span className="stat-num">{stats.total}</span>
                      <span className="stat-lbl">PROSPEK</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-num">{stats.websites}</span>
                      <span className="stat-lbl">WEBSITE</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-num">{stats.emails}</span>
                      <span className="stat-lbl">EMAIL</span>
                    </div>
                  </div>
                </div>

                <div className="log-block">
                  <div className="section-label">LIVE LOG</div>
                  <div className="log-body">{log}</div>
                </div>
              </div>
            </div>

            {/* LEFT RESIZE HANDLE */}
            <div className="resize-handle" onMouseDown={onLeftDragStart} />

            {/* CENTER PANEL - Data Grid */}
            <div className="panel center-panel">
              <div className="toolbar">
                <button onClick={handleExport} disabled={leads.length === 0} className="btn btn-secondary">
                  📊 EKSPOR KE EXCEL
                </button>
                {exportMessage && <span className="export-msg">{exportMessage}</span>}
                <div className="filter-group">
                  <label htmlFor="new-filter" className="filter-label">🔥 HANYA PROSPEK BARU</label>
                  <input
                    type="checkbox"
                    id="new-filter"
                    checked={showOnlyNew}
                    onChange={() => setShowOnlyNew(!showOnlyNew)}
                  />
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>STATUS</th>
                      <th>NAMA BISNIS</th>
                      <th style={{ width: 100 }}>WEBSITE</th>
                      <th>EMAIL</th>
                      <th>TELEPON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isScraping && filteredLeads.length === 0 && (
                      <tr><td colSpan="5" className="td-empty">⟳ Memindai data...</td></tr>
                    )}
                    {!isScraping && leads.length === 0 && (
                      <tr><td colSpan="5" className="td-empty">Belum ada data. Jalankan scan terlebih dahulu.</td></tr>
                    )}
                    {!isScraping && leads.length > 0 && filteredLeads.length === 0 && (
                      <tr><td colSpan="5" className="td-empty">Tidak ada "Prospek Baru" yang cocok.</td></tr>
                    )}
                    {filteredLeads.map((lead, index) => (
                      <tr
                        key={index}
                        onClick={() => setSelectedLead(lead)}
                        className={selectedLead === lead ? 'row-selected' : ''}
                      >
                        <td>
                          {lead.jumlah_ulasan < NEW_BUSINESS_THRESHOLD
                            ? <span className="badge-new">BARU</span>
                            : <span className="badge-none">—</span>}
                        </td>
                        <td className="td-name">{lead.nama}</td>
                        <td>
                          {lead.website !== 'Tidak Ada'
                            ? <a href={lead.website} onClick={e => e.stopPropagation()} target="_blank" rel="noreferrer" className="link-visit">Kunjungi</a>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td className="td-ellipsis">{lead.email}</td>
                        <td className="td-ellipsis">{lead.telepon}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT RESIZE HANDLE */}
            {selectedLead && (
              <div className="resize-handle" onMouseDown={onRightDragStart} />
            )}

            {/* RIGHT PANEL - Dossier */}
            {selectedLead && (
              <div className="panel right-panel" style={{ width: rightWidth }}>
                <div className="panel-inner">
                  <div className="dossier-header">
                    <h2 className="dossier-name">{selectedLead.nama}</h2>
                    <button className="icon-btn" onClick={() => setSelectedLead(null)}>
                      <CloseIcon />
                    </button>
                  </div>

                  <div className="dossier-card">
                    <div className="section-label">TEKNOLOGI</div>
                    <p className="text-tech">{selectedLead.tech_stack || 'N/A'}</p>
                  </div>

                  <div className="dossier-card">
                    <div className="section-label">MEDIA SOSIAL</div>
                    <div className="social-row">
                      {selectedLead.social_media?.instagram &&
                        <a href={selectedLead.social_media.instagram} target="_blank" rel="noreferrer" className="social-chip">Instagram</a>}
                      {selectedLead.social_media?.facebook &&
                        <a href={selectedLead.social_media.facebook} target="_blank" rel="noreferrer" className="social-chip">Facebook</a>}
                      {selectedLead.social_media?.linkedin &&
                        <a href={selectedLead.social_media.linkedin} target="_blank" rel="noreferrer" className="social-chip">LinkedIn</a>}
                      {(!selectedLead.social_media || Object.keys(selectedLead.social_media).length === 0) &&
                        <span className="text-muted">N/A</span>}
                    </div>
                  </div>

                  <div className="dossier-card">
                    <div className="section-label">ALAMAT</div>
                    <p className="text-body">{selectedLead.alamat}</p>
                  </div>

                  <div className="dossier-card">
                    <div className="section-label">TELEPON (WHATSAPP)</div>
                    <div className="phone-row">
                      <input
                        type="text"
                        value={selectedLead.telepon || ''}
                        onChange={e => handleUpdatePhone(e.target.value)}
                        className="phone-input"
                        placeholder="Nomor WA (contoh: 0812...)"
                      />
                      <button onClick={() => handleChatWhatsApp(selectedLead.telepon)} className="btn btn-wa">
                        💬 Chat WA
                      </button>
                    </div>
                  </div>

                  <div className="dossier-card">
                    <div className="section-label">EMAIL</div>
                    <p className="text-body">{selectedLead.email}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeView === 'analytics' && (
          <div className="analytics-view">
            {!chartData ? (
              <div className="empty-state">
                <h2>Analytics Dashboard</h2>
                <p>Belum ada data. Jalankan scraper terlebih dahulu.</p>
              </div>
            ) : (
              <>
                <h1 className="analytics-title">Analytics Dashboard</h1>
                <div className="charts-grid">
                  <div className="chart-card">
                    <h3>Prospek Berdasarkan Website</h3>
                    <div className="chart-inner"><Pie data={chartData.pieData} options={chartOptions} /></div>
                  </div>
                  <div className="chart-card">
                    <h3>Prospek Berdasarkan Sumber</h3>
                    <div className="chart-inner"><Bar data={chartData.barData} options={chartOptions} /></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;