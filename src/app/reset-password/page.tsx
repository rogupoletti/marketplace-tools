"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");

    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState<"loading" | "form" | "success" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (mode !== "resetPassword" || !oobCode) {
            setStatus("error");
            setErrorMessage("Link inválido ou expirado.");
            return;
        }

        const verifyCode = async () => {
            try {
                const userEmail = await verifyPasswordResetCode(auth, oobCode);
                setEmail(userEmail);
                setStatus("form");
            } catch (err: any) {
                console.error("Erro ao verificar código:", err);
                setStatus("error");
                setErrorMessage("O link de redefinição é inválido ou já foi utilizado.");
            }
        };

        verifyCode();
    }, [mode, oobCode]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setErrorMessage("As senhas não coincidem.");
            return;
        }
        if (newPassword.length < 6) {
            setErrorMessage("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setIsSubmitting(true);
        setErrorMessage("");

        try {
            await confirmPasswordReset(auth, oobCode!, newPassword);
            setStatus("success");
        } catch (err: any) {
            console.error("Erro ao confirmar reset:", err);
            setErrorMessage("Erro ao redefinir senha. Tente solicitar um novo e-mail.");
            setIsSubmitting(false);
        }
    };

    if (status === "loading") {
        return <div className="text-center p-8">Verificando link...</div>;
    }

    if (status === "error") {
        return (
            <div className="text-center p-8">
                <div className="bg-red-50 text-red-600 p-6 rounded-2xl mb-6">
                    <p className="font-bold mb-2">Ops!</p>
                    <p>{errorMessage}</p>
                </div>
                <Link href="/forgot-password" title="Solicitar novo link" className="text-blue-600 hover:underline font-medium">
                    Solicitar novo link de recuperação
                </Link>
            </div>
        );
    }

    if (status === "success") {
        return (
            <div className="text-center p-8">
                <div className="bg-green-50 text-green-600 p-6 rounded-2xl mb-6">
                    <p className="font-bold mb-2">Sucesso!</p>
                    <p>Sua senha foi alterada com sucesso.</p>
                </div>
                <Link href="/login" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold inline-block hover:bg-blue-700 transition-colors">
                    Ir para o Login
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-md w-full">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Nova Senha</h1>
                <p className="text-gray-600">Defina sua nova senha para <span className="font-semibold text-gray-800">{email}</span></p>
            </div>

            <form onSubmit={handleReset} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nova Senha</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                        placeholder="••••••••"
                        required
                        minLength={6}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Nova Senha</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                        placeholder="••••••••"
                        required
                        minLength={6}
                    />
                </div>

                {errorMessage && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
                        {errorMessage}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                    {isSubmitting ? "Alterando..." : "Alterar Senha"}
                </button>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa] px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center min-h-[400px]">
                <Suspense fallback={<div>Carregando...</div>}>
                    <ResetPasswordContent />
                </Suspense>
            </div>
        </div>
    );
}
