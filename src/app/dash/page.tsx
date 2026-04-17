"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUI } from "@/lib/ui-context";
import { useRouter } from "next/navigation";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc
} from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";

export default function UserDashboard() {
    const { user, userData, loading, logout, refreshUserData } = useAuth();
    const { showAlert } = useUI();
    const router = useRouter();
    const [pages, setPages] = useState<any[]>([]);
    const [selectedPage, setSelectedPage] = useState<any | null>(null);
    const [fetching, setFetching] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Password change states
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        } else if (user) {
            fetchUserPages();
            if (userData?.requiresPasswordChange) {
                setShowPasswordModal(true);
            }
        }
    }, [user, userData, loading, router]);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showAlert("Erro", "As senhas não coincidem!", "error");
            return;
        }
        if (newPassword.length < 6) {
            showAlert("Erro", "A senha deve ter no mínimo 6 caracteres!", "error");
            return;
        }

        setIsChangingPassword(true);
        try {
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, newPassword);
                await updateDoc(doc(db, "users", user!.uid), {
                    requiresPasswordChange: false
                });
                await refreshUserData();
                showAlert("Sucesso", "Senha alterada com sucesso!", "success");
                setShowPasswordModal(false);
            }
        } catch (error: any) {
            console.error("Error updating password:", error);
            showAlert("Erro", "Erro ao atualizar senha: " + error.message, "error");
        } finally {
            setIsChangingPassword(false);
        }
    };

    const fetchUserPages = async () => {
        if (!user?.email) return;
        setFetching(true);
        try {
            let pagesList: any[] = [];
            
            // se nao tem role ainda (legado) ou se precisamos carregar
            if (userData?.role === 'superadmin') {
                const querySnapshot = await getDocs(collection(db, "pages"));
                pagesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } else if (userData?.role === 'account_admin' || userData?.role === 'account_user') {
                if (userData.accountId) {
                    const q1 = query(collection(db, "pages"), where("accountId", "==", userData.accountId));
                    const querySnapshot = await getDocs(q1);
                    pagesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            } else if (userData?.role === 'subaccount_user') {
                if (userData.subAccountIds && userData.subAccountIds.length > 0) {
                    // split query if subAccountIds > 10 (firebase array-contains-any limit is 10)
                    // assuming here it won't exceed 10 usually, for simplicity
                    const chunk = userData.subAccountIds.slice(0, 10);
                    const q1 = query(collection(db, "pages"), where("subAccountIds", "array-contains-any", chunk));
                    const querySnapshot = await getDocs(q1);
                    pagesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }

            setPages(pagesList);
            if (pagesList.length > 0) {
                setSelectedPage(pagesList[0]);
            }
        } catch (error: any) {
            console.error("Error fetching pages:", error);
            setNotification({ type: "error", message: "Erro ao buscar relatórios: " + (error?.message || "Erro desconhecido") });
        } finally {
            setFetching(false);
        }
    };

    if (loading || (!user && !loading)) {
        return <div className="p-8 text-center">Carregando...</div>;
    }

    return (
        <div className="flex h-[100dvh] bg-[#f5f7fa] overflow-hidden relative">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                absolute md:relative z-50 w-80 h-full bg-white border-r border-gray-200 flex flex-col shadow-sm transition-transform duration-300
                ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}>
                {/* Notificação */}
                {notification && (
                    <div className="fixed top-5 right-5 z-[100]">
                        <div className={`${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px]`}>
                            <div className="flex-1 text-sm">{notification.message}</div>
                            <button onClick={() => setNotification(null)} className="ml-2 bg-white/20 hover:bg-white/30 p-1 rounded-lg cursor-pointer">OK</button>
                        </div>
                    </div>
                )}

                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Meus Relatórios</h2>
                        <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
                    </div>
                    <button
                        className="md:hidden p-2 -mr-2 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
                    {fetching ? (
                        <p className="p-4 text-center text-gray-400">Buscando...</p>
                    ) : pages.length === 0 ? (
                        <p className="p-4 text-center text-gray-400">Nenhum relatório disponível.</p>
                    ) : (
                        pages.map((page) => (
                            <button
                                key={page.id}
                                onClick={() => {
                                    setSelectedPage(page);
                                    setIsSidebarOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer ${selectedPage?.id === page.id
                                    ? "bg-blue-600 text-white shadow-md"
                                    : "hover:bg-gray-50 text-gray-700"
                                    }`}
                            >
                                <div className="font-semibold">{page.title}</div>
                                <div className={`text-xs ${selectedPage?.id === page.id ? "text-blue-100" : "text-gray-400"}`}>
                                    Clique para visualizar
                                </div>
                            </button>
                        ))
                    )}
                </nav>

                <div className="p-4 border-t border-gray-100 flex flex-col gap-2">
                    {userData?.isAdmin && (
                        <button
                            onClick={() => router.push("/admin")}
                            className="w-full text-center px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                            Painel Admin
                        </button>
                    )}
                    <button
                        onClick={() => logout()}
                        className="w-full text-center px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                        Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow flex flex-col h-full">
                {selectedPage ? (
                    <div className="flex-grow p-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-50 flex gap-4 items-center bg-white">
                                <button
                                    className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                                    onClick={() => setIsSidebarOpen(true)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                                <h1 className="text-xl font-bold text-gray-800">{selectedPage.title}</h1>
                            </div>
                            <div className="flex-grow bg-gray-50">
                                <iframe
                                    title={selectedPage.title}
                                    src={selectedPage.embedUrl}
                                    frameBorder="0"
                                    allowFullScreen={true}
                                    className="w-full h-full"
                                ></iframe>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-gray-400 p-10 text-center relative">
                        <div className="absolute top-4 left-4 md:hidden">
                            <button
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg bg-white shadow-sm border border-gray-100"
                                onClick={() => setIsSidebarOpen(true)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                        </div>
                        <div>
                            <div className="text-6xl mb-4">📊</div>
                            <h2 className="text-2xl font-bold text-gray-600">Selecione um relatório</h2>
                            <p className="mt-2 text-sm max-w-xs mx-auto">Escolha uma das opções na barra lateral para visualizar o Power BI.</p>
                            <button
                                className="mt-6 md:hidden px-6 py-2 bg-blue-600 text-white rounded-xl font-medium shadow-sm cursor-pointer active:scale-95 transition-all"
                                onClick={() => setIsSidebarOpen(true)}
                            >
                                Abrir Menu
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-gray-100">
                        <div className="text-center mb-6">
                            <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                                🔑
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Troca de Senha Obrigatória</h2>
                            <p className="text-gray-500 mt-2 text-sm">Este é seu primeiro acesso. Por segurança, defina uma nova senha para sua conta.</p>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Nova Senha</label>
                                <input
                                    required
                                    type="password"
                                    minLength={6}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Confirmar Senha</label>
                                <input
                                    required
                                    type="password"
                                    minLength={6}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    disabled={isChangingPassword}
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                                >
                                    {isChangingPassword ? "Atualizando..." : "Definir Nova Senha"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => logout()}
                                    className="w-full mt-4 text-gray-400 hover:text-gray-600 text-sm font-medium cursor-pointer"
                                >
                                    Sair e trocar depois
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
