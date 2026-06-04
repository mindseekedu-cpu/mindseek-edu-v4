import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';

// ─────────────────────────────────────────────
// Helper: jumlahkan kolom dari array rows
// ─────────────────────────────────────────────
function sumColumn(rows, column) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  return rows.reduce((acc, row) => acc + (Number(row[column]) || 0), 0);
}

// ─────────────────────────────────────────────
// Helper: ambil total parent yang direferral oleh parentId
// ─────────────────────────────────────────────
async function fetchTotalReferred(parentId) {
  const { count, error } = await supabase
    .from('parent_profile')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', parentId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Gagal menghitung referral: ${error.message}`);
  }

  return count ?? 0;
}

// ─────────────────────────────────────────────
// Helper: total poin yang pernah dikreditkan (amount > 0)
// ─────────────────────────────────────────────
async function fetchTotalPointsEarned(parentId) {
  const { data, error } = await supabase
    .from('points_transactions')
    .select('amount')
    .eq('parent_id', parentId)
    .gt('amount', 0);

  if (error) {
    throw new Error(`Gagal mengambil riwayat poin: ${error.message}`);
  }

  return sumColumn(data, 'amount');
}

// ─────────────────────────────────────────────
// Helper: jumlah poin yang sedang dalam antrian penarikan
// ─────────────────────────────────────────────
async function fetchPendingWithdrawal(parentId) {
  const { data, error } = await supabase
    .from('withdrawal_claims')
    .select('points_amount')
    .eq('parent_id', parentId)
    .eq('status', 'pending');

  if (error) {
    throw new Error(`Gagal mengambil klaim withdrawal: ${error.message}`);
  }

  return {
    total_points: sumColumn(data, 'points_amount'),
    count: Array.isArray(data) ? data.length : 0,
  };
}

// ─────────────────────────────────────────────
// Helper: jumlah poin yang sedang dalam antrian penukaran paket
// ─────────────────────────────────────────────
async function fetchPendingRedemption(parentId) {
  const { data, error } = await supabase
    .from('redemption_claims')
    .select('points_amount')
    .eq('parent_id', parentId)
    .eq('status', 'pending');

  if (error) {
    throw new Error(`Gagal mengambil klaim redemption: ${error.message}`);
  }

  return {
    total_points: sumColumn(data, 'points_amount'),
    count: Array.isArray(data) ? data.length : 0,
  };
}

// ─────────────────────────────────────────────
// Helper: riwayat 20 transaksi poin terbaru
// ─────────────────────────────────────────────
async function fetchRecentTransactions(parentId) {
  const { data, error } = await supabase
    .from('points_transactions')
    .select('id, amount, type, reference_id, note, created_at')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Gagal mengambil riwayat transaksi: ${error.message}`);
  }

  return data ?? [];
}

// ─────────────────────────────────────────────
// API Handler
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      message: 'Method tidak diizinkan.',
    });
  }

  try {
    // 1. Autentikasi parent – sertakan kolom tambahan yang dibutuhkan
    const { parentId, parent } = await getAuthenticatedParent(req, {
      parentSelect:
        'id, name, email, referral_code, reward_points, subscription_tier, subscription_expires_at',
    });

    // 2. Jalankan semua query secara paralel
    const [
      totalReferred,
      totalPointsEarned,
      pendingWithdrawal,
      pendingRedemption,
      recentTransactions,
    ] = await Promise.all([
      fetchTotalReferred(parentId),
      fetchTotalPointsEarned(parentId),
      fetchPendingWithdrawal(parentId),
      fetchPendingRedemption(parentId),
      fetchRecentTransactions(parentId),
    ]);

    // 3. Return payload
    return res.status(200).json({
      success: true,
      data: {
        referral_code: parent.referral_code ?? null,
        reward_points: Number(parent.reward_points ?? 0),
        total_referred: totalReferred,
        total_points_earned: totalPointsEarned,
        pending_withdrawal: {
          count: pendingWithdrawal.count,
          total_points: pendingWithdrawal.total_points,
        },
        pending_redemption: {
          count: pendingRedemption.count,
          total_points: pendingRedemption.total_points,
        },
        recent_transactions: recentTransactions,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      error instanceof Error ? error.message : 'Terjadi kesalahan pada server.';

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}