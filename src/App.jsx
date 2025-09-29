import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

function App() {
    // Semua state dan fungsi (useState, useEffect, handle..., filteredLeads)
    // tetap sama persis seperti versi sebelumnya.
    const [queries, setQueries] = useState('coffee shop di Jakarta Barat\nrestoran baru di Jakarta utara\nbarbershop di bogor');
    const [log, setLog] = useState('Menunggu perintah...');
    const [isScraping, setIsScraping] = useState(false);
    const [leads, setLeads] = useState([]);
    const [selectedLead, setSelectedLead] = useState(null);
    const [stats, setStats] = useState({ total: 0, emails: 0, websites: 0 });
    const [showOnlyNew, setShowOnlyNew] = useState(false);
    const [exportMessage, setExportMessage] = useState('');
    const NEW_BUSINESS_THRESHOLD = 20;

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
            window.electronAPI.exportToCSV(leads);
            setExportMessage('✅ Berhasil diekspor!');
            setTimeout(() => setExportMessage(''), 3000);
        }
    };
    
    const filteredLeads = useMemo(() => {
        if (!showOnlyNew) return leads;
        return leads.filter(lead => lead.jumlah_ulasan < NEW_BUSINESS_THRESHOLD);
    }, [leads, showOnlyNew]);

    return (
        <div className="app-container">
            {/* PANEL 1: COMMAND CENTER */}
            <div className="panel command-center">
                <div className="panel-header">
                    <h1 className="title">LEAD-X</h1>
                </div>
                <div className="panel-content">
                    <label className="input-label">TARGETS</label>
                    <textarea value={queries} onChange={e => setQueries(e.target.value)} rows="8" placeholder="Masukkan target per baris..." disabled={isScraping} />
                    
                    {!isScraping ? (
                        <button onClick={handleStartScraping} className="scan-button">
                            🚀 LAUNCH SCAN
                        </button>
                    ) : (
                        <button onClick={handleStopScraping} className="scan-button stop-button">
                            🛑 STOP SCAN
                        </button>
                    )}

                    <div className="stats-container">
                        <h3>SESSION STATS</h3>
                        <div className="stats-grid">
                            <div className="stat-item"><span>{stats.total}</span> PROSPEK</div>
                            <div className="stat-item"><span>{stats.websites}</span> WEBSITE</div>
                            <div className="stat-item"><span>{stats.emails}</span> EMAIL</div>
                        </div>
                    </div>
                    <div className="log-console">
                        <h3>LIVE LOG</h3>
                        <div className="log-content">{log}</div>
                    </div>
                </div>
            </div>
            
            {/* PANEL 2: LIVE DATA GRID */}
            <div className="panel data-grid">
                <div className="table-toolbar">
                    <button onClick={handleExport} disabled={leads.length === 0} className="export-button">
                        <svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path clipRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" fillRule="evenodd"></path></svg>
                        EKSPOR KE CSV
                    </button>
                    <div className="export-feedback">{exportMessage}</div>
                    <div className="filter-toggle">
                        <label htmlFor="new-filter">🔥 HANYA PROSPEK BARU</label>
                        <input type="checkbox" id="new-filter" checked={showOnlyNew} onChange={() => setShowOnlyNew(!showOnlyNew)} />
                    </div>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            {/* PERUBAHAN UTAMA: Header tabel sekarang punya 5 kolom */}
                            <tr>
                                <th>STATUS</th>
                                <th>NAMA BISNIS</th>
                                <th>WEBSITE</th>
                                <th>EMAIL</th>
                                <th>TELEPON</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ... (logika pesan tabel tetap sama) ... */}
                             {isScraping && filteredLeads.length === 0 && (
                                <tr><td colSpan="5" className="table-message">/ Memindai data...</td></tr>
                            )}
                            {!isScraping && leads.length === 0 && (
                                <tr><td colSpan="5" className="table-message">/ Tidak ada data. Mulai scan.</td></tr>
                            )}
                             {!isScraping && leads.length > 0 && filteredLeads.length === 0 && (
                                <tr><td colSpan="5" className="table-message">/ Tidak ada "Prospek Baru" yang cocok.</td></tr>
                            )}
                            {filteredLeads.map((lead, index) => (
                                <tr key={index} onClick={() => setSelectedLead(lead)} className={selectedLead === lead ? 'selected' : ''}>
                                    <td>{lead.jumlah_ulasan < NEW_BUSINESS_THRESHOLD ? <span className="new-badge">BARU</span> : '-'}</td>
                                    <td>{lead.nama}</td>
                                    {/* PERUBAHAN UTAMA: Tambahkan kolom Website */}
                                    <td className="website-cell">
                                        <a href={lead.website} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer">
                                            {lead.website === 'Tidak Ada' ? '-' : 'Kunjungi'}
                                        </a>
                                    </td>
                                    {/* PERUBAHAN UTAMA: Tambahkan kolom Email */}
                                    <td className="email-cell">{lead.email}</td>
                                    <td>{lead.telepon}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PANEL 3: PROSPECT DOSSIER */}
            <div className={`panel prospect-dossier ${selectedLead ? 'open' : ''}`}>
                 {selectedLead ? (
                    <>
                        <button className="close-button" onClick={() => setSelectedLead(null)}>×</button>
                        <h2 className="dossier-title">{selectedLead.nama}</h2>
                        <div className="dossier-item"><strong>STATUS</strong><p>{selectedLead.jumlah_ulasan < NEW_BUSINESS_THRESHOLD ? "Prospek Baru (Ulasan Rendah)" : "Prospek Umum"}</p></div>
                        <div className="dossier-item"><strong>JUMLAH ULASAN</strong><p>{selectedLead.jumlah_ulasan}</p></div>
                        <div className="dossier-item"><strong>ALAMAT</strong><p>{selectedLead.alamat}</p></div>
                        <div className="dossier-item"><strong>TELEPON</strong><p>{selectedLead.telepon}</p></div>
                        <div className="dossier-item"><strong>WEBSITE</strong><a href={selectedLead.website} target="_blank" rel="noreferrer">{selectedLead.website}</a></div>
                        <div className="dossier-item"><strong>EMAIL</strong><p>{selectedLead.email}</p></div>
                        <div className="dossier-item"><strong>CATATAN</strong><textarea placeholder="Tambahkan catatan tentang prospek ini..."></textarea></div>
                    </>
                ) : (
                    <div className="dossier-placeholder"><p>// Pilih sebuah prospek dari tabel untuk melihat detailnya.</p></div>
                )}
            </div>
        </div>
    );
}
export default App;