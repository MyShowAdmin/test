import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPaidImagesEmail({ to, signedUrls }) {
    const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6">
      <h2>🎉 Vos cartes personnalisées sont prêtes</h2>
  
      <p>Vos images sont disponibles au téléchargement pendant <strong>72 heures</strong>.</p>
  
      <ul>
        ${signedUrls
          .map(
            (url, i) => `
              <li style="margin-bottom: 10px">
                <a 
                  href="${url}"
                  style="
                    display: inline-block;
                    padding: 10px 16px;
                    background: #4f46e5;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: bold;
                  "
                >
                  Télécharger l’image ${i + 1}
                </a>
              </li>
            `
          )
          .join("")}
      </ul>
  
      <p style="font-size: 14px; color: #555">
        ⏳ Les liens expirent automatiquement après 72h.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to,
    subject: "Vos cartes personnalisées sont prêtes",
    html
  });
}