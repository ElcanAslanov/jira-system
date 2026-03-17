import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const taskLink = `https://jira-system.netlify.app/dashboard/tasks?task=${taskId}`;

    await resend.emails.send({
     from: "Task Flow <corporate@cahannet.com>",
      to,
      subject: taskTitle,

      html: `
      <div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
        
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
          <tr>
            <td align="center">

              <table width="520" cellpadding="0" cellspacing="0" style="
                background:#ffffff;
                border-radius:12px;
                box-shadow:0 10px 30px rgba(0,0,0,0.08);
                overflow:hidden;
              ">

                <!-- HEADER -->
                <tr>
                  <td style="
                    background:linear-gradient(135deg,#4f46e5,#6366f1);
                    color:white;
                    padding:20px;
                    text-align:center;
                    font-size:20px;
                    font-weight:bold;
                  ">
                    🚀 Task Flow
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td style="padding:30px; color:#111827;">

                    <div style="font-size:14px;color:#6b7280;margin-bottom:10px;">
                      Sizə yeni tapşırıq təyin edildi
                    </div>

                    <h2 style="margin:0 0 15px;font-size:20px;">
                      ${taskTitle}
                    </h2>

                    <div style="
                      background:#f9fafb;
                      border:1px solid #e5e7eb;
                      border-radius:8px;
                      padding:15px;
                      margin-bottom:20px;
                      font-size:14px;
                    ">
                      <strong>Təyin edən:</strong> ${assignedBy}
                    </div>

                    <div style="text-align:center;margin-top:25px;">
                      <a href="${taskLink}"
                        style="
                          display:inline-block;
                          background:#4f46e5;
                          color:white;
                          text-decoration:none;
                          padding:12px 24px;
                          border-radius:8px;
                          font-size:14px;
                          font-weight:600;
                        ">
                        Tapşırığa bax →
                      </a>
                    </div>

                  </td>
                </tr>

                <tr>
                  <td style="
                    background:#f9fafb;
                    padding:15px;
                    text-align:center;
                    font-size:12px;
                    color:#9ca3af;
                  ">
                    Bu email avtomatik göndərilmişdir • Task Flow
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>

      </div>
      `,
    });

    console.log("✅ Email sent via Resend:", to);

  } catch (err) {
    console.error("❌ Resend error:", err);
  }
}