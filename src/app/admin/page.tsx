"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    setDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminDashboard() {
    const { user, userData, loading, logout } = useAuth();
    const router = useRouter();
    const [pages, setPages] = useState<any[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newPage, setNewPage] = useState<{ title: string; embedUrl: string; allowedUsers: string[] }>({
        title: "",
        embedUrl: "",
        allowedUsers: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingPageId, setEditingPageId] = useState<string | null>(null);

    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ email: "", password: "", isAdmin: false });
    const [isSubmittingUser, setIsSubmittingUser] = useState(false);

    const [activeTab, setActiveTab] = useState<"pages" | "users">("pages");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (!loading) {
            if (!user) {
                // Not logged in at all
                router.push("/login");
            } else if (userData?.isAdmin) {
                // Logged in and is admin
                fetchPages();
                fetchUsers();
            }
            // If logged in but not admin, we stay here and render the "Acesso Negado" UI
        }
    }, [user, userData, loading, router]);

    const fetchPages = async () => {
        const querySnapshot = await getDocs(collection(db, "pages"));
        const pagesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPages(pagesList);
    };

    const fetchUsers = async () => {
        const querySnapshot = await getDocs(collection(db, "users"));
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsersList(list);
    };

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingPageId) {
                await updateDoc(doc(db, "pages", editingPageId), {
                    title: newPage.title,
                    embedUrl: newPage.embedUrl,
                    allowedUsers: newPage.allowedUsers,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await addDoc(collection(db, "pages"), {
                    title: newPage.title,
                    embedUrl: newPage.embedUrl,
                    allowedUsers: newPage.allowedUsers,
                    createdAt: new Date().toISOString()
                });
            }

            setNewPage({ title: "", embedUrl: "", allowedUsers: [] });
            setEditingPageId(null);
            setShowAddModal(false);
            fetchPages();
        } catch (error) {
            console.error("Error saving page:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditPage = (page: any) => {
        setNewPage({
            title: page.title,
            embedUrl: page.embedUrl,
            allowedUsers: Array.isArray(page.allowedUsers) ? page.allowedUsers : []
        });
        setEditingPageId(page.id);
        setShowAddModal(true);
    };

    const toggleUserPageAccess = (email: string) => {
        setNewPage(prev => {
            const allowed = prev.allowedUsers.includes(email)
                ? prev.allowedUsers.filter(e => e !== email)
                : [...prev.allowedUsers, email];
            return { ...prev, allowedUsers: allowed };
        });
    };

    const handleDeletePage = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir esta página?")) {
            await deleteDoc(doc(db, "pages", id));
            fetchPages();
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newUser.email.toLowerCase() === user?.email?.toLowerCase()) {
            alert("Erro: Você não pode criar um usuário com o mesmo e-mail do administrador logado.");
            setIsSubmittingUser(false);
            return;
        }

        setIsSubmittingUser(true);

        try {
            const firebaseConfig = {
                apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
            };

            const secondaryAppName = `tempSecondaryApp_${Date.now()}`;
            const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
            const newUid = userCredential.user.uid;

            await setDoc(doc(db, "users", newUid), {
                email: newUser.email,
                isAdmin: newUser.isAdmin,
                requiresPasswordChange: true,
                createdAt: new Date().toISOString()
            });

            await deleteApp(secondaryApp);

            alert("Usuário criado com sucesso!");
            setNewUser({ email: "", password: "", isAdmin: false });
            setShowUserModal(false);
        } catch (error: any) {
            console.error("Error creating user:", error);
            if (error.code === "auth/email-already-in-use") {
                alert("Erro: Este e-mail já está em uso no Firebase Authentication. \n\nSe você não vê este usuário na aba 'Usuários', significa que ele existe no Auth mas não no Firestore. \n\nSolução: Vá ao Console do Firebase, exclua esse usuário na aba Authentication e tente criá-lo novamente aqui.");
            } else {
                alert("Erro ao criar usuário: " + error.message);
            }
        } finally {
            setIsSubmittingUser(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                    <p className="text-gray-600 font-medium">Carregando painel...</p>
                </div>
            </div>
        );
    }

    if (!userData?.isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa] px-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="text-6xl mb-6">🔒</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
                    <p className="text-gray-600 mb-8">
                        Você não tem permissões de administrador para acessar esta área.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => router.push("/dash")}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all"
                        >
                            Ir para Meus Relatórios
                        </button>
                        <button
                            onClick={() => {
                                useAuth().logout();
                                router.push("/login");
                            }}
                            className="w-full text-gray-600 hover:text-gray-900 font-medium py-2"
                        >
                            Sair e entrar com outra conta
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Painel de Administração</h1>
                    <p className="mt-2 text-gray-600">Gerencie as páginas de relatórios e acessos</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowUserModal(true)}
                        className="bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                        + Novo Usuário
                    </button>
                    <button
                        onClick={() => {
                            setEditingPageId(null);
                            setNewPage({ title: "", embedUrl: "", allowedUsers: [] });
                            setShowAddModal(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                        + Nova Página
                    </button>
                </div>
            </div>

            <div className="flex border-b border-gray-200 mb-8">
                <button
                    onClick={() => setActiveTab("pages")}
                    className={`px-6 py-3 font-semibold transition-colors cursor-pointer ${activeTab === "pages" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                    Páginas ({pages.length})
                </button>
                <button
                    onClick={() => setActiveTab("users")}
                    className={`px-6 py-3 font-semibold transition-colors cursor-pointer ${activeTab === "users" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                    Usuários ({usersList.length})
                </button>
            </div>

            {activeTab === "pages" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pages.map((page) => (
                        <div key={page.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{page.title}</h3>
                            <p className="text-sm text-gray-500 mb-4 truncate italic">{page.embedUrl}</p>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {page.allowedUsers?.map((user: string, idx: number) => (
                                    <span key={idx} className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-md">
                                        {user}
                                    </span>
                                ))}
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-50">
                                <button
                                    onClick={() => handleEditPage(page)}
                                    className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors cursor-pointer"
                                    title="Editar"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleDeletePage(page.id)}
                                    className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Excluir"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600 text-sm uppercase">
                                <th className="px-6 py-4 font-bold">Email</th>
                                <th className="px-6 py-4 font-bold">Função</th>
                                <th className="px-6 py-4 font-bold">Criado em</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {usersList.map((usr) => (
                                <tr key={usr.id} className="hover:bg-gray-50 transition-colors cursor-default">
                                    <td className="px-6 py-4 font-medium text-gray-900">{usr.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${usr.isAdmin ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}>
                                            {usr.isAdmin ? "Administrador" : "Cliente"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {usr.createdAt ? new Date(usr.createdAt).toLocaleDateString("pt-BR") : "-"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
                        <h2 className="text-2xl font-bold mb-6">
                            {editingPageId ? "Editar Página" : "Criar Nova Página"}
                        </h2>
                        <form onSubmit={handleCreatePage} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Título</label>
                                <input
                                    required
                                    type="text"
                                    value={newPage.title}
                                    onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">URL do Embed Power BI</label>
                                <input
                                    required
                                    type="text"
                                    value={newPage.embedUrl}
                                    onChange={(e) => setNewPage({ ...newPage, embedUrl: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Usuários Permitidos (Selecione na lista abaixo)</label>
                                <div className="mt-2 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Pesquisar usuário..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                                <div className="border rounded-xl max-h-60 overflow-y-auto divide-y divide-gray-50">
                                    {usersList
                                        .filter(u => u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .map((u) => (
                                            <label key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={newPage.allowedUsers.includes(u.email)}
                                                    onChange={() => toggleUserPageAccess(u.email)}
                                                    className="w-4 h-4 rounded text-blue-600"
                                                />
                                                <div className="flex-grow">
                                                    <p className="text-sm font-medium text-gray-900">{u.email}</p>
                                                    {u.isAdmin && <span className="text-[10px] bg-purple-50 text-purple-600 px-1 rounded">Admin</span>}
                                                </div>
                                            </label>
                                        ))}
                                    {usersList.length === 0 && (
                                        <p className="p-4 text-center text-gray-400 text-sm">Nenhum usuário cadastrado.</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setShowUserModal(true);
                                    }}
                                    className="mt-3 text-sm text-blue-600 hover:underline font-medium"
                                >
                                    + Criar um novo usuário agora
                                </button>
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-2 text-gray-600 font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={isSubmitting}
                                    type="submit"
                                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold"
                                >
                                    {isSubmitting ? "Salvando..." : editingPageId ? "Salvar Alterações" : "Criar Página"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
                        <h2 className="text-2xl font-bold mb-6">Criar Novo Usuário</h2>
                        <form onSubmit={(e) => {
                            handleCreateUser(e).then(() => {
                                fetchUsers(); // Refresh list after creation
                                if (editingPageId) setShowAddModal(true); // Return to page modal if we were there
                            });
                        }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Senha (mínimo 6 caracteres)</label>
                                <input
                                    required
                                    type="password"
                                    minLength={6}
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl"
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <input
                                    type="checkbox"
                                    id="isAdmin"
                                    checked={newUser.isAdmin}
                                    onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor="isAdmin" className="text-sm font-medium">Conta de Administrador</label>
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowUserModal(false)}
                                    className="px-6 py-2 text-gray-600 font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={isSubmittingUser}
                                    type="submit"
                                    className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold"
                                >
                                    {isSubmittingUser ? "Criando..." : "Criar Usuário"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
