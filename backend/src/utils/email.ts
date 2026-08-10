import { Resend } from 'resend';
import { env } from '../config/env';

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

export const isEmailConfigured = () => !!env.RESEND_API_KEY;

export async function sendVerificationEmail(
  to: string,
  fullName: string,
  token: string
): Promise<void> {
  const verifyUrl = `${env.APP_URL}/verify-email?token=${token}`;
  console.log(`\n==================================================`);
  console.log(`✉️ [VERIFICATION EMAIL GENERATED] Target: ${to}`);
  console.log(`🔗 Verification Link: ${verifyUrl}`);
  console.log(`==================================================\n`);

  const resend = getResend();
  const result = await resend.emails.send({
    from: env.EMAIL_FROM || 'Convee <noreply@convee.app>',
    to,
    subject: 'Verify your Convee account',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid rgba(139,92,246,0.2);border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Convee</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">AI-Powered Collaboration Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:22px;font-weight:600;">
                Welcome, ${fullName}! 👋
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Thanks for signing up for Convee. Please verify your email address to activate your account and start collaborating.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
                  Verify Email Address
                </a>
              </div>
              <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                This link expires in <strong style="color:#94a3b8;">24 hours</strong>. If you didn't create a Convee account, you can safely ignore this email.
              </p>
              <hr style="margin:28px 0;border:none;border-top:1px solid rgba(255,255,255,0.07);" />
              <p style="margin:0;color:#475569;font-size:12px;">
                Or copy and paste this URL into your browser:<br/>
                <a href="${verifyUrl}" style="color:#7c3aed;word-break:break-all;">${verifyUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
              <p style="margin:0;color:#334155;font-size:12px;">© ${new Date().getFullYear()} Convee. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });

  if (result.error) {
    console.error('❌ Resend API Error delivering verification email:', result.error);
    throw new Error(result.error.message || 'Failed to deliver verification email via Resend');
  }
}

export async function sendPasswordResetEmail(
  to: string,
  fullName: string,
  token: string
): Promise<void> {
  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
  console.log(`\n==================================================`);
  console.log(`✉️ [PASSWORD RESET EMAIL GENERATED] Target: ${to}`);
  console.log(`🔗 Reset Link: ${resetUrl}`);
  console.log(`==================================================\n`);

  const resend = getResend();
  const result = await resend.emails.send({
    from: env.EMAIL_FROM || 'Convee <noreply@convee.app>',
    to,
    subject: 'Reset your Convee password',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid rgba(139,92,246,0.2);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">Convee</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:22px;font-weight:600;">Password Reset Request</h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Hi ${fullName}, we received a request to reset your password. Click the button below to set a new one.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">
                  Reset Password
                </a>
              </div>
              <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                This link expires in <strong style="color:#94a3b8;">1 hour</strong>. If you didn't request this, please ignore this email — your password won't change.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
              <p style="margin:0;color:#334155;font-size:12px;">© ${new Date().getFullYear()} Convee. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });

  if (result.error) {
    console.error('❌ Resend API Error delivering password reset email:', result.error);
    throw new Error(result.error.message || 'Failed to deliver password reset email via Resend');
  }
}

export async function verifyEmailDomain(email: string): Promise<{ valid: boolean; reason?: string }> {
  if (!email || !email.trim()) {
    return { valid: false, reason: 'Email address cannot be empty' };
  }
  const cleanEmail = email.trim().toLowerCase();

  // 1. Syntax Format Check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleanEmail)) {
    return { valid: false, reason: 'Invalid email address syntax (e.g. user@example.com)' };
  }

  // 2. DNS MX Record Lookup via DNS over HTTPS
  const domain = cleanEmail.split('@')[1];
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`);
    const data: any = await res.json();

    if (data.Status === 3 || (data.Status === 0 && (!data.Answer || data.Answer.length === 0))) {
      return { valid: false, reason: `The email domain @${domain} does not exist or has no active mail server.` };
    }
  } catch (err) {
    // If DNS service network error, fallback to format validation
  }

  return { valid: true };
}
