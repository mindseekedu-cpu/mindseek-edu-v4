import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// ─────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────
const REDEMPTION_COST = 179;
const MIN_WITHDRAWAL = 100;
const POINTS_TO_RUPIAH = 1000; // 1 poin = Rp1.000

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatPoints(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

function formatRupiah(points) {
  const rupiah = Number(points || 0) * POINTS_TO_RUPIAH;
  return `Rp${rupiah.toLocaleString('id-ID')}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function txTypeLabel(type) {
  switch (String(type || '')) {
    case 'referral_bonus':   return 'Bonus Referral';
    case 'withdrawal_debit': return 'Penarikan Tunai';
    case 'redemption_debit': return 'Tukar Paket';
    case 'manual_credit':    return 'Kredit Manual';
    default:                 return type || '—';
  }
}

function txTypeColor(type) {
  switch (String(type || '')) {
    case 'referral_bonus':
    case 'manual_credit':
      return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
    default:
      return 'text-rose-700 bg-rose-50 ring-rose-200';
  }
}

// ─────────────────────────────────────────────
// Sub-komponen: Stat tile
// ─────────────────────────────────────────────
function StatTile({ label, children, accent }) {
  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${
        accent ? 'ring-sky-400 bg-gradient-to-br from-sky-50 to-white' : 'ring-slate-200'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-komponen: Alert
// ─────────────────────────────────────────────
function Alert({ type = 'error', message, onClose }) {
  if (!message) return null;
  const styles = {
    error:   'border-red-200   bg-red-50   text-red-700',
    success: 'border-green-200 bg-green-50 text-green-700',
    info:    'border-sky-200   bg-sky-50   text-sky-700',
  };
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${styles[type]}`}
    >
      <span>{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 font-bold opacity-60 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Halaman utama
// ─────────────────────────────────────────────
export default function AffiliatePage() {
  // ── data ──────────────────────────────────
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // ── copy referral code ────────────────────
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef(null);

  // ── withdrawal form ───────────────────────
  const [showWithdraw, setShowWithdraw]   = useState(false);
  const [wAmount, setWAmount]             = useState('');
  const [wBank, setWBank]                 = useState('');
  const [wLoading, setWLoading]           = useState(false);
  const [wError, setWError]               = useState('');
  const [wSuccess, setWSuccess]           = useState('');

  // ── redemption ────────────────────────────
  const [rLoading, setRLoading] = useState(false);
  const [rError, setRError]     = useState('');
  const [rSuccess, setRSuccess] = useState('');

  // ─────────────────────────────────────────
  // Load referral info
  // ─────────────────────────────────────────
  const loadInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res    = await fetch('/api/parent/referral-info');
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Gagal memuat data kemitraan.');
      }

      setInfo(result.data);
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  // ─────────────────────────────────────────
  // Copy referral code
  // ─────────────────────────────────────────
  function handleCopy() {
    const code = info?.referral_code;
    if (!code) return;

    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        clearTimeout(copyTimeout.current);
        copyTimeout.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // fallback untuk browser lama
        const el = document.createElement('textarea');
        el.value = code;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        clearTimeout(copyTimeout.current);
        copyTimeout.current = setTimeout(() => setCopied(false), 2000);
      });
  }

  // ─────────────────────────────────────────
  // Submit withdrawal
  // ─────────────────────────────────────────
  async function handleWithdraw() {
    const amount = Number(String(wAmount || '').replace(/\D/g, ''));
    const bank   = String(wBank || '').trim();

    if (!amount || amount < MIN_WITHDRAWAL) {
      setWError(`Jumlah minimal penarikan adalah ${MIN_WITHDRAWAL} poin (≈ ${formatRupiah(MIN_WITHDRAWAL)}).`);
      return;
    }

    const balance = Number(info?.reward_points ?? 0);
    if (amount > balance) {
      setWError(`Saldo tidak cukup. Saldo Anda: ${formatPoints(balance)} poin (≈ ${formatRupiah(balance)}).`);
      return;
    }

    const confirmed = window.confirm(
      `Tarik ${formatPoints(amount)} poin (≈ ${formatRupiah(amount)}) ke:\n"${bank || '(rekening belum diisi)'}"\n\nLanjutkan?`
    );
    if (!confirmed) return;

    try {
      setWLoading(true);
      setWError('');
      setWSuccess('');

      const res    = await fetch('/api/parent/claim-withdrawal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ points_amount: amount, bank_account: bank || null }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Gagal membuat klaim penarikan.');
      }

      setWSuccess(
        `Klaim penarikan ${formatPoints(amount)} poin (≈ ${formatRupiah(amount)}) berhasil dibuat. Admin akan memproses dalam 1–3 hari kerja.`
      );
      setWAmount('');
      setWBank('');
      setShowWithdraw(false);
      await loadInfo();
    } catch (err) {
      setWError(err.message || 'Terjadi kesalahan.');
    } finally {
      setWLoading(false);
    }
  }

  // ─────────────────────────────────────────
  // Submit redemption
  // ─────────────────────────────────────────
  async function handleRedeem() {
    const balance = Number(info?.reward_points ?? 0);

    if (balance < REDEMPTION_COST) {
      setRError(`Saldo tidak cukup. Dibutuhkan ${REDEMPTION_COST} poin, saldo Anda: ${formatPoints(balance)} (≈ ${formatRupiah(balance)}).`);
      return;
    }

    const confirmed = window.confirm(
      `Tukarkan ${REDEMPTION_COST} poin untuk perpanjangan paket +1 bulan?\n\nAdmin akan memverifikasi dalam 1–3 hari kerja.`
    );
    if (!confirmed) return;

    try {
      setRLoading(true);
      setRError('');
      setRSuccess('');

      const res    = await fetch('/api/parent/claim-redemption', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ points_amount: REDEMPTION_COST }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Gagal membuat klaim penukaran.');
      }

      setRSuccess(
        `Klaim tukar paket berhasil! Sisa saldo: ${formatPoints(result.data?.remaining_balance ?? 0)} poin.`
      );
      await loadInfo();
    } catch (err) {
      setRError(err.message || 'Terjadi kesalahan.');
    } finally {
      setRLoading(false);
    }
  }

  // ─────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────
  const balance        = Number(info?.reward_points ?? 0);
  const canWithdraw    = balance >= MIN_WITHDRAWAL;
  const canRedeem      = balance >= REDEMPTION_COST && !(info?.pending_redemption?.count > 0);
  const transactions   = Array.isArray(info?.recent_transactions) ? info.recent_transactions : [];

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Kemitraan & Poin – MindSeek Edu</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-slate-50 py-10">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">

          {/* ── Header ── */}
          <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                href="/dashboard"
                className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline"
              >
                ← Kembali ke Dashboard
              </Link>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kemitraan & Poin</h1>
              <p className="mt-1 text-sm text-slate-600">
                Bagikan kode referral Anda, kumpulkan poin, dan tukarkan dengan hadiah.
              </p>
            </div>
            <button
              type="button"
              onClick={loadInfo}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Memuat...' : '↻ Refresh'}
            </button>
          </div>

          {/* ── Error global ── */}
          {error && (
            <div className="mb-6">
              <Alert type="error" message={error} onClose={() => setError('')} />
            </div>
          )}

          {/* ── Skeleton ── */}
          {loading && !info && (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
              Memuat data kemitraan...
            </div>
          )}

          {info && (
            <>
              {/* ── Stats grid ── */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Referral code */}
                <StatTile label="Kode Referral" accent>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tracking-widest text-sky-700">
                      {info.referral_code || '—'}
                    </span>
                    {info.referral_code && (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                          copied
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-700'
                        }`}
                      >
                        {copied ? '✓ Tersalin' : 'Salin'}
                      </button>
                    )}
                  </div>
                </StatTile>

                {/* Saldo poin */}
                <StatTile label="Saldo Poin">
                  <p className="text-3xl font-bold text-slate-900">{formatPoints(balance)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    ≈ {formatRupiah(balance)} &nbsp;|&nbsp; 1 poin = Rp{POINTS_TO_RUPIAH.toLocaleString('id-ID')}
                  </p>
                </StatTile>

                {/* Total referral */}
                <StatTile label="Total Referral">
                  <p className="text-3xl font-bold text-slate-900">
                    {Number(info.total_referred ?? 0)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">parent bergabung</p>
                </StatTile>

                {/* Total earned */}
                <StatTile label="Total Diperoleh">
                  <p className="text-3xl font-bold text-slate-900">
                    {formatPoints(info.total_points_earned)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">poin sepanjang masa</p>
                </StatTile>
              </div>

              {/* ── Cara dapat poin ── */}
              <div className="mt-6 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 p-6 shadow-sm">
                <p className="text-sm font-semibold text-white/80">Cara Mendapatkan Poin</p>
                <p className="mt-1 text-xl font-bold text-white">
                  Setiap 1 referral yang berhasil berlangganan = <span className="text-yellow-300">+10 poin</span>
                </p>
                <p className="mt-2 text-sm text-white/80">
                  Bagikan kode referral Anda ke teman, dan dapatkan poin saat mereka aktif berlangganan.
                  Poin bisa ditarik sebagai uang tunai (1 poin = Rp{POINTS_TO_RUPIAH.toLocaleString('id-ID')}) 
                  atau ditukar paket.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20">
                    🏦 Tarik Tunai: min. {formatPoints(MIN_WITHDRAWAL)} poin ≈ {formatRupiah(MIN_WITHDRAWAL)}
                  </div>
                  <div className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20">
                    🎓 Tukar Paket: {REDEMPTION_COST} poin = +1 bulan
                  </div>
                </div>
              </div>

              {/* ── Pending claims info ── */}
              {(info.pending_withdrawal?.count > 0 || info.pending_redemption?.count > 0) && (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-semibold text-amber-800">⏳ Klaim Sedang Diproses</p>
                  <div className="mt-2 space-y-1 text-sm text-amber-700">
                    {info.pending_withdrawal?.count > 0 && (
                      <p>
                        • {info.pending_withdrawal.count} penarikan tunai (
                        {formatPoints(info.pending_withdrawal.total_points)} poin ≈ {formatRupiah(info.pending_withdrawal.total_points)}) menunggu persetujuan admin.
                      </p>
                    )}
                    {info.pending_redemption?.count > 0 && (
                      <p>
                        • {info.pending_redemption.count} penukaran paket (
                        {formatPoints(info.pending_redemption.total_points)} poin) menunggu persetujuan admin.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Feedback dari klaim ── */}
              <div className="mt-4 space-y-3">
                {wSuccess && <Alert type="success" message={wSuccess} onClose={() => setWSuccess('')} />}
                {rSuccess && <Alert type="success" message={rSuccess} onClose={() => setRSuccess('')} />}
                {rError   && <Alert type="error"   message={rError}   onClose={() => setRError('')}   />}
              </div>

              {/* ── Tombol aksi ── */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {/* Tarik Cuan */}
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-base font-bold text-slate-900">💸 Tarik Cuan</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Konversi poin jadi uang tunai ke rekening Anda.
                    Minimal {formatPoints(MIN_WITHDRAWAL)} poin (≈ {formatRupiah(MIN_WITHDRAWAL)}).
                  </p>

                  {!canWithdraw && (
                    <p className="mt-3 text-xs text-slate-500">
                      Kumpulkan lebih banyak poin terlebih dahulu. 1 poin = Rp{POINTS_TO_RUPIAH.toLocaleString('id-ID')}.
                    </p>
                  )}

                  {wError && (
                    <div className="mt-3">
                      <Alert type="error" message={wError} onClose={() => setWError('')} />
                    </div>
                  )}

                  {/* Toggle form */}
                  {!showWithdraw ? (
                    <button
                      type="button"
                      onClick={() => { setShowWithdraw(true); setWError(''); }}
                      disabled={!canWithdraw}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Tarik Cuan
                    </button>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Jumlah Poin <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={wAmount}
                          onChange={(e) => setWAmount(e.target.value.replace(/\D/g, ''))}
                          placeholder={`Min. ${MIN_WITHDRAWAL} (≈ ${formatRupiah(MIN_WITHDRAWAL)})`}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                        />
                        <p className="mt-0.5 text-xs text-slate-500">
                          Saldo: <span className="font-semibold">{formatPoints(balance)}</span> poin (≈ {formatRupiah(balance)})
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Info Rekening (opsional)
                        </label>
                        <input
                          type="text"
                          value={wBank}
                          onChange={(e) => setWBank(e.target.value)}
                          placeholder="Contoh: BCA – 1234567890 a/n Budi"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleWithdraw}
                          disabled={wLoading || !wAmount}
                          className="flex-1 inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {wLoading ? 'Memproses...' : 'Konfirmasi Tarik'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowWithdraw(false); setWError(''); setWAmount(''); setWBank(''); }}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tukar Paket */}
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-base font-bold text-slate-900">🎓 Tukar Paket</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Tukarkan {REDEMPTION_COST} poin untuk perpanjangan berlangganan +1 bulan.
                    Admin akan memverifikasi dan mengaktifkan dalam 1–3 hari kerja.
                  </p>
                  {info.pending_redemption?.count > 0 && (
                    <p className="mt-2 text-xs font-medium text-amber-600">
                      Klaim sebelumnya masih diproses. Tunggu hingga selesai.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleRedeem}
                    disabled={rLoading || !canRedeem}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rLoading
                      ? 'Memproses...'
                      : balance < REDEMPTION_COST
                        ? `Butuh ${REDEMPTION_COST} poin (kurang ${REDEMPTION_COST - balance})`
                        : `Tukar ${REDEMPTION_COST} Poin`}
                  </button>
                </div>
              </div>

              {/* ── Cara bagikan kode referral ── */}
              <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-base font-bold text-slate-900">Bagikan Kode Referral</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Salin teks di bawah dan kirim ke teman atau komunitas Anda.
                </p>
                <div className="mt-3 flex items-start gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="flex-1 text-sm text-slate-700">
                    Halo! Saya pakai MindSeek Edu untuk pantau belajar anak — platform AI tutor seru
                    untuk siswa Indonesia. Coba gratis pakai kode referral saya:{' '}
                    <span className="font-bold text-sky-700">{info.referral_code}</span>{' '}
                    di halaman daftar: {typeof window !== 'undefined' ? window.location.origin : ''}/register
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Halo! Saya pakai MindSeek Edu untuk pantau belajar anak — platform AI tutor seru untuk siswa Indonesia. Coba gratis pakai kode referral saya: ${info.referral_code} di ${typeof window !== 'undefined' ? window.location.origin : ''}/register`;
                      navigator.clipboard?.writeText(text).catch(() => {});
                      setCopied(true);
                      clearTimeout(copyTimeout.current);
                      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
                    }}
                    className="shrink-0 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-200"
                  >
                    {copied ? '✓ Tersalin' : 'Salin'}
                  </button>
                </div>
              </div>

              {/* ── Riwayat transaksi ── */}
              <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-4 text-base font-bold text-slate-900">
                  Riwayat Transaksi Poin
                </h2>

                {transactions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    Belum ada transaksi poin.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Tanggal
                          </th>
                          <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Jenis
                          </th>
                          <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Keterangan
                          </th>
                          <th className="py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Poin
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions.map((tx) => {
                          const isCredit = Number(tx.amount) > 0;
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50">
                              <td className="py-3 pr-4 text-slate-600 whitespace-nowrap">
                                {formatDate(tx.created_at)}
                               </td>
                              <td className="py-3 pr-4">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${txTypeColor(tx.type)}`}
                                >
                                  {txTypeLabel(tx.type)}
                                </span>
                               </td>
                              <td className="py-3 pr-4 text-slate-600">
                                {tx.note || '—'}
                               </td>
                              <td
                                className={`py-3 text-right font-bold ${
                                  isCredit ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {isCredit ? '+' : ''}
                                {formatPoints(tx.amount)}
                               </td>
                             </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
