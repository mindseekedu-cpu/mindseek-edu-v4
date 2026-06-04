import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';

// ─────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────
const REDEMPTION_COST = 179; // poin yang dibutuhkan, tidak bisa diubah

// ─────────────────────────────────────────────
// Helper: validasi input
// ─────────────────────────────────────────────
function validateInput(body) {
  const amount = Number(body?.points_amount);

  if (!Number.isInteger(amount) || amount !== REDEMPTION_COST) {
    const error = new Error(
      `Penukaran paket membutuhkan tepat ${REDEMPTION_COST} poin.`
    );
    error.statusCode = 400;
    throw error;
  }

  return amount;
}

// ─────────────────────────────────────────────
// Helper: cek apakah sudah ada redemption pending
// Satu pending per parent sudah cukup – mencegah duplikat
// ─────────────────────────────────────────────
async function hasPendingRedemption(parentId) {
  const { count, error } = await supabase
    .from('redemption_claims')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', parentId)
    .eq('status', 'pending');

  if (error) {
    throw new Error(`Gagal memeriksa klaim pending: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

// ─────────────────────────────────────────────
// Helper: buat record redemption_claims
// ─────────────────────────────────────────────
async function insertRedemptionClaim(parentId) {
  const { data, error } = await supabase
    .from('redemption_claims')
    .insert([
      {
        parent_id: parentId,
        points_amount: REDEMPTION_COST,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      `Gagal membuat klaim penukaran: ${error?.message ?? 'data kosong'}`
    );
  }

  return data.id;
}

// ─────────────────────────────────────────────
// Helper: kurangi reward_points dengan optimistic lock
// ─────────────────────────────────────────────
async function deductRewardPoints(parentId, currentPoints) {
  const newBalance = currentPoints - REDEMPTION_COST;

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
async function insertPointsTransaction(parentId, claimId) {
  const { error } = await supabase
    .from('points_transactions')
    .insert([
      {
        parent_id: parentId,
        amount: -REDEMPTION_COST, // selalu negatif (debit)
        type: 'redemption_debit',
        reference_id: claimId,
        note: `Klaim penukaran paket ${REDEMPTION_COST} poin – menunggu persetujuan admin`,
        created_at: new Date().toISOString(),
      },
    ]);

  if (error) {
    throw new Error(`Gagal mencatat transaksi poin: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// Rollback: hapus redemption_claims jika langkah berikutnya gagal
// ─────────────────────────────────────────────
async function rollbackClaim(claimId) {
  if (!claimId) return;
  try {
    await supabase.from('redemption_claims').delete().eq('id', claimId);
  } catch (e) {
    console.error('[claim-redemption] rollback gagal – claimId:', claimId, e);
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
    // 1. Autentikasi parent
    const { parentId, parent } = await getAuthenticatedParent(req, {
      parentSelect:
        'id, name, reward_points, is_active, subscription_tier, subscription_expires_at',
    });

    // 2. Cek akun tidak dibekukan
    if (parent.is_active === false) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda sedang dibekukan. Hubungi support untuk bantuan.',
      });
    }

    // 3. Validasi input (harus tepat 179)
    validateInput(req.body ?? {});

    // 4. Cek saldo poin mencukupi
    const currentPoints = Number(parent.reward_points ?? 0);
    if (currentPoints < REDEMPTION_COST) {
      return res.status(422).json({
        success: false,
        message: `Saldo poin tidak cukup. Saldo Anda: ${currentPoints}, dibutuhkan: ${REDEMPTION_COST}.`,
      });
    }

    // 5. Cegah duplikat – satu pending redemption per parent
    const alreadyPending = await hasPendingRedemption(parentId);
    if (alreadyPending) {
      return res.status(422).json({
        success: false,
        message:
          'Anda sudah memiliki klaim penukaran paket yang sedang menunggu persetujuan admin.',
      });
    }

    // 6. Buat record redemption_claims (status: pending)
    claimId = await insertRedemptionClaim(parentId);

    // 7. Kurangi reward_points (optimistic lock)
    //    Gagal → rollback claim
    let newBalance;
    try {
      newBalance = await deductRewardPoints(parentId, currentPoints);
    } catch (deductError) {
      await rollbackClaim(claimId);
      throw deductError;
    }

    // 8. Catat di points_transactions (amount negatif)
    //    Gagal → rollback claim + restore poin
    try {
      await insertPointsTransaction(parentId, claimId);
    } catch (logError) {
      await rollbackClaim(claimId);
      await supabase
        .from('parent_profile')
        .update({
          reward_points: currentPoints,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parentId);
      throw logError;
    }

    // 9. Sukses
    return res.status(200).json({
      success: true,
      message:
        'Klaim penukaran paket berhasil. Admin akan memverifikasi dan memperpanjang langganan Anda dalam 1–3 hari kerja.',
      data: {
        claim_id: claimId,
        points_claimed: REDEMPTION_COST,
        remaining_balance: newBalance,
        status: 'pending',
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      error instanceof Error ? error.message : 'Terjadi kesalahan pada server.';

    console.error('[claim-redemption] error:', message);

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}