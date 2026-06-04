import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { serialize } from "cookie";
import supabase from "@/lib/supabaseClient";

function isValidEmail(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return false;
  // Simple sanity check (avoid heavy regex)
  return s.includes("@") && s.includes(".");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { email, password } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!isValidEmail(normalizedEmail) || !password) {
    return res.status(400).json({ success: false, message: "Email dan password wajib diisi." });
  }

  if (!process.env.JWT_SECRET) {
    return res
      .status(500)
      .json({ success: false, message: "Server misconfigured: JWT_SECRET is missing." });
  }

  try {
    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("id,email,role,password_hash,is_active")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, message: "Database error." });
    }

    if (!admin || admin?.is_active === false) {
      return res.status(401).json({ success: false, message: "Email atau password salah." });
    }

    const ok = await bcrypt.compare(String(password), String(admin.password_hash || ""));
    if (!ok) {
      return res.status(401).json({ success: false, message: "Email atau password salah." });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const isProd = process.env.NODE_ENV === "production";
    res.setHeader(
      "Set-Cookie",
      serialize("admin_token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      })
    );

    return res.status(200).json({ success: true, data: { id: admin.id, email: admin.email, role: admin.role } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}