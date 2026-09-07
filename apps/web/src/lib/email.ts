/**
 * Email sending — provider stub.
 *
 * No email provider is wired yet. This module defines the interface and a
 * no-op implementation that logs in development. To enable real sending,
 * pick a provider (SMTP via nodemailer, Resend, ...) and implement sendEmail()
 * below, then set EMAIL_PROVIDER / EMAIL_FROM in the environment.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a single email. Currently a stub: resolves successfully and logs the
 * message in development so notification flows can be exercised end-to-end.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(
      `[email:stub] to=${message.to} subject="${message.subject}" (provider not configured)`,
    );
  }
  // TODO: integrate provider (e.g. nodemailer/resend) when EMAIL_PROVIDER is set.
}
