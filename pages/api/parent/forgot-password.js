import crypto from 'crypto';
import sgMail from '@sendgrid/mail';
import supabase from '@/lib/supabaseClient';

const SUCCESS_RESPONSE = {
  success: true,
  message: 'Jika email terdaftar, link reset akan dikirim.',
};

function getBaseAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
}

async function sendResetPasswordEmail({ to, token }) {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  const appUrl = getBaseAppUrl();

  if (!sendgridApiKey || !fromEmail || !appUrl) {
    console.error(
      '[parent/forgot-password] Missing email env:',
      JSON.stringify({
        hasSendgridApiKey: Boolean(sendgridApiKey),
        hasFromEmail: Boolean(fromEmail),
        hasAppUrl: Boolean(appUrl),
      })
    );
    return;
  }

  sgMail.setApiKey(sendgridApiKey);

  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  await sgMail.send({
    to,
    from: fromEmail,
    subject: 'Reset Password MindSeek Edu',
    text: `Halo,

Kami menerima permintaan untuk reset password akun parent Anda.

Klik link berikut untuk membuat password baru:
${resetUrl}

Link ini berlaku selama 1 jam.

Jika Anda tidak meminta reset password, abaikan email ini.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 16px;">Reset Password</h2>
        <p>Halo,</p>
        <p>Kami menerima permintaan untuk reset password akun parent Anda.</p>
        <p>Klik link berikut untuk membuat password baru:</p>
        <p style="margin: 24px 0;">
          <a
            href="${resetUrl}"
            style="display: inline-block; padding: 12px 20px; background: #0284c7; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;"
          >
            Reset Password
          </a>
        </p>
        <p>Atau buka link berikut secara manual:</p>
        <p>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p>Link ini berlaku selama <strong>1 jam</strong>.</p>
        <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
      </div>
    `,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  try {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    if (!email) {
      return res.status(200).json(SUCCESS_RESPONSE);
    }

    const { data: parent, error: parentError } = await supabase
      .from('parent_profile')
      .select('id, email')
      .ilike('email', email)
      .eq('is_email_verified', true)
      .maybeSingle();

    if (parentError) {
      console.error('[parent/forgot-password] Parent lookup error:', parentError);
      return res.status(200).json(SUCCESS_RESPONSE);
    }

    if (!parent?.id || !parent?.email) {
      return res.status(200).json(SUCCESS_RESPONSE);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const createdAt = now.toISOString();

    const { error: insertError } = await supabase.from('password_resets').insert({
      parent_id: parent.id,
      token,
      expires_at: expiresAt,
      created_at: createdAt,
    });

    if (insertError) {
      console.error(
        '[parent/forgot-password] Insert reset token error:',
        insertError
      );
      return res.status(200).json(SUCCESS_RESPONSE);
    }

    try {
      await sendResetPasswordEmail({
        to: parent.email,
        token,
      });
    } catch (emailError) {
      console.error(
        '[parent/forgot-password] Send reset email error:',
        emailError
      );
    }

    return res.status(200).json(SUCCESS_RESPONSE);
  } catch (error) {
    console.error('[parent/forgot-password] Unexpected error:', error);
    return res.status(200).json(SUCCESS_RESPONSE);
  }
}