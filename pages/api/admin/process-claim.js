import { jwtVerify } from "jose";
import supabase from "@/lib/supabaseClient";

function pickPointsAmount(row) {
  if (!row) return null;
  const candidates = [
    row.points_amount,
    row.pointsAmount,
    row.amount_points,
    row.amountPoints,
    row.points,
    row.amount,
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function nowIso() {
  return new Date().toISOString();
}

async function requireAdmin(req, res) {
  const token = req.cookies?.admin_token;
  if (!token) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }

  if (!process.env.JWT_SECRET) {
    res.status(500).json({ success: false, message: "Server misconfigured: JWT_SECRET is missing." });
    return null;
  }

  try {
    const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);

    if (!payload?.id || !payload?.email) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return null;
    }

    return payload;
  } catch (_) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
}

async function insertAdminLog({ adminId, action, targetId, details }) {
  const payload = {
    admin_id: adminId,
    action,
    target_id: String(targetId),
    details: details ? JSON.stringify(details) : null,
    created_at: nowIso(),
  };

  const { error } = await supabase.from("admin_logs").insert(payload);
  if (error) throw new Error("Failed to write admin_logs");
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function getParent(parentId) {
  const { data, error } = await supabase
    .from("parent_profile")
    .select("id,reward_points,is_active,subscription_expires_at")
    .eq("id", parentId)
    .single();
  if (error) throw new Error("Parent not found");
  return data;
}

async function updateParentPoints(parentId, newPoints) {
  const { data, error } = await supabase
    .from("parent_profile")
    .update({ reward_points: newPoints })
    .eq("id", parentId)
    .select("id,reward_points")
    .single();
  if (error) throw new Error("Failed to update parent points");
  return data;
}

async function insertPointsTransaction({ parentId, type, amount, referenceId, note }) {
  const payload = {
    parent_id: parentId,
    type,
    amount,
    reference_id: referenceId ? String(referenceId) : null,
    note: note || null,
    created_at: nowIso(),
  };

  const { error } = await supabase.from("points_transactions").insert(payload);
  if (error) throw new Error("Failed to write points_transactions");
}

async function updateClaimStatus(table, claimId, status, extra = {}) {
  // Pastikan claim masih pending sebelum update
  const { data: existing, error: checkError } = await supabase
    .from(table)
    .select("status")
    .eq("id", claimId)
    .single();

  if (checkError) throw new Error(`Claim not found: ${checkError.message}`);
  if (existing.status !== "pending") {
    throw new Error(`Claim sudah ${existing.status}, tidak bisa diproses ulang.`);
  }

  const { data, error } = await supabase
    .from(table)
    .update({ status, ...extra })
    .eq("id", claimId)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update ${table}`);
  return data;
}

async function getClaim(table, claimId) {
  const { data, error } = await supabase.from(table).select("*").eq("id", claimId).single();
  if (error) throw new Error("Claim not found");
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { type, claimId, parentId, action, rejectionReason } = req.body || {};

  const t = String(type || "");
  const a = String(action || "");

  const allowedTypes = new Set(["withdrawal", "redemption", "parent"]);
  const allowedActions = new Set(["approve", "reject", "freeze", "unfreeze"]);

  if (!allowedTypes.has(t) || !allowedActions.has(a)) {
    return res.status(400).json({ success: false, message: "Invalid payload." });
  }

  try {
    // --- Parent freeze / unfreeze ---
    if (t === "parent") {
      if (!parentId) return res.status(400).json({ success: false, message: "parentId wajib." });
      if (a !== "freeze" && a !== "unfreeze") {
        return res.status(400).json({ success: false, message: "Action tidak valid untuk type parent." });
      }

      const isActive = a === "unfreeze";
      const { data: updated, error } = await supabase
        .from("parent_profile")
        .update({ is_active: isActive })
        .eq("id", parentId)
        .select("id,is_active")
        .single();

      if (error) throw new Error("Failed to update parent");

      await insertAdminLog({
        adminId: admin.id,
        action: a,
        targetId: parentId,
        details: { type: "parent", parentId: String(parentId), is_active: isActive },
      });

      return res.status(200).json({ success: true, data: { parent: updated } });
    }

    // --- Claims ---
    if (!claimId) {
      return res.status(400).json({ success: false, message: "claimId wajib." });
    }
    if (a !== "approve" && a !== "reject") {
      return res.status(400).json({ success: false, message: "Action tidak valid untuk type claim." });
    }

    const table = t === "withdrawal" ? "withdrawal_claims" : "redemption_claims";

    // Load claim to get parent_id and points amount, and verify status is pending
    const claim = await getClaim(table, claimId);
    if (claim.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Klaim sudah ${claim.status}, tidak dapat diproses lagi.`
      });
    }

    const claimParentId = claim.parent_id || claim.parentId;
    if (!claimParentId) {
      return res.status(500).json({ success: false, message: "Claim missing parent_id." });
    }

    const pointsAmount = pickPointsAmount(claim);

    if (a === "approve") {
      // Approve: update claim status.
      const approvedClaim = await updateClaimStatus(table, claimId, "approved", {
        processed_at: nowIso(),
        processed_by: admin.id,
      });

      // For redemption approve: extend subscription + 30 days.
      let parentAfter = null;
      if (t === "redemption") {
        const parent = await getParent(claimParentId);
        const base = parent.subscription_expires_at ? new Date(parent.subscription_expires_at) : null;
        const now = new Date();
        const effective = base && base.getTime() > now.getTime() ? base : now;
        const next = addDays(effective, 30);

        const { data: updated, error } = await supabase
          .from("parent_profile")
          .update({ subscription_expires_at: next.toISOString() })
          .eq("id", claimParentId)
          .select("id,subscription_expires_at")
          .single();
        if (error) throw new Error("Failed to extend subscription");
        parentAfter = updated;
      }

      await insertAdminLog({
        adminId: admin.id,
        action: "approve",
        targetId: claimId,
        details: {
          type: t,
          claimId: String(claimId),
          parentId: String(claimParentId),
          pointsAmount: pointsAmount,
        },
      });

      return res.status(200).json({ success: true, data: { claim: approvedClaim, parent: parentAfter } });
    }

    // --- Reject flow (withdrawal/redemption): set rejected + return points + ledger entry ---
    if (!pointsAmount) {
      return res.status(400).json({ success: false, message: "Cannot determine points amount for reversal." });
    }

    const rejectedClaim = await updateClaimStatus(table, claimId, "rejected", {
      processed_at: nowIso(),
      processed_by: admin.id,
      rejection_reason: rejectionReason || null,
    });

    const parent = await getParent(claimParentId);
    const currentPoints = Number(parent.reward_points || 0);
    const newPoints = currentPoints + Number(pointsAmount);

    const updatedParent = await updateParentPoints(claimParentId, newPoints);

    await insertPointsTransaction({
      parentId: claimParentId,
      type: t === "withdrawal" ? "withdrawal_reversal" : "redemption_reversal",
      amount: Number(pointsAmount),
      referenceId: claimId,
      note: rejectionReason ? String(rejectionReason) : null,
    });

    await insertAdminLog({
      adminId: admin.id,
      action: "reject",
      targetId: claimId,
      details: {
        type: t,
        claimId: String(claimId),
        parentId: String(claimParentId),
        pointsAmount: Number(pointsAmount),
        rejectionReason: rejectionReason ? String(rejectionReason) : null,
      },
    });

    return res.status(200).json({ success: true, data: { claim: rejectedClaim, parent: updatedParent } });
  } catch (e) {
    const message = e?.message || "Internal server error.";
    return res.status(500).json({ success: false, message });
  }
}
