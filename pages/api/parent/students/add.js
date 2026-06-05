import bcrypt from 'bcryptjs';
import supabase from '@/lib/supabaseClient';
import { getAuthenticatedParent } from '@/lib/auth';

const STUDENTS_TABLE = process.env.STUDENTS_TABLE_NAME || 'students_profile';
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const LEARNING_STYLE_OPTIONS = ['Visual', 'Auditori', 'Kinestetik', 'BacaTulis', 'Campuran'];

// Paket dan batasan maksimal siswa
const PACKAGE_LIMITS = {
  starter: 1,
  free: 1,
  smart_parent: 1,
  smart_family: 5,
};

function generateRandomStudentId(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

function normalizeOptionalText(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function validateRequestBody(body) {
  const errors = {};
  const studentName = String(body?.student_name || '').trim();
  const grade = Number(body?.grade);
  const pin = String(body?.pin || '').trim();
  const confirmPin = String(body?.confirmPin || '').trim();
  const studentEmail = String(body?.student_email || '').trim();
  const learningStyle = String(body?.learning_style || 'Campuran').trim() || 'Campuran';

  if (!studentName) {
    errors.student_name = 'Student Name wajib diisi.';
  } else if (studentName.length < 3) {
    errors.student_name = 'Student Name minimal 3 karakter.';
  }

  if (!body?.grade && body?.grade !== 0) {
    errors.grade = 'Grade wajib diisi.';
  } else if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
    errors.grade = 'Grade harus berupa angka 1 sampai 12.';
  }

  if (!pin) {
    errors.pin = 'PIN wajib diisi.';
  } else if (!/^\d{6}$/.test(pin)) {
    errors.pin = 'PIN harus 6 digit angka.';
  }

  if (confirmPin && confirmPin !== pin) {
    errors.confirmPin = 'Konfirmasi PIN tidak cocok.';
  }

  if (studentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
    errors.student_email = 'Format Student Email tidak valid.';
  }

  if (!LEARNING_STYLE_OPTIONS.includes(learningStyle)) {
    errors.learning_style = 'Learning Style tidak valid.';
  }

  return {
    errors,
    sanitized: {
      student_name: studentName,
      grade,
      pin,
      curriculum: String(body?.curriculum || '').trim() || 'Kurikulum Merdeka',
      student_email: normalizeOptionalText(studentEmail),
      school_name: normalizeOptionalText(body?.school_name),
      interests: normalizeOptionalText(body?.interests),
      learning_style: learningStyle,
      additional_notes: normalizeOptionalText(body?.additional_notes),
    },
  };
}

async function getParentSubscriptionInfo(parentId) {
  const { data, error } = await supabase
    .from('parent_profile')
    .select('subscription_tier, id')
    .eq('id', parentId)
    .single();

  if (error) {
    throw new Error(`Gagal mengambil data paket parent: ${error.message}`);
  }
  return data;
}

async function countActiveStudents(parentId) {
  const { count, error } = await supabase
    .from(STUDENTS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', parentId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Gagal menghitung jumlah siswa: ${error.message}`);
  }
  return count || 0;
}

async function generateUniqueStudentId(maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateRandomStudentId(6);

    const { data: existingStudent, error } = await supabase
      .from(STUDENTS_TABLE)
      .select('id, student_id')
      .eq('student_id', candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Gagal memeriksa student ID unik.');
    }

    if (!existingStudent) {
      return candidate;
    }
  }

  // Fallback: gunakan 7 digit
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateRandomStudentId(7);
    const { data: existingStudent, error } = await supabase
      .from(STUDENTS_TABLE)
      .select('id, student_id')
      .eq('student_id', candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Gagal memeriksa student ID unik (7 digit).');
    }

    if (!existingStudent) {
      return candidate;
    }
  }

  throw new Error('Gagal menghasilkan student ID unik setelah 15 percobaan. Silakan coba lagi.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: 'Method tidak diizinkan.',
    });
  }

  try {
    const { parentId } = await getAuthenticatedParent(req);
    const { errors, sanitized } = validateRequestBody(req.body || {});

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validasi input gagal.',
        errors,
      });
    }

    // 1. Ambil info subscription parent
    const parentInfo = await getParentSubscriptionInfo(parentId);
    const tier = (parentInfo.subscription_tier || 'starter').toLowerCase();
    const maxStudents = PACKAGE_LIMITS[tier] || 1;

    // 2. Hitung jumlah siswa aktif saat ini
    const currentStudents = await countActiveStudents(parentId);

    if (currentStudents >= maxStudents) {
      let tierDisplay = tier === 'smart_parent' ? 'Smart Parent' : tier === 'smart_family' ? 'Smart Family' : 'Starter';
      return res.status(403).json({
        success: false,
        message: `Paket ${tierDisplay} maksimal ${maxStudents} siswa. Silakan upgrade paket untuk menambah siswa lebih banyak.`,
      });
    }

    // 3. Hash PIN
    const pinHash = await bcrypt.hash(sanitized.pin, BCRYPT_SALT_ROUNDS);

    // 4. Generate Student ID unik (6 digit, fallback 7 digit)
    let studentId;
    try {
      studentId = await generateUniqueStudentId(10);
    } catch (idError) {
      return res.status(500).json({
        success: false,
        message: idError.message || 'Gagal menghasilkan Student ID.',
      });
    }

    const insertPayload = {
      parent_id: parentId,
      student_name: sanitized.student_name,
      grade: sanitized.grade,
      pin_hash: pinHash,
      curriculum: sanitized.curriculum,
      student_email: sanitized.student_email,
      school_name: sanitized.school_name,
      interests: sanitized.interests,
      learning_style: sanitized.learning_style,
      additional_notes: sanitized.additional_notes,
      student_id: studentId,
    };

    const { data: createdStudent, error: insertError } = await supabase
      .from(STUDENTS_TABLE)
      .insert(insertPayload)
      .select('id, student_name, grade, student_id')
      .single();

    if (insertError) {
      // Cek kemungkinan duplicate student_id (race condition)
      if (insertError.code === '23505' && insertError.message.includes('student_id')) {
        return res.status(409).json({
          success: false,
          message: 'Student ID bentrok. Silakan coba lagi.',
        });
      }
      throw new Error(insertError.message || 'Gagal menyimpan data siswa.');
    }

    return res.status(201).json({
      success: true,
      message: 'Siswa berhasil ditambahkan.',
      student: createdStudent,
    });
  } catch (error) {
    const message = error?.message || 'Terjadi kesalahan pada server.';
    const unauthorizedMessages = [
      'Token tidak ditemukan.',
      'Token valid tetapi parent_id tidak ditemukan.',
      'Parent tidak ditemukan atau tidak aktif.',
      'signature verification failed',
      'jwt expired',
      '"exp" claim timestamp check failed',
      '"nbf" claim timestamp check failed',
    ];

    const isUnauthorized = unauthorizedMessages.some((item) =>
      String(message).toLowerCase().includes(String(item).toLowerCase())
    );

    return res.status(isUnauthorized ? 401 : 500).json({
      success: false,
      message,
    });
  }
}
