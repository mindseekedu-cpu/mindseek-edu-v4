import React, { useCallback, useEffect, useMemo, useState } from 'react';

const AUTO_PILOT_ALLOWED_PACKAGES = ['smart_parent', 'smart_family'];
const AUTO_PILOT_COOLDOWN_DAYS = 7;

const styles = {
  wrapper: {
    display: 'grid',
    gap: '20px',
    marginTop: '20px',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
  },
  cardTitle: {
    margin: '0 0 14px 0',
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
  },
  mutedText: {
    margin: 0,
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: 1.6,
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: '12px',
    padding: '14px 16px',
    fontSize: '14px',
  },
  successBox: {
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#065f46',
    borderRadius: '12px',
    padding: '14px 16px',
    fontSize: '14px',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '760px',
  },
  th: {
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 700,
    color: '#374151',
    padding: '12px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  },
  td: {
    fontSize: '14px',
    color: '#111827',
    padding: '12px',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  topicList: {
    display: 'grid',
    gap: '10px',
    padding: 0,
    margin: 0,
    listStyle: 'none',
  },
  topicItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px 16px',
    background: '#fafafa',
  },
  topicTitle: {
    margin: '0 0 6px 0',
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
  },
  metaText: {
    margin: 0,
    color: '#4b5563',
    fontSize: '14px',
    lineHeight: 1.6,
  },
  consistencyRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '14px',
  },
  consistencyItem: {
    width: '72px',
    minHeight: '74px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
    padding: '8px',
  },
  consistencyIconActive: {
    color: '#15803d',
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '4px',
  },
  consistencyIconInactive: {
    color: '#b91c1c',
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '4px',
  },
  consistencyLabel: {
    fontSize: '12px',
    color: '#374151',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 700,
    background: '#eef2ff',
    color: '#4338ca',
  },
  buttonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '14px',
  },
  button: {
    border: 'none',
    borderRadius: '12px',
    background: '#111827',
    color: '#ffffff',
    padding: '12px 18px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};

function formatShortDate(value) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(value));
  } catch (error) {
    return String(value || '');
  }
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2)}%`;
}

// PRD 8.1: Tren hanya ▲/▼ tanpa angka
function formatTrendIcon(value) {
  const number = Number(value || 0);
  if (number > 0) return '▲';
  if (number < 0) return '▼';
  return '•'; // netral jika tidak berubah
}

function buildThirtyDayText(consistency30) {
  if (!Array.isArray(consistency30) || consistency30.length === 0) {
    return 'Belum ada data konsistensi 30 hari.';
  }

  const activeDays = consistency30.filter((item) => item.active).length;
  let longestStreak = 0;
  let currentStreak = 0;
  let running = 0;

  consistency30.forEach((item) => {
    if (item.active) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
    } else {
      running = 0;
    }
  });

  for (let index = consistency30.length - 1; index >= 0; index -= 1) {
    if (consistency30[index].active) currentStreak += 1;
    else break;
  }

  return `Aktif ${activeDays} dari 30 hari terakhir. Streak saat ini ${currentStreak} hari, streak terbaik ${longestStreak} hari.`;
}

function parseStoredPackage() {
  if (typeof window === 'undefined') {
    return null;
  }

  const keys = [
    'package',
    'packageType',
    'package_type',
    'plan',
    'planType',
    'plan_type',
    'subscription',
    'subscriptionPlan',
    'membership',
    'userPackage',
    'currentPackage',
    'activePackage',
  ];

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    const normalized = String(raw).trim().toLowerCase();
    if (normalized) return normalized;

    try {
      const parsed = JSON.parse(raw);
      const candidate = parsed?.package || parsed?.plan || parsed?.type || parsed?.code || parsed?.name;
      if (candidate) return String(candidate).trim().toLowerCase();
    } catch (error) {
      continue;
    }
  }

  return null;
}

function getCooldownKey(studentId) {
  return `parent-report:auto-pilot:last-run:${studentId}`;
}

function isWithinCooldown(studentId) {
  if (typeof window === 'undefined' || !studentId) {
    return false;
  }

  const lastRun = window.localStorage.getItem(getCooldownKey(studentId));
  if (!lastRun) return false;

  const lastRunDate = new Date(lastRun);
  if (Number.isNaN(lastRunDate.getTime())) return false;

  const diffInMs = Date.now() - lastRunDate.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  return diffInDays < AUTO_PILOT_COOLDOWN_DAYS;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.message || 'Gagal mengambil data';
    throw new Error(message);
  }

  return payload;
}

export default function ParentReport({ studentId }) {
  const [summary, setSummary] = useState([]);
  const [consistency7, setConsistency7] = useState([]);
  const [consistency30, setConsistency30] = useState([]);
  const [frequentTopics, setFrequentTopics] = useState([]);
  const [aiMiNotes, setAiMiNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoPilotLoading, setAutoPilotLoading] = useState(false);
  const [autoPilotMessage, setAutoPilotMessage] = useState('');
  const [autoPilotError, setAutoPilotError] = useState('');
  const [packageCode, setPackageCode] = useState(null);
  const [cooldownActive, setCooldownActive] = useState(false);

  const refreshEligibility = useCallback(() => {
    const detectedPackage = parseStoredPackage();
    setPackageCode(detectedPackage);
    setCooldownActive(isWithinCooldown(studentId));
  }, [studentId]);

  const loadReport = useCallback(async () => {
    if (!studentId) {
      setSummary([]);
      setConsistency7([]);
      setConsistency30([]);
      setFrequentTopics([]);
      setAiMiNotes([]);
      setLoading(false);
      setError('Pilih siswa terlebih dahulu untuk melihat laporan.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const query = `studentId=${encodeURIComponent(studentId)}`;
      const [summaryResponse, consistencyResponse, frequentResponse, aiMiResponse] = await Promise.all([
        fetchJson(`/api/parent/learning-summary?${query}`),
        fetchJson(`/api/parent/consistency?${query}`),
        fetchJson(`/api/parent/frequent-topics?${query}`),
        fetchJson(`/api/parent/catatan-ai-mi?${query}`),
      ]);

      setSummary(Array.isArray(summaryResponse?.data) ? summaryResponse.data : []);
      setConsistency7(Array.isArray(consistencyResponse?.data?.consistency7) ? consistencyResponse.data.consistency7 : []);
      setConsistency30(Array.isArray(consistencyResponse?.data?.consistency30) ? consistencyResponse.data.consistency30 : []);
      setFrequentTopics(Array.isArray(frequentResponse?.data) ? frequentResponse.data : []);
      setAiMiNotes(Array.isArray(aiMiResponse?.data) ? aiMiResponse.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat laporan parent');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    refreshEligibility();
  }, [refreshEligibility]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const packageAllowsAutoPilot = useMemo(() => {
    if (!packageCode) return false;
    return AUTO_PILOT_ALLOWED_PACKAGES.includes(packageCode);
  }, [packageCode]);

  const canShowAutoPilotButton = Boolean(studentId && packageAllowsAutoPilot && !cooldownActive);
  const thirtyDaySummaryText = useMemo(() => buildThirtyDayText(consistency30), [consistency30]);

  const handleAutoPilot = useCallback(async () => {
    if (!studentId || autoPilotLoading) {
      return;
    }

    setAutoPilotLoading(true);
    setAutoPilotError('');
    setAutoPilotMessage('');

    try {
      const payload = await fetchJson('/api/parent/auto-pilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      });

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(getCooldownKey(studentId), new Date().toISOString());
      }

      setCooldownActive(true);
      setAutoPilotMessage(payload?.message || 'Auto-Pilot berhasil dijalankan');
      await loadReport();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Gagal menjalankan Auto-Pilot';
      setAutoPilotError(message);
      if (message.toLowerCase().includes('7 hari')) {
        setCooldownActive(true);
      }
    } finally {
      setAutoPilotLoading(false);
    }
  }, [autoPilotLoading, loadReport, studentId]);

  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Laporan Belajar</h2>
          <p style={styles.mutedText}>Memuat data laporan siswa...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Learning Summary</h2>
        {summary.length === 0 ? (
          <p style={styles.mutedText}>Belum ada ringkasan belajar untuk 30 hari terakhir.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Topik</th>
                  <th style={styles.th}>Total Soal</th>
                  <th style={styles.th}>Mandiri</th>
                  <th style={styles.th}>Dibantu</th>
                  <th style={styles.th}>Perlu Dampingan</th>
                  <th style={styles.th}>Kemandirian</th>
                  <th style={styles.th}>Tren</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((item) => (
                  <tr key={item.topic}>
                    <td style={styles.td}>{item.topic}</td>
                    <td style={styles.td}>{item.total_questions}</td>
                    <td style={styles.td}>{item.mandiri}</td>
                    <td style={styles.td}>{item.dibantu}</td>
                    <td style={styles.td}>{item.perlu_dampingan}</td>
                    <td style={styles.td}>{formatPercent(item.kemandirian_percent)}</td>
                    <td style={styles.td}>{formatTrendIcon(item.tren)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Konsistensi Belajar</h2>
        {consistency7.length === 0 ? (
          <p style={styles.mutedText}>Belum ada data konsistensi 7 hari terakhir.</p>
        ) : (
          <div style={styles.consistencyRow}>
            {consistency7.map((item) => (
              <div key={item.date} style={styles.consistencyItem}>
                <div style={item.active ? styles.consistencyIconActive : styles.consistencyIconInactive}>
                  {item.active ? '✓' : '✕'}
                </div>
                <div style={styles.consistencyLabel}>{formatShortDate(item.date)}</div>
              </div>
            ))}
          </div>
        )}
        <p style={styles.mutedText}>{thirtyDaySummaryText}</p>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Topik Paling Sering Diulang</h2>
        {frequentTopics.length === 0 ? (
          <p style={styles.mutedText}>Belum ada data topik yang sering diulang.</p>
        ) : (
          <ul style={styles.topicList}>
            {frequentTopics.map((item) => (
              <li key={item.topic} style={styles.topicItem}>
                <h3 style={styles.topicTitle}>{item.topic}</h3>
                <p style={styles.metaText}>
                  Total soal: <strong>{item.total_questions}</strong> · Rata-rata kemandirian: <strong>{formatPercent(item.average_kemandirian)}</strong>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Catatan Ai Mi</h2>
        {aiMiNotes.length === 0 ? (
          <p style={styles.mutedText}>Belum ada catatan rekomendasi saat ini.</p>
        ) : (
          <ul style={styles.topicList}>
            {aiMiNotes.map((item) => (
              <li key={`${item.topic}-${item.kategori}`} style={styles.topicItem}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={styles.badge}>{item.kategori}</span>
                </div>
                <h3 style={styles.topicTitle}>{item.topic}</h3>
                <p style={styles.metaText}>
                  Penguasaan: <strong>{formatPercent(item.penguasaan_percent)}</strong> · Kemandirian: <strong>{formatPercent(item.kemandirian_percent)}</strong> · Total soal: <strong>{item.total_questions}</strong>
                </p>
                <p style={{ ...styles.metaText, marginTop: '8px' }}>{item.recommendation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Auto-Pilot</h2>
        <p style={styles.mutedText}>
          Auto-Pilot akan membuat remedial task otomatis berdasarkan performa terbaru siswa. Fitur ini tersedia untuk paket <strong>smart_parent</strong> dan <strong>smart_family</strong> dengan batas penggunaan maksimal 1 kali dalam 7 hari.
        </p>

        {!packageCode ? (
          <p style={{ ...styles.mutedText, marginTop: '10px' }}>
            Paket aktif belum terdeteksi dari localStorage. Pastikan informasi paket parent sudah disimpan di browser agar tombol Auto-Pilot dapat ditampilkan sesuai hak akses.
          </p>
        ) : null}

        {packageCode && !packageAllowsAutoPilot ? (
          <p style={{ ...styles.mutedText, marginTop: '10px' }}>
            Paket aktif saat ini <strong>{packageCode}</strong> belum mendukung Auto-Pilot.
          </p>
        ) : null}

        {packageAllowsAutoPilot && cooldownActive ? (
          <p style={{ ...styles.mutedText, marginTop: '10px' }}>
            Auto-Pilot sudah digunakan dalam 7 hari terakhir. Tombol akan muncul lagi setelah masa tunggu selesai.
          </p>
        ) : null}

        {canShowAutoPilotButton ? (
          <div style={styles.buttonRow}>
            <button
              type="button"
              onClick={handleAutoPilot}
              style={{
                ...styles.button,
                ...(autoPilotLoading ? styles.buttonDisabled : {}),
              }}
              disabled={autoPilotLoading}
            >
              {autoPilotLoading ? 'Menjalankan Auto-Pilot...' : 'Jalankan Auto-Pilot'}
            </button>
          </div>
        ) : null}

        {autoPilotMessage ? <div style={{ ...styles.successBox, marginTop: '14px' }}>{autoPilotMessage}</div> : null}
        {autoPilotError ? <div style={{ ...styles.errorBox, marginTop: '14px' }}>{autoPilotError}</div> : null}
      </section>
    </div>
  );
}
