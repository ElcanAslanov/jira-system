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
  type = "created",          // ✅ NEW
  status,                    // ✅ NEW
}: {
  to: string;
  taskTitle: string;
  assignedBy: string;
  taskId: string;
  type?: "created" | "status_update" | "comment"; // ✅ NEW
  status?: string;                                 // ✅ NEW
}) {
  try {
    const taskLink = `https://cahanflow.az/dashboard/tasks?open=${taskId}`;

    let subject = "";
    let html = "";

    // ================= CREATED =================
    if (type === "created") {
      subject = `Yeni tapşırıq: ${taskTitle}`;
      html = `
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
      `;
    }

    // ================= STATUS UPDATE =================
    if (type === "status_update") {
  subject = `Task status dəyişdi: ${taskTitle}`;

  html = `
    <div style="font-family:Arial, sans-serif; background:#f9fafb; padding:24px;">
      <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">

        <h2 style="margin:0 0 12px 0; color:#111827;">
          🔄 Status dəyişdi
        </h2>

        <p style="margin:0 0 8px 0; color:#374151;">
          <b>${assignedBy}</b> taskın statusunu dəyişdi
        </p>

        <p style="margin:0 0 8px 0;">
          <b>Task:</b> ${taskTitle}
        </p>

        <p style="margin:0 0 16px 0;">
          <b>Yeni status:</b> 
          <span style="color:#16a34a; font-weight:600;">
            ${status}
          </span>
        </p>

        <a href="${taskLink}" 
          style="
            display:inline-block;
            padding:10px 16px;
            background:#16a34a;
            color:#ffffff;
            border-radius:8px;
            text-decoration:none;
            font-weight:600;
          ">
          Tapşırığa bax →
        </a>

        <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;" />

        <p style="font-size:12px; color:#9ca3af; margin:0;">
          Bu email avtomatik göndərilib
        </p>

      </div>
    </div>
  `;
}

    // ================= COMMENT =================
    if (type === "comment") {
      subject = `Yeni rəy: ${taskTitle}`;
      html = `
        <div style="font-family:Arial;padding:20px;">
          <h2>💬 Yeni rəy yazıldı</h2>

          <p><b>${assignedBy}</b> task-a rəy yazdı</p>
          <p><b>Task:</b> ${taskTitle}</p>

          <a href="${taskLink}" 
            style="display:inline-block;margin-top:10px;padding:10px 16px;background:#f59e0b;color:white;border-radius:8px;text-decoration:none;">
            Rəylərə bax →
          </a>

          <p style="margin-top:20px;font-size:12px;color:#999;">
            Bu email avtomatik göndərilib
          </p>
        </div>
      `;
    }

    const info = await transporter.sendMail({
      from: `"Task Flow" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html,
    });

    console.log("✅ SMTP Email sent:", info.messageId);
  } catch (err) {
    console.error("❌ SMTP ERROR:", err);
  }
}