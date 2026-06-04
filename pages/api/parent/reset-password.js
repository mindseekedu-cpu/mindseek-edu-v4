import bcrypt from 'bcryptjs';
import supabase from '@/lib/supabaseClient';

const INVALID_TOKEN_RESPONSE = {
  success: false,
  message: 'Token tidak valid atau sudah kadaluarsa.',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  try {
    const token =
      typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword =
      typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!token) {
      return res.status(400).json(INVALID_TOKEN_RESPONSE);
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 8 karakter.',
      });
    }

    const nowIso = new Date().toISOString();

    const { data: resetRow, error: resetError } = await supabase
      .from('password_resets')
      .select('id, parent_id, token, expires_at, used_at')
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (resetError) {
      console.error('[parent/reset-password] Reset token lookup error:', resetError);
      return res.status(400).json(INVALID_TOKEN_RESPONSE);
    }

    if (!resetRow?.id || !resetRow?.parent_id) {
      return res.status(400).json(INVALID_TOKEN_RESPONSE);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const { error: updateParentError } = await supabase
      .from('parent_profile')
      .update({
        password_hash: passwordHash,
      })
      .eq('id', resetRow.parent_id);

    if (updateParentError) {
      console.error(
        '[parent/reset-password] Parent password update error:',
        updateParentError
      );
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mereset password.',
      });
    }

    const usedAt = new Date().toISOString();

    const { error: markUsedError } = await supabase
      .from('password_resets')
      .update({
        used_at: usedAt,
      })
      .eq('id', resetRow.id);

    if (markUsedError) {
      console.error(
        '[parent/reset-password] Mark token used error:',
        markUsedError
      );
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mereset password.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password berhasil direset. Silakan login.',
    });
  } catch (error) {
    console.error('[parent/reset-password] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mereset password.',
    });
  }
}