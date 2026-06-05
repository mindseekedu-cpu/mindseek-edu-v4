import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().split('T')[0];
}

function getStatusBadge(status) {
  if (status === 'mandiri') return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Mandiri</span>;
  if (status === 'dibantu') return <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">Dibantu</span>;
  if (status === 'perlu_dampingan') return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Perlu Dampingan</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800">-</span>;
}

export default function DaftarSoalPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State untuk tab
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'all', 'discussed'

  // State untuk data
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [loadingData, setLoadingData] = useState(false);

  // State untuk filter
  const [topikList, setTopikList] = useState([]);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    topic: '',
    level: '',
  });

  // State untuk edit modal
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ expectedAnswer: '', teachingSteps: '' });
  const [editingLoading, setEditingLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Load daftar siswa parent
  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        const res = await fetch('/api/parent/dashboard', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'Gagal memuat siswa');
        setStudents(json.students || []);
        if (json.students?.length > 0 && !studentId) {
          setStudentId(json.students[0].id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, []);

  // Load topik list untuk filter
  useEffect(() => {
    if (!studentId) return;
    async function loadTopikList() {
      try {
        const res = await fetch(`/api/parent/topik-list?studentId=${studentId}`, { credentials: 'include' });
        const json = await res.json();
        if (res.ok && json.success) {
          setTopikList(json.data || []);
        }
      } catch (err) {
        console.error('Gagal load topik list:', err);
      }
    }
    loadTopikList();
  }, [studentId]);

  // Load data berdasarkan tab, filter, pagination
  const loadData = useCallback(async () => {
    if (!studentId) return;
    setLoadingData(true);
    setError('');
    try {
      const params = new URLSearchParams({
        studentId,
        tab: activeTab,
        page: pagination.page,
        limit: pagination.limit,
      });
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.topic) params.append('topic', filters.topic);
      if (filters.level) params.append('level', filters.level);

      const res = await fetch(`/api/parent/daftar-soal?${params.toString()}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Gagal memuat data');
      setData(json.data || []);
      setPagination(prev => ({
        ...prev,
        total: json.pagination?.total || 0,
        total_pages: json.pagination?.total_pages || 0,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  }, [studentId, activeTab, pagination.page, pagination.limit, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // reset ke halaman 1 saat filter berubah
  };

  const resetFilters = () => {
    setFilters({ start_date: '', end_date: '', topic: '', level: '' });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Edit kunci jawaban & langkah ajar
  const openEditModal = (item) => {
    setEditingItem(item);
    setEditForm({
      expectedAnswer: item.expected_answer || '',
      teachingSteps: item.teaching_steps || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    if (!editingItem) return;
    setEditingLoading(true);
    try {
      const res = await fetch('/api/parent/edit-kunci-jawaban', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guidanceQuestionId: editingItem.id,
          expectedAnswer: editForm.expectedAnswer,
          teachingSteps: editForm.teachingSteps,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Gagal menyimpan');
      setShowEditModal(false);
      setEditingItem(null);
      loadData(); // reload
    } catch (err) {
      alert(err.message);
    } finally {
      setEditingLoading(false);
    }
  };

  // Tandai selesai diskusi (hanya untuk tab pending)
  const handleMarkDiscussed = async (guidanceQuestionId) => {
    if (!confirm('Tandai soal ini sudah didiskusikan? Soal akan pindah ke tab "Sudah Didiskusikan".')) return;
    try {
      const res = await fetch('/api/parent/discuss-guidance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ guidanceQuestionId, isDiscussed: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Gagal update status');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Render tabel berdasarkan tab
  const renderTable = () => {
    if (loadingData) return <div className="p-4 text-center text-gray-500">Memuat data...</div>;
    if (data.length === 0) return <div className="p-4 text-center text-gray-500">Tidak ada data.</div>;

    if (activeTab === 'all') {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b px-4 py-2 text-left">Tanggal</th>
                <th className="border-b px-4 py-2 text-left">Topik</th>
                <th className="border-b px-4 py-2 text-left">Mode</th>
                <th className="border-b px-4 py-2 text-left">Soal</th>
                <th className="border-b px-4 py-2 text-left">Status</th>
                <th className="border-b px-4 py-2 text-left">XP</th>
                <th className="border-b px-4 py-2 text-left">Clue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="border-b px-4 py-2 text-gray-600">{formatDate(item.tanggal)}</td>
                  <td className="border-b px-4 py-2">{item.topik}</td>
                  <td className="border-b px-4 py-2">{item.mode}</td>
                  <td className="border-b px-4 py-2 max-w-md truncate" title={item.soal}>{item.soal}</td>
                  <td className="border-b px-4 py-2">{getStatusBadge(item.status)}</td>
                  <td className="border-b px-4 py-2">{item.xp ?? '-'}</td>
                  <td className="border-b px-4 py-2">{item.clue_used ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Tab pending dan discussed (guidance_questions)
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="border-b px-4 py-2 text-left">Tanggal</th>
              <th className="border-b px-4 py-2 text-left">Topik</th>
              <th className="border-b px-4 py-2 text-left">Mode</th>
              <th className="border-b px-4 py-2 text-left">Soal</th>
              <th className="border-b px-4 py-2 text-left">Kunci Jawaban</th>
              <th className="border-b px-4 py-2 text-left">Langkah Ajar</th>
              <th className="border-b px-4 py-2 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="border-b px-4 py-2 text-gray-600">{formatDate(item.created_at)}</td>
                <td className="border-b px-4 py-2">{item.question_log?.learning_sessions?.topic || '-'}</td>
                <td className="border-b px-4 py-2">{item.question_log?.learning_sessions?.mode || '-'}</td>
                <td className="border-b px-4 py-2 max-w-md truncate" title={item.question_log?.question_text}>
                  {item.question_log?.question_text || '-'}
                </td>
                <td className="border-b px-4 py-2 max-w-xs">
                  <div className="whitespace-pre-wrap text-xs bg-gray-50 p-1 rounded">
                    {item.expected_answer || '-'}
                  </div>
                </td>
                <td className="border-b px-4 py-2 max-w-xs">
                  <div className="whitespace-pre-wrap text-xs bg-gray-50 p-1 rounded">
                    {item.teaching_steps || '-'}
                  </div>
                </td>
                <td className="border-b px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                    >
                      Edit
                    </button>
                    {activeTab === 'pending' && (
                      <button
                        onClick={() => handleMarkDiscussed(item.id)}
                        className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-200"
                      >
                        Selesai
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">Memuat...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Daftar Soal - MindSeek Edu</title>
      </Head>
      <div className="min-h-screen bg-slate-50 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/dashboard" className="text-sm text-sky-600 hover:underline">← Dashboard</Link>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Daftar Soal</h1>
              <p className="text-sm text-slate-600">Lihat dan kelola soal siswa, diskusikan yang perlu pendampingan.</p>
            </div>
            <div className="w-full sm:w-64">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa</label>
              <select
                value={studentId || ''}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.student_name} (Kelas {s.grade})</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Filter bar */}
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Dari Tanggal</label>
                <input type="date" value={filters.start_date} onChange={(e) => handleFilterChange('start_date', e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Sampai Tanggal</label>
                <input type="date" value={filters.end_date} onChange={(e) => handleFilterChange('end_date', e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Topik</label>
                <select value={filters.topic} onChange={(e) => handleFilterChange('topic', e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                  <option value="">Semua Topik</option>
                  {topikList.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Level</label>
                <select value={filters.level} onChange={(e) => handleFilterChange('level', e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                  <option value="">Semua Level</option>
                  <option value="easy">Mudah</option>
                  <option value="medium">Sedang</option>
                  <option value="hard">Sulit</option>
                </select>
              </div>
              <button onClick={resetFilters} className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Reset Filter</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 border-b border-slate-200">
            <nav className="-mb-px flex gap-4">
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-2 px-1 text-sm font-medium border-b-2 transition ${activeTab === 'pending' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                🔴 Belum Didiskusikan
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`py-2 px-1 text-sm font-medium border-b-2 transition ${activeTab === 'all' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                📋 Seluruh Soal
              </button>
              <button
                onClick={() => setActiveTab('discussed')}
                className={`py-2 px-1 text-sm font-medium border-b-2 transition ${activeTab === 'discussed' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                ✅ Sudah Didiskusikan
              </button>
            </nav>
          </div>

          {/* Tabel data */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            {renderTable()}
            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="flex justify-between items-center px-4 py-3 border-t border-slate-200 text-sm">
                <span className="text-slate-600">Halaman {pagination.page} dari {pagination.total_pages}</span>
                <div className="flex gap-2">
                  <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50">← Sebelumnya</button>
                  <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.total_pages} className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50">Selanjutnya →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Edit Kunci Jawaban */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold mb-4">Edit Kunci Jawaban & Langkah Ajar</h2>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">Kunci Jawaban</label>
              <textarea rows={3} value={editForm.expectedAnswer} onChange={(e) => setEditForm(prev => ({ ...prev, expectedAnswer: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">Langkah Ajar</label>
              <textarea rows={5} value={editForm.teachingSteps} onChange={(e) => setEditForm(prev => ({ ...prev, teachingSteps: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg border border-slate-300">Batal</button>
              <button onClick={handleEditSubmit} disabled={editingLoading} className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
