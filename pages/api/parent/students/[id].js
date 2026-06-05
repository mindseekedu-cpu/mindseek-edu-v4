import { getAuthenticatedParent } from "@/lib/auth";
import supabase from '@/lib/supabaseClient';

function httpError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function normalizeId(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return String(value);
}

function validateUpdate(body) {
  const out = {};
  const errors = [];

  if (body?.student_name !== undefined) {
    const name = String(body.student_name || "").trim();
    if (name.length < 3) errors.push("Student Name minimal 3 karakter");
    out.student_name = name;
  }

  if (body?.grade !== undefined) {
    const gradeNum = Number(body.grade);
    if (!Number.isInteger(gradeNum) || gradeNum < 1 || gradeNum > 12) {
      errors.push("Grade harus 1-12");
    }
    out.grade = gradeNum;
  }

  if (body?.curriculum !== undefined) {
    out.curriculum = String(body.curriculum || "").trim() || "Kurikulum Merdeka";
  }

  if (body?.student_email !== undefined) {
    const val = String(body.student_email || "").trim();
    if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      errors.push("Format Student Email tidak valid");
    }
    out.student_email = val === "" ? null : val;
  }

  if (body?.school_name !== undefined) {
    const val = String(body.school_name || "").trim();
    out.school_name = val === "" ? null : val;
  }

  if (body?.interests !== undefined) {
    const val = String(body.interests || "").trim();
    out.interests = val === "" ? null : val;
  }

  if (body?.learning_style !== undefined) {
    const allowed = ["Visual", "Auditori", "Kinestetik", "BacaTulis", "Campuran"];
    const val = String(body.learning_style || "").trim() || "Campuran";
    if (!allowed.includes(val)) errors.push("Learning Style tidak valid");
    out.learning_style = val;
  }

  if (body?.additional_notes !== undefined) {
    const val = String(body.additional_notes || "").trim();
    out.additional_notes = val === "" ? null : val;
  }

  // PIN dan student_id tidak boleh diubah
  if (body?.pin !== undefined || body?.pin_confirm !== undefined || body?.pin_confirmation !== undefined) {
    errors.push("PIN tidak bisa diubah melalui endpoint ini. Gunakan fitur reset PIN terpisah.");
  }
  if (body?.student_id !== undefined) {
    errors.push("Student ID tidak bisa diubah.");
  }

  if (errors.length > 0) {
    throw new Error(errors.join(". "));
  }

  return out;
}

async function getOwnedStudentOr404({ parentId, studentUuid }) {
  const { data, error } = await supabase
    .from("students_profile")
    .select(
      "id,parent_id,student_name,grade,curriculum,student_email,school_name,interests,learning_style,additional_notes,student_id,deleted_at,created_at,updated_at"
    )
    .eq("id", studentUuid)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.deleted_at) return null;
  return data;
}

export default async function handler(req, res) {
  const studentUuid = normalizeId(req.query?.id);
  if (!studentUuid) return httpError(res, 400, "Missing student id");

  let parentId;
  try {
    const auth = await getAuthenticatedParent(req);
    parentId = auth.parentId;
  } catch (e) {
    if (e.statusCode === 401 || e.message?.includes("Token") || e.message?.includes("autentikasi")) {
      return httpError(res, 401, e.message || "Unauthorized");
    }
    return httpError(res, 401, "Unauthorized");
  }

  if (req.method === "GET") {
    try {
      const student = await getOwnedStudentOr404({ parentId, studentUuid });
      if (!student) return httpError(res, 404, "Siswa tidak ditemukan");

      return res.status(200).json({ success: true, student });
    } catch (e) {
      console.error("[GET /students/:id] Error:", e);
      return httpError(res, 500, e?.message || "Server error");
    }
  }

  if (req.method === "PUT") {
    try {
      let updates;
      try {
        updates = validateUpdate(req.body || {});
      } catch (validationError) {
        return httpError(res, 400, validationError.message);
      }

      if (Object.keys(updates).length === 0) {
        return httpError(res, 400, "Tidak ada field yang diupdate");
      }

      const existing = await getOwnedStudentOr404({ parentId, studentUuid });
      if (!existing) return httpError(res, 404, "Siswa tidak ditemukan");

      const { data, error } = await supabase
        .from("students_profile")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", studentUuid)
        .eq("parent_id", parentId)
        .select(
          "id,student_name,grade,curriculum,student_email,school_name,interests,learning_style,additional_notes,student_id,updated_at"
        )
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, student: data });
    } catch (e) {
      console.error("[PUT /students/:id] Error:", e);
      const msg = e?.message || "Server error";
      const isValidation =
        msg.includes("minimal") ||
        msg.includes("Grade") ||
        msg.includes("Learning Style") ||
        msg.includes("PIN") ||
        msg.includes("field") ||
        msg.includes("Student ID");
      return httpError(res, isValidation ? 400 : 500, msg);
    }
  }

  if (req.method === "DELETE") {
    try {
      const existing = await getOwnedStudentOr404({ parentId, studentUuid });
      if (!existing) return httpError(res, 404, "Siswa tidak ditemukan atau sudah dihapus");

      // Cek apakah sudah soft delete sebelumnya (redundant karena getOwnedStudentOr404 sudah filter deleted_at)
      const { error } = await supabase
        .from("students_profile")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", studentUuid)
        .eq("parent_id", parentId)
        .is("deleted_at", null); // pastikan belum dihapus

      if (error) throw error;

      return res.status(200).json({ success: true, message: "Siswa berhasil dihapus (soft delete)" });
    } catch (e) {
      console.error("[DELETE /students/:id] Error:", e);
      return httpError(res, 500, e?.message || "Server error");
    }
  }

  res.setHeader("Allow", "GET,PUT,DELETE");
  return httpError(res, 405, "Method Not Allowed");
}
