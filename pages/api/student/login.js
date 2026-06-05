import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import supabase from '@/lib/supabaseClient';

const STUDENT_LOGIN_MAX_ATTEMPTS = 3;
const STUDENT_LOGIN_BLOCK_MINUTES = 15;
const STUDENT_TOKEN_COOKIE_NAME = 'student_token';
const STUDENT_TOKEN_EXPIRES_IN = '7d';

// In-memory store for failed attempts (will reset on server restart)
// For production, consider using Redis or database
const failedLoginAttempts = new Map(); // key: student_id (6 digit), value: { count, blockedUntil }

function normalizeStudentId(value) {
  return String(value || '').trim();
}

function normalizePin(value) {
  return String(value || '').replace(/\D/g, '');
}

function getJwtSecret() {
  const secret =
    process.env.JWT_SECRET ||
    process.env.AUTH_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error('JWT secret belum dikonfigurasi');
  }

  return secret;
}

function getAttemptState(studentId) {
  const current = failedLoginAttempts.get(studentId);
  if (!current) {
    return { count: 0, blockedUntil: null };
  }
  if (current.blockedUntil && current.blockedUntil <= Date.now()) {
    failedLoginAttempts.delete(studentId);
    return { count: 0, blockedUntil: null };
  }
  return current;
}

function recordFailedAttempt(studentId) {
  const current = getAttemptState(studentId);
  const nextCount = current.count + 1;

  if (nextCount >= STUDENT_LOGIN_MAX_ATTEMPTS) {
    const blockedUntil = Date.now() + STUDENT_LOGIN_BLOCK_MINUTES * 60 * 1000;
    failedLoginAttempts.set(studentId, { count: nextCount, blockedUntil });
    return { count: nextCount, blockedUntil, isBlocked: true };
  }

  failedLoginAttempts.set(studentId, { count: nextCount, blockedUntil: null });
  return { count: nextCount, blockedUntil: null, isBlocked: false };
}

function clearFailedAttempts(studentId) {
  failedLoginAttempts.delete(studentId);
}

function formatBlockMinutes(blockedUntil) {
  const diffMs = Math.max(0, blockedUntil - Date.now());
  return Math.ceil(diffMs / (60 * 1000));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan' });
  }

  try {
    const studentIdInput = normalizeStudentId(req.body?.studentId);
    const pin = normalizePin(req.body?.pin);

    if (!studentIdInput) {
      return res.status(400).json({ success: false, message: 'Student ID wajib diisi' });
    }
    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN wajib diisi' });
    }
    if (!/^\d{6}$/.test(studentIdInput)) {
      return res.status(400).json({ success: false, message: 'Student ID harus 6 digit angka' });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN harus 6 digit angka' });
    }

    // Rate limiting check
    const attemptState = getAttemptState(studentIdInput);
    if (attemptState.blockedUntil && attemptState.blockedUntil > Date.now()) {
      const remainingMinutes = formatBlockMinutes(attemptState.blockedUntil);
      return res.status(429).json({
        success: false,
        message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${remainingMinutes} menit.`,
        data: { blockedUntil: attemptState.blockedUntil, remainingAttempts: 0 }
      });
    }

    // Ambil data siswa + parent (untuk cek is_active)
    const { data: student, error: studentError } = await supabase
      .from('students_profile')
      .select(`
        id,
        student_id,
        student_name,
        parent_id,
        pin_hash,
        deleted_at,
        parent:parent_profile (
          is_active
        )
      `)
      .eq('student_id', studentIdInput)
      .is('deleted_at', null)
      .maybeSingle();

    if (studentError) {
      throw new Error(`Gagal mengambil data siswa: ${studentError.message}`);
    }

    if (!student) {
      // Record failed attempt to prevent brute force
      const failedState = recordFailedAttempt(studentIdInput);
      const remaining = STUDENT_LOGIN_MAX_ATTEMPTS - failedState.count;
      return res.status(401).json({
        success: false,
        message: `Student ID atau PIN salah. Sisa percobaan: ${remaining}.`,
        remainingAttempts: remaining
      });
    }

    // Cek apakah akun parent dibekukan
    const parentIsActive = student.parent?.is_active ?? true;
    if (!parentIsActive) {
      return res.status(403).json({
        success: false,
        message: 'Akun orang tua sedang dibekukan. Hubungi support untuk bantuan.'
      });
    }

    // Verifikasi PIN
    const isPinValid = await bcrypt.compare(pin, student.pin_hash || '');
    if (!isPinValid) {
      const failedState = recordFailedAttempt(studentIdInput);
      const remaining = STUDENT_LOGIN_MAX_ATTEMPTS - failedState.count;
      if (failedState.isBlocked && failedState.blockedUntil) {
        return res.status(429).json({
          success: false,
          message: `Terlalu banyak percobaan gagal. Akun diblokir sementara selama ${STUDENT_LOGIN_BLOCK_MINUTES} menit.`,
          remainingAttempts: 0,
          data: { blockedUntil: failedState.blockedUntil }
        });
      }
      return res.status(401).json({
        success: false,
        message: `Student ID atau PIN salah. Sisa percobaan: ${remaining}.`,
        remainingAttempts: remaining
      });
    }

    // Login berhasil → clear failed attempts
    clearFailedAttempts(studentIdInput);

    const payload = {
      id: student.id,
      student_id: student.student_id,
      name: student.student_name,
      parent_id: student.parent_id,
    };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: STUDENT_TOKEN_EXPIRES_IN });

    res.setHeader(
      'Set-Cookie',
      serialize(STUDENT_TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      redirect: '/student/dashboard'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server';
    console.error('[student-login] Error:', error);
    return res.status(500).json({ success: false, message });
  }
}
