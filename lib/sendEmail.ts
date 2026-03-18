import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "proxy.uzmanposta.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendNotificationEmail({
  to,
  taskTitle,
  assignedBy,
  taskId,
}: {
  to: string;
  taskTitle: string;
  assignedBy: string;
  taskId: string;
}) {
  try {
    const taskLink = `https://cahanflow.az/dashboard/tasks?open=${taskId}`;

    const info = await transporter.sendMail({
      from: `"Task Flow" <${process.env.SMTP_EMAIL}>`,
      to,
      subject: `Yeni tapşırıq: ${taskTitle}`,
      html: `
        <div style="font-family:Arial;padding:20px;">
          <h2>🚀 Yeni Tapşırıq</h2>

          <p><b>${taskTitle}</b></p>

          <p><b>Təyin edən:</b> ${assignedBy}</p>

          <a href="${taskLink}" 
            style="display:inline-block;margin-top:10px;padding:10px 16px;background:#4f46e5;color:white;border-radius:8px;text-decoration:none;">
            Tapşırığa bax →
          </a>

          <p style="margin-top:20px;font-size:12px;color:#999;">
            Bu email avtomatik göndərilib
          </p>
        </div>
      `,
    });

    console.log("✅ SMTP Email sent:", info.messageId);

  } catch (err) {
    console.error("❌ SMTP ERROR:", err);
  }
}