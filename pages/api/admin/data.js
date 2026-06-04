import { jwtVerify } from "jose";
import supabase from "@/lib/supabaseClient";

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

async function fetchClaims(tableName) {
  try {
    // Coba filter status = 'pending'
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    // Fallback: ambil semua tanpa filter (jika kolom status tidak ada)
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const [withdrawalClaims, redemptionClaims] = await Promise.all([
      fetchClaims("withdrawal_claims"),
      fetchClaims("redemption_claims"),
    ]);

    // Ambil semua parent (tanpa kolom yang mungkin tidak ada)
    const { data: parents, error: parentsErr } = await supabase
      .from("parent_profile")
      .select("id, name, email, reward_points, is_active, subscription_tier, subscription_expires_at")
      .order("created_at", { ascending: false });

    if (parentsErr) {
      return res.status(500).json({ success: false, message: "Database error (parent_profile)." });
    }

    return res.status(200).json({
      success: true,
      data: {
        admin: { id: admin.id, email: admin.email, role: admin.role },
        withdrawalClaims,
        redemptionClaims,
        parents: parents || [],
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || "Internal server error." });
  }
}