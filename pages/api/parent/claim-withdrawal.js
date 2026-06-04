import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';

// ─────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────
const MIN_POINTS = 100;
const MAX_POINTS = 100_000;
const MAX_BANK_ACCOUNT_LENGTH = 512;
const MAX_PENDING_CLAIMS = 3; // maksimal antrian withdrawal sekaligus

// ─────────────────────────────────────────────
// Helper: validasi input request body
// ─────────────────────────────────────────────
function validateInput({ points_amount, bank_account }) {
  const amount = Number(points_amount);

  if (!Number.isInteger(amount) || amount < MIN_POINTS) {
    const error = new Error(`Jumlah poin minimal ${MIN_POINTS} untuk penarikan.`);
    error.statusCode = 400;
    throw error;
  }

  if (amount > MAX_POINTS) {
    const error = new Error(`Jumlah poin maksimal sekali tarik adalah ${MAX_POINTS.toLocaleString('id-ID')}.`);
    error.statusCode = 400;
    throw error;
  }

  if (
    bank_account !== undefined &&
    bank_account !== null &&
    String(bank_account).length > MAX_BANK_ACCOUNT_LENGTH
  ) {
    const error = new Error('Informasi rekening terlalu panjang (maksimal 512 karakter).');
    error.statusCode = 400;
    throw error;
  }

  return { amount, bankAccount: bank_account ? String(bank_account).trim() : null };
}

// ─────────────────────────────────────────────
// Helper: cek jumlah klaim pending milik parent
// ─────────────────────────────────────────────
async function countPendingWithdrawals(parentId) {
  const { count, error } = await supabase
    .from('withdrawal_claims')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', parentId)
    .eq('status', 'pending');

  if (error) {
    throw new Error(`Gagal memeriksa klaim pending: ${error.message}`);
  }

  return count ?? 0;
}

// ─────────────────────────────────────────────
// Helper: buat record withdrawal_claims
// ─────────────────────────────────────────────
async function insertWithdrawalClaim(parentId, amount, bankAccount) {
  const { data, error } = await supabase
    .from('withdrawal_claims')
    .insert([
      {
        parent_id: parentId,
        points_amount: amount,
        status: 'pending',
        bank_account: bankAccount,
        created_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Gagal membuat klaim penarikan: ${error?.message ?? 'data kosong'}`);
  }

  return data.id;
}

// ─────────────────────────────────────────────
// Helper: kurangi reward_points dengan optimistic lock
// Gunakan .eq('reward_points', currentPoints) untuk memastikan
// tidak ada perubahan concurrent yang melewati pengecekan saldo.
// ─────────────────────────────────────────────
async function deductRewardPoints(parentId, currentPoints, amount) {
  const newBalance = currentPoints - amount;

  const { error, count } = await supabase
    .from('parent_profile')
    .update({
      reward_points: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parentId)
    .eq('reward_points', currentPoints) // optimistic concurrency check
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Gagal mengurangi poin: ${error.message}`);
  }

  // count = 0 berarti reward_points sudah berubah oleh proses lain
  if ((count ?? 0) === 0) {
    const conflict = new Error(
      'Saldo poin telah berubah. Silakan refresh dan coba kembali.'
    );
    conflict.statusCode = 409;
    throw conflict;
  }

  return newBalance;
}

// ─────────────────────────────────────────────
// Helper: catat mutasi poin (debit)
// ─────────────────────────────────────────────
async function insertPointsTransaction(parentId, amount, claimId) {
  const { error } = await supabase
    .from('points_transactions')
    .insert([
      {
        parent_id: parentId,
        amount: -Math.abs(amount), // selalu negatif (debit)
        type: 'withdrawal_debit',
        reference_id: claimId,
        note: `Klaim penarikan poin sejumlah ${amount}`,
        created_at: new Date().toISOString(),
      },
    ]);

  if (error) {
    throw new Error(`Gagal mencatat transaksi poin: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// Rollback: hapus withdrawal_claims jika deduct/log gagal
// ─────────────────────────────────────────────
async function rollbackClaim(claimId) {
  if (!claimId) return;
  try {
    await supabase.from('withdrawal_claims').delete().eq('id', claimId);
  } catch (e) {
    console.error('[claim-withdrawal] rollback gagal – claimId:', claimId, e);
  }
}

// ─────────────────────────────────────────────
// API Handler
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: 'Method tidak diizinkan.',
    });
  }

  let claimId = null;

  try {
    // 1. Autentikasi parent, ambil reward_points sekaligus
    const { parentId, parent } = await getAuthenticatedParent(req, {
      parentSelect: 'id, name, reward_points, is_active',
    });

    // 2. Cek akun tidak dibekukan admin
    if (parent.is_active === false) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda sedang dibekukan. Hubungi support untuk bantuan.',
      });
    }

    // 3. Validasi input
    const { amount, bankAccount } = validateInput(req.body ?? {});

    // 4. Cek saldo poin mencukupi
    const currentPoints = Number(parent.reward_points ?? 0);
    if (currentPoints < amount) {
      return res.status(422).json({
        success: false,
        message: `Saldo poin tidak cukup. Saldo Anda: ${currentPoints}, dibutuhkan: ${amount}.`,
      });
    }

    // 5. Batasi jumlah klaim pending
    const pendingCount = await countPendingWithdrawals(parentId);
    if (pendingCount >= MAX_PENDING_CLAIMS) {
      return res.status(422).json({
        success: false,
        message: `Anda sudah memiliki ${pendingCount} klaim penarikan yang sedang diproses. Tunggu hingga selesai.`,
      });
    }

    // 6. Buat record withdrawal_claims (status: pending)
    claimId = await insertWithdrawalClaim(parentId, amount, bankAccount);

    // 7. Kurangi reward_points dengan optimistic lock
    //    Jika gagal/conflict → rollback claim
    let newBalance;
    try {
      newBalance = await deductRewardPoints(parentId, currentPoints, amount);
    } catch (deductError) {
      await rollbackClaim(claimId);
      throw deductError;
    }

    // 8. Catat di points_transactions (amount negatif)
    //    Jika gagal → rollback claim + restore poin
    try {
      await insertPointsTransaction(parentId, amount, claimId);
    } catch (logError) {
      await rollbackClaim(claimId);
      // Restore poin
      await supabase
        .from('parent_profile')
        .update({ reward_points: currentPoints, updated_at: new Date().toISOString() })
        .eq('id', parentId);
      throw logError;
    }

    // 9. Sukses
    return res.status(200).json({
      success: true,
      message: 'Klaim penarikan berhasil dibuat. Admin akan memproses dalam 1–3 hari kerja.',
      data: {
        claim_id: claimId,
        points_claimed: amount,
        remaining_balance: newBalance,
        bank_account: bankAccount,
        status: 'pending',
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      error instanceof Error ? error.message : 'Terjadi kesalahan pada server.';

    console.error('[claim-withdrawal] error:', message);

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}