import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendNotificationEmail = async (to: string, subject: string, text: string) => {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.warn("⚠️ Gmailの認証情報が設定されていないため、モック出力します:", { to, subject, text });
      return;
    }
    await transporter.sendMail({
      from: `"買付承認システム" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`Email sent successfully to: ${to}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
};
