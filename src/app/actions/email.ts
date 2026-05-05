"use server";

import { adminAuth } from "@/lib/firebase-admin";
import { resend } from "@/lib/resend";

const BRAND_NAME = "Seller Dock";
const FROM_EMAIL = `Seller Dock <suporte@account.sellerdock.com.br>`;

type EmailType = 'reset' | 'welcome';

export async function sendPasswordResetEmailAction(email: string, origin: string, type: EmailType = 'reset') {
  try {
    const actionCodeSettings = {
      url: `${origin}/login`,
      handleCodeInApp: false,
    };

    // Gera o link de redefinição de senha via Firebase Admin
    const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

    const isWelcome = type === 'welcome';
    
    const subject = isWelcome 
      ? `Bem-vindo ao ${BRAND_NAME} - Configure sua senha`
      : `Redefinir sua senha - ${BRAND_NAME}`;

    const title = isWelcome ? "Boas-vindas!" : "Olá,";
    
    const message = isWelcome
      ? `Sua conta no <strong>${BRAND_NAME}</strong> foi criada com sucesso pelo administrador. Para começar a usar a plataforma, você precisa definir sua senha de acesso.`
      : `Recebemos uma solicitação para redefinir a senha da sua conta no <strong>${BRAND_NAME}</strong>.`;

    const buttonLabel = isWelcome ? "Definir Minha Senha" : "Redefinir Minha Senha";
    
    const footerMessage = isWelcome
      ? `Se você não esperava este convite, pode ignorar este e-mail.`
      : `Se você não solicitou essa alteração, pode ignorar este e-mail com segurança. O link expirará em breve por motivos de segurança.`;

    // Envia o e-mail via Resend
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-bottom: 24px;">${title}</h2>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 24px;">
            ${message}
          </p>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 32px;">
            Clique no botão abaixo para prosseguir:
          </p>
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              ${buttonLabel}
            </a>
          </div>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 24px;">
            ${footerMessage}
          </p>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 24px;">
            Caso o botão acima não funcione, copie e cole o link abaixo no seu navegador:<br/>
            <span style="word-break: break-all; color: #2563eb; font-size: 12px;">${resetLink}</span>
          </p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 24px; margin-top: 32px;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            &copy; ${new Date().getFullYear()} ${BRAND_NAME}. Todos os direitos reservados.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error sending email:", error);
    if (error.code === 'auth/user-not-found') {
        return { success: false, error: 'Usuário não encontrado.' };
    }
    return { success: false, error: error.message };
  }
}
