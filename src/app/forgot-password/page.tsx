"use client";

import { useState } from "react";
import { sendPasswordResetEmailAction } from "@/app/actions/email";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");
        try {
            const result = await sendPasswordResetEmailAction(email, window.location.origin);
            
            if (result.success) {
                setMessage("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
                setEmail("");
            } else {
                setError(result.error || "Erro ao enviar e-mail. Tente novamente mais tarde.");
            }
        } catch (err: any) {
            console.error(err);
            setError("Ocorreu um erro inesperado. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa] px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Recuperar Senha</h1>
                    <p className="text-gray-600">Enviaremos um link para você definir uma nova senha</p>
                </div>

                <form onSubmit={handleReset} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                            placeholder="seu@email.com"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-50 text-green-600 p-4 rounded-xl text-sm">
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                        {loading ? "Enviando..." : "Enviar E-mail"}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-gray-600">
                    <Link href="/login" className="text-blue-600 hover:underline font-medium cursor-pointer">
                        Voltar para o Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
