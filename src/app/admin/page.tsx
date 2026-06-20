"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUI } from "@/lib/ui-context";
import { useRouter } from "next/navigation";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { sendPasswordResetEmailAction } from "@/app/actions/email";
import { Edit3, KeyRound, Mail, Trash2 } from "lucide-react";
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    setDoc,
    getDoc,
    query,
    where
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type AdminUserRow = {
    id: string;
    email?: string;
    role?: string;
    accountId?: string;
    subAccountIds?: string[];
    isAdmin?: boolean;
};

type PageRow = {
    id: string;
    title: string;
    embedUrl: string;
    accountId: string;
    subAccountIds?: string[];
};

type AccountRow = {
    id: string;
    name: string;
};

type SubaccountRow = {
    id: string;
    name: string;
    accountId: string;
};

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Erro desconhecido";
}

function getErrorCode(error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error) {
        const code = (error as { code?: unknown }).code;
        return typeof code === "string" ? code : undefined;
    }
    return undefined;
}

function ActionIconButton({
    label,
    onClick,
    className,
    children
}: {
    label: string;
    onClick: () => void;
    className: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
        >
            {children}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block">
                {label}
            </span>
        </button>
    );
}

export default function AdminDashboard() {
    const { user, userData, loading } = useAuth();
    const { showConfirm } = useUI();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<"pages" | "users" | "accounts" | "subaccounts">("pages");
    const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
    
    // Data States
    const [pages, setPages] = useState<PageRow[]>([]);
    const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [subaccounts, setSubaccounts] = useState<SubaccountRow[]>([]);

    // Modals visibility
    const [showPageModal, setShowPageModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showSubaccountModal, setShowSubaccountModal] = useState(false);
    const [showTemporaryPasswordModal, setShowTemporaryPasswordModal] = useState(false);

    // Form States
    const [newPage, setNewPage] = useState<{ title: string; embedUrl: string; accountId: string; subAccountIds: string[] }>({
        title: "", embedUrl: "", accountId: "", subAccountIds: []
    });
    const [editingPageId, setEditingPageId] = useState<string | null>(null);

    const [newUser, setNewUser] = useState({ email: "", role: "account_user", accountId: "", subAccountIds: [] as string[] });
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [temporaryPasswordUser, setTemporaryPasswordUser] = useState<AdminUserRow | null>(null);
    const [temporaryPasswordForm, setTemporaryPasswordForm] = useState({ password: "", confirmPassword: "" });

    const [newAccount, setNewAccount] = useState({ name: "" });
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

    const [newSubaccount, setNewSubaccount] = useState({ name: "", accountId: "" });
    const [editingSubaccountId, setEditingSubaccountId] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
            } else if (userData?.role === 'superadmin' || userData?.role === 'account_admin' || userData?.isAdmin) {
                fetchData();
            }
        }
    }, [user, userData, loading, router]);

    const showNotification = (type: "success" | "error", message: string) => {
        setNotification({ type, message });
        if (type === "success") {
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const fetchData = async () => {
        try {
            await fetchAccounts();
            await fetchSubaccounts();
            await fetchPages();
            await fetchUsers();
        } catch (error: unknown) {
            console.error("Error fetching data:", error);
            showNotification("error", "Erro ao carregar dados: " + getErrorMessage(error));
        }
    };

    const isSuper = userData?.role === 'superadmin' || userData?.isAdmin === true;
    const canSetTemporaryPassword = (targetUser: AdminUserRow) => {
        if (targetUser.id === user?.uid) return false;
        if (isSuper) return true;
        if (userData?.role !== 'account_admin') return false;
        return targetUser.accountId === userData?.accountId && (targetUser.role === 'account_user' || targetUser.role === 'subaccount_user');
    };

    const fetchAccounts = async () => {
        if (isSuper) {
            const querySnapshot = await getDocs(collection(db, "accounts"));
            setAccounts(querySnapshot.docs.map(document => ({ id: document.id, ...(document.data() as Omit<AccountRow, "id">) })));
        } else if (userData?.accountId) {
            const docRef = doc(db, "accounts", userData.accountId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setAccounts([{ id: docSnap.id, ...(docSnap.data() as Omit<AccountRow, "id">) }]);
            } else {
                setAccounts([]);
            }
        }
    };

    const fetchSubaccounts = async () => {
        const q = isSuper
            ? collection(db, "subaccounts")
            : query(collection(db, "subaccounts"), where("accountId", "==", userData?.accountId || "none"));

        const querySnapshot = await getDocs(q);
        setSubaccounts(querySnapshot.docs.map(document => ({ id: document.id, ...(document.data() as Omit<SubaccountRow, "id">) })));
    };

    const fetchPages = async () => {
        const q = isSuper
            ? collection(db, "pages")
            : query(collection(db, "pages"), where("accountId", "==", userData?.accountId || "none"));

        const querySnapshot = await getDocs(q);
        setPages(querySnapshot.docs.map(document => ({ id: document.id, ...(document.data() as Omit<PageRow, "id">) })));
    };

    const fetchUsers = async () => {
        const q = isSuper
            ? collection(db, "users")
            : query(collection(db, "users"), where("accountId", "==", userData?.accountId || "none"));

        const querySnapshot = await getDocs(q);
        setUsersList(querySnapshot.docs.map(document => ({ id: document.id, ...(document.data() as Omit<AdminUserRow, "id">) })));
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingAccountId) {
                await updateDoc(doc(db, "accounts", editingAccountId), { name: newAccount.name });
            } else {
                await addDoc(collection(db, "accounts"), { name: newAccount.name, createdAt: new Date().toISOString() });
            }
            showNotification("success", "Empresa salva com sucesso!");
            setShowAccountModal(false);
            fetchAccounts();
        } catch(e: unknown) {
            showNotification("error", "Erro ao salvar empresa: " + getErrorMessage(e));
        } finally { setIsSubmitting(false); }
    };

    const handleCreateSubaccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const accId = isSuper ? newSubaccount.accountId : userData?.accountId;
            if (editingSubaccountId) {
                await updateDoc(doc(db, "subaccounts", editingSubaccountId), { name: newSubaccount.name, accountId: accId });
            } else {
                await addDoc(collection(db, "subaccounts"), { name: newSubaccount.name, accountId: accId, createdAt: new Date().toISOString() });
            }
            showNotification("success", "Subconta salva com sucesso!");
            setShowSubaccountModal(false);
            fetchSubaccounts();
        } catch(e: unknown) {
            showNotification("error", "Erro ao salvar subconta: " + getErrorMessage(e));
        } finally { setIsSubmitting(false); }
    };

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const accId = isSuper ? newPage.accountId : userData?.accountId;
            const data = {
                title: newPage.title,
                embedUrl: newPage.embedUrl,
                accountId: accId,
                subAccountIds: newPage.subAccountIds,
                updatedAt: new Date().toISOString()
            };

            if (editingPageId) {
                await updateDoc(doc(db, "pages", editingPageId), data);
            } else {
                await addDoc(collection(db, "pages"), { ...data, createdAt: new Date().toISOString() });
            }
            showNotification("success", "Relatório salvo com sucesso!");
            setShowPageModal(false);
            fetchPages();
        } catch(e: unknown) {
            showNotification("error", "Erro ao salvar relatório: " + getErrorMessage(e));
        } finally { setIsSubmitting(false); }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const accId = isSuper ? newUser.accountId : userData?.accountId;
            
            // Edit existing user roles
            if (editingUserId) {
                await updateDoc(doc(db, "users", editingUserId), {
                    role: newUser.role,
                    accountId: accId,
                    subAccountIds: newUser.subAccountIds
                });
                showNotification("success", "Usuário atualizado com sucesso!");
                setShowUserModal(false);
                fetchUsers();
                return;
            }

            if (newUser.email.toLowerCase() === user?.email?.toLowerCase()) {
                showNotification("error", "Você não pode criar um usuário com o mesmo e-mail do admin logado.");
                return;
            }

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

            // Gerar senha aleatória temporária
            const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).toUpperCase().slice(-4);

            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, tempPassword);
            const newUid = userCredential.user.uid;

            await setDoc(doc(db, "users", newUid), {
                email: newUser.email,
                role: newUser.role,
                accountId: accId,
                subAccountIds: newUser.subAccountIds,
                requiresPasswordChange: true,
                createdAt: new Date().toISOString()
            });

            // Enviar e-mail de Boas-vindas (que gera um link de definição de senha) via Resend
            try {
                await sendPasswordResetEmailAction(newUser.email, window.location.origin, 'welcome');
            } catch (resetErr) {
                console.error("Erro ao enviar e-mail de reset inicial:", resetErr);
                // Não trava o processo, mas avisa
            }

            await deleteApp(secondaryApp);

            showNotification("success", "Usuário criado com sucesso! Um e-mail de configuração de senha foi enviado.");
            setShowUserModal(false);
            fetchUsers();
        } catch (error: unknown) {
            console.error("Error creating/updating user:", error);
            if (getErrorCode(error) === 'auth/email-already-in-use') {
                showNotification("error", "Este e-mail já está sendo usado no Firebase Auth. Se você excluiu este usuário recentemente, use um e-mail diferente ou restaure-o no console do Firebase.");
            } else {
                showNotification("error", "Erro: " + getErrorMessage(error));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendResetEmail = async (email: string) => {
        try {
            const result = await sendPasswordResetEmailAction(email, window.location.origin);
            if (result.success) {
                showNotification("success", `E-mail de redefinição enviado para ${email}`);
            } else {
                showNotification("error", "Erro ao enviar e-mail: " + result.error);
            }
        } catch (error: unknown) {
            console.error("Error sending reset email:", error);
            showNotification("error", "Erro ao enviar e-mail: " + getErrorMessage(error));
        }
    };

    const openTemporaryPasswordModal = (targetUser: AdminUserRow) => {
        setTemporaryPasswordUser(targetUser);
        setTemporaryPasswordForm({ password: "", confirmPassword: "" });
        setShowTemporaryPasswordModal(true);
    };

    const closeTemporaryPasswordModal = () => {
        setShowTemporaryPasswordModal(false);
        setTemporaryPasswordUser(null);
        setTemporaryPasswordForm({ password: "", confirmPassword: "" });
    };

    const handleSetTemporaryPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!temporaryPasswordUser || !user) return;

        if (temporaryPasswordForm.password !== temporaryPasswordForm.confirmPassword) {
            showNotification("error", "As senhas nao coincidem.");
            return;
        }

        if (temporaryPasswordForm.password.length < 6) {
            showNotification("error", "A senha provisória deve ter pelo menos 6 caracteres.");
            return;
        }

        setIsSubmitting(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/admin/set-temporary-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    uid: temporaryPasswordUser.id,
                    temporaryPassword: temporaryPasswordForm.password
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Erro ao definir senha provisória");
            }

            showNotification("success", "Senha provisória definida. O usuário deverá entrar com ela e trocar a senha no primeiro acesso.");
            closeTemporaryPasswordModal();
            fetchUsers();
        } catch (error: unknown) {
            console.error("Error setting temporary password:", error);
            showNotification("error", "Erro ao definir senha provisória: " + getErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteItem = async (collectionName: string, id: string, fetchFn: () => void) => {
        if (id === user?.uid) {
            showNotification("error", "Você não pode excluir a si mesmo.");
            return;
        }
        
        const isUserDelete = collectionName === 'users';
        const confirmMsg = isUserDelete 
            ? "Tem certeza que deseja excluir este usuário? Isso apagará permanentemente o login e o registro no banco de dados."
            : "Tem certeza que deseja excluir este item?";

        showConfirm("Confirmar Exclusão", confirmMsg, async () => {
            try {
                if (isUserDelete && user) {
                    // Obter o token de autenticação do usuário logado para enviar na API
                    const idToken = await user.getIdToken();
                    
                    const response = await fetch('/api/admin/delete-user', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({ uid: id })
                    });

                    const result = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(result.error || "Erro ao excluir usuário no Auth");
                    }
                } else {
                    // Exclusão normal de outras coleções
                    await deleteDoc(doc(db, collectionName, id));
                }
                
                showNotification("success", "Item excluído com sucesso!");
                fetchFn();
            } catch(e: unknown) {
                console.error("Erro ao excluir:", e);
                showNotification("error", "Erro ao excluir: " + getErrorMessage(e));
            }
        });
    };

    if (loading) return <div className="p-8 text-center">Carregando painel...</div>;

    if (!isSuper && userData?.role !== 'account_admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa] px-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
                    <button onClick={() => router.push("/dashboard")} className="mt-4 bg-blue-600 text-white py-2 px-4 rounded cursor-pointer transition-colors hover:bg-blue-700">Ir para Dash</button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {/* Sistema de Notificação */}
            {notification && (
                <div className="fixed top-5 right-5 z-[100] animate-bounce-short">
                    <div className={`${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px]`}>
                        {notification.type === 'success' ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                        <div className="flex-1">
                            <p className="font-bold">{notification.type === 'success' ? 'Sucesso' : 'Erro'}</p>
                            <p className="text-sm opacity-90">{notification.message}</p>
                        </div>
                        {notification.type === 'error' && (
                            <button onClick={() => setNotification(null)} className="ml-2 bg-white/20 hover:bg-white/30 p-1 rounded-lg cursor-pointer">OK</button>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Painel de Administração</h1>
                </div>
                <div className="flex gap-3">
                    {isSuper && (
                        <button onClick={() => { setNewAccount({name: ""}); setEditingAccountId(null); setShowAccountModal(true); }} className="bg-gray-800 text-white py-2 px-4 rounded-xl text-sm cursor-pointer hover:bg-gray-700">+ Empresa</button>
                    )}
                    <button onClick={() => { setNewSubaccount({name: "", accountId: isSuper ? "" : (userData?.accountId || "")}); setEditingSubaccountId(null); setShowSubaccountModal(true); }} className="bg-blue-600 text-white py-2 px-4 rounded-xl text-sm cursor-pointer hover:bg-blue-700">+ Subconta</button>
                    <button onClick={() => { setNewUser({email: "", role: "account_user", accountId: isSuper ? "" : (userData?.accountId || ""), subAccountIds: []}); setEditingUserId(null); setShowUserModal(true); }} className="bg-green-600 text-white py-2 px-4 rounded-xl text-sm cursor-pointer hover:bg-green-700">+ Usuário</button>
                </div>
            </div>

            <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
                {(['pages', 'users', 'accounts', 'subaccounts'] as const).filter(t => isSuper || t !== 'accounts').map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 font-semibold capitalize whitespace-nowrap cursor-pointer transition-colors ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                        {tab === 'pages' ? `Relatórios (${pages.length})` : 
                         tab === 'users' ? `Usuários (${usersList.length})` : 
                         tab === 'accounts' ? `Empresas (${accounts.length})` : 
                         `Subcontas (${subaccounts.length})`}
                    </button>
                ))}
            </div>

            {/* TAB ACCOUNTS */}
            {activeTab === 'accounts' && isSuper && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {accounts.map(acc => (
                        <div key={acc.id} className="bg-white rounded-xl shadow-sm border p-6">
                            <h3 className="font-bold text-lg mb-2">{acc.name}</h3>
                            <div className="mt-4 flex gap-2">
                                <button onClick={() => { setNewAccount({name: acc.name}); setEditingAccountId(acc.id); setShowAccountModal(true); }} className="text-blue-500 text-sm cursor-pointer hover:underline">Editar</button>
                                <button onClick={() => deleteItem("accounts", acc.id, fetchAccounts)} className="text-red-500 text-sm cursor-pointer hover:underline">Excluir</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB SUBACCOUNTS */}
            {activeTab === 'subaccounts' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {subaccounts.map(sub => (
                        <div key={sub.id} className="bg-white rounded-xl shadow-sm border p-6">
                            <h3 className="font-bold text-lg mb-2">{sub.name}</h3>
                            <p className="text-sm text-gray-500 mb-4">Empresa: {accounts.find(a => a.id === sub.accountId)?.name || (sub.accountId ? "Conta Deletada" : "-")}</p>
                            <div className="mt-4 flex gap-2">
                                <button onClick={() => { setNewSubaccount({name: sub.name, accountId: sub.accountId}); setEditingSubaccountId(sub.id); setShowSubaccountModal(true); }} className="text-blue-500 text-sm cursor-pointer hover:underline">Editar</button>
                                <button onClick={() => deleteItem("subaccounts", sub.id, fetchSubaccounts)} className="text-red-500 text-sm cursor-pointer hover:underline">Excluir</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB PAGES */}
            {activeTab === 'pages' && (
                 <div>
                    <button onClick={() => { setNewPage({title: "", embedUrl: "", accountId: isSuper ? "" : (userData?.accountId || ""), subAccountIds: []}); setEditingPageId(null); setShowPageModal(true); }} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-xl shadow-sm text-sm cursor-pointer hover:bg-blue-700 transition-colors">+ Novo Relatório (Página)</button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {pages.map(p => (
                            <div key={p.id} className="bg-white rounded-xl shadow p-6 border border-gray-50">
                                <h3 className="font-bold text-gray-900">{p.title}</h3>
                                <p className="text-xs text-gray-400 mb-2 truncate">{p.embedUrl}</p>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p><span className="font-medium">Empresa:</span> {accounts.find(a=>a.id===p.accountId)?.name || (p.accountId ? "Conta Deletada" : "-")}</p>
                                    <p><span className="font-medium">Subcontas:</span> {p.subAccountIds?.length || 0} vinculadas</p>
                                </div>
                                <div className="mt-4 flex gap-3">
                                    <button onClick={() => { setNewPage({title: p.title||"", embedUrl: p.embedUrl||"", accountId: p.accountId||"", subAccountIds: p.subAccountIds||[]}); setEditingPageId(p.id); setShowPageModal(true); }} className="text-blue-600 text-sm font-medium hover:underline cursor-pointer">Editar</button>
                                    <button onClick={() => deleteItem("pages", p.id, fetchPages)} className="text-red-600 text-sm font-medium hover:underline cursor-pointer">Excluir</button>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
            )}

            {/* TAB USERS */}
            {activeTab === 'users' && (
                <div className="bg-white rounded-xl shadow border overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr><th className="p-4 font-semibold text-gray-700">Email</th><th className="p-4 font-semibold text-gray-700">Role</th><th className="p-4 font-semibold text-gray-700">Empresa</th><th className="p-4 font-semibold text-gray-700">Ações</th></tr>
                        </thead>
                        <tbody>
                            {usersList.map((u) => (
                                <tr key={u.id} className="border-b hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-gray-800">{u.email}</td>
                                    <td className="p-4"><span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-xs font-medium">{u.role || (u.isAdmin ? 'superadmin' : 'legacy')}</span></td>
                                    <td className="p-4 text-sm text-gray-600">{accounts.find(a => a.id === u.accountId)?.name || (u.accountId ? "Conta Deletada" : "-")}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <ActionIconButton
                                                label="Editar"
                                                onClick={() => { setNewUser({email: u.email || "", role: u.role || "account_user", accountId: u.accountId || "", subAccountIds: u.subAccountIds||[]}); setEditingUserId(u.id); setShowUserModal(true); }}
                                                className="border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 focus:ring-blue-500"
                                            >
                                                <Edit3 size={16} strokeWidth={2.2} />
                                            </ActionIconButton>
                                            <ActionIconButton
                                                label="Enviar reset por e-mail"
                                                onClick={() => handleSendResetEmail(u.email || "")}
                                                className="border-orange-100 bg-orange-50 text-orange-600 hover:bg-orange-100 focus:ring-orange-500"
                                            >
                                                <Mail size={16} strokeWidth={2.2} />
                                            </ActionIconButton>
                                            {canSetTemporaryPassword(u) && (
                                                <ActionIconButton
                                                    label="Definir senha provisória"
                                                    onClick={() => openTemporaryPasswordModal(u)}
                                                    className="border-purple-100 bg-purple-50 text-purple-600 hover:bg-purple-100 focus:ring-purple-500"
                                                >
                                                    <KeyRound size={16} strokeWidth={2.2} />
                                                </ActionIconButton>
                                            )}
                                            {u.id !== user?.uid && (
                                                <ActionIconButton
                                                    label="Excluir"
                                                    onClick={() => deleteItem("users", u.id, fetchUsers)}
                                                    className="border-red-100 bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500"
                                                >
                                                    <Trash2 size={16} strokeWidth={2.2} />
                                                </ActionIconButton>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}

            {showTemporaryPasswordModal && temporaryPasswordUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-2xl max-w-md w-full shadow-2xl">
                        <h2 className="text-xl font-bold mb-2">Definir senha provisória</h2>
                        <p className="text-sm text-gray-500 mb-6">
                            O usuário {temporaryPasswordUser.email} deverá entrar com esta senha e trocar no primeiro acesso.
                        </p>

                        <form onSubmit={handleSetTemporaryPassword} className="space-y-4">
                            <div>
                                <label className="block font-bold mb-2 text-sm text-gray-700">Senha provisória</label>
                                <input
                                    required
                                    type="password"
                                    minLength={6}
                                    value={temporaryPasswordForm.password}
                                    onChange={e => setTemporaryPasswordForm({ ...temporaryPasswordForm, password: e.target.value })}
                                    className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block font-bold mb-2 text-sm text-gray-700">Confirmar senha provisória</label>
                                <input
                                    required
                                    type="password"
                                    minLength={6}
                                    value={temporaryPasswordForm.confirmPassword}
                                    onChange={e => setTemporaryPasswordForm({ ...temporaryPasswordForm, confirmPassword: e.target.value })}
                                    className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-xs">
                                A senha não será armazenada. Compartilhe-a com o usuário por um canal seguro.
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button className="px-4 py-2 text-gray-500 font-medium cursor-pointer hover:bg-gray-50 rounded-lg" type="button" onClick={closeTemporaryPasswordModal}>Cancelar</button>
                                <button disabled={isSubmitting} className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold cursor-pointer hover:bg-purple-700 disabled:opacity-50" type="submit">
                                    {isSubmitting ? "Salvando..." : "Definir senha"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAccountModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-2xl max-w-sm w-full shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">{editingAccountId ? "Editar" : "Nova"} Empresa</h2>
                        <input value={newAccount.name} onChange={e=>setNewAccount({name: e.target.value})} placeholder="Nome da empresa" className="w-full border p-3 rounded-xl mb-6 focus:ring-2 focus:ring-blue-500 outline-none" />
                        <div className="flex justify-end gap-3"><button className="px-4 py-2 text-gray-500 font-medium cursor-pointer hover:bg-gray-50 rounded-lg" onClick={()=>setShowAccountModal(false)}>Cancelar</button><button onClick={handleCreateAccount} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold cursor-pointer hover:bg-blue-700">Salvar</button></div>
                    </div>
                </div>
            )}

            {showSubaccountModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-2xl max-w-sm w-full shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">{editingSubaccountId ? "Editar" : "Nova"} Subconta</h2>
                        <input value={newSubaccount.name} onChange={e=>setNewSubaccount({...newSubaccount, name: e.target.value})} placeholder="Nome da subconta" className="w-full border p-3 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none" />
                        
                        {isSuper && (
                            <select value={newSubaccount.accountId} onChange={e=>setNewSubaccount({...newSubaccount, accountId: e.target.value})} className="w-full border p-3 rounded-xl mb-6 bg-white outline-none">
                                <option value="">Selecione a empresa...</option>
                                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        )}
                        <div className="flex justify-end gap-3"><button className="px-4 py-2 text-gray-500 font-medium cursor-pointer hover:bg-gray-50 rounded-lg" onClick={()=>setShowSubaccountModal(false)}>Cancelar</button><button onClick={handleCreateSubaccount} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold cursor-pointer hover:bg-blue-700">Salvar</button></div>
                    </div>
                </div>
            )}

            {showUserModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">{editingUserId ? "Editar Usuário" : "Novo Usuário"}</h2>
                        <input disabled={!!editingUserId} value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})} placeholder="Email" className="w-full border p-3 rounded-xl mb-4 disabled:opacity-50 outline-none" />
                        {!editingUserId && (
                            <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-xs mb-4">
                                Um e-mail será enviado para o usuário configurar sua primeira senha após a criação.
                            </div>
                        )}
                        
                        <label className="block mt-2 font-bold mb-2 text-sm text-gray-700">Nível de Acesso</label>
                        <select value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})} className="w-full border p-3 rounded-xl mb-4 bg-white outline-none">
                            {isSuper && <option value="superadmin">Superadmin</option>}
                            <option value="account_admin">Admin da Conta (Empresa)</option>
                            <option value="account_user">Usuário da Conta (Empresa)</option>
                            <option value="subaccount_user">Usuário de Subconta</option>
                        </select>

                        {isSuper && newUser.role !== 'superadmin' && (
                            <>
                                <label className="block mt-2 font-bold mb-2 text-sm text-gray-700">Empresa Vinculada</label>
                                <select value={newUser.accountId} onChange={e=>setNewUser({...newUser, accountId: e.target.value})} className="w-full border p-3 rounded-xl mb-4 bg-white outline-none">
                                    <option value="">Selecione...</option>
                                    {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </>
                        )}

                        {newUser.role === 'subaccount_user' && (isSuper ? newUser.accountId : userData?.accountId) && (
                            <div className="mb-4 border p-4 rounded-xl bg-gray-50">
                                <label className="block font-bold mb-3 text-sm text-gray-800">Subcontas Permitidas</label>
                                <div className="space-y-2">
                                    {subaccounts.filter(s=>s.accountId === (isSuper ? newUser.accountId : userData?.accountId)).map(sub => (
                                        <label key={sub.id} className="flex gap-3 items-center text-sm cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                            <input type="checkbox" className="w-4 h-4 rounded text-blue-600" checked={newUser.subAccountIds.includes(sub.id)} onChange={(e)=>{
                                                if(e.target.checked) setNewUser({...newUser, subAccountIds: [...newUser.subAccountIds, sub.id]});
                                                else setNewUser({...newUser, subAccountIds: newUser.subAccountIds.filter(id => id !== sub.id)});
                                            }} />
                                            <span className="text-gray-700">{sub.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-8"><button className="px-4 py-2 text-gray-500 font-medium cursor-pointer hover:bg-gray-50 rounded-lg" type="button" onClick={()=>setShowUserModal(false)}>Cancelar</button><button onClick={handleCreateUser} disabled={isSubmitting} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-green-200 cursor-pointer hover:bg-green-700">Salvar</button></div>
                    </div>
                </div>
            )}

            {showPageModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                   <div className="bg-white p-8 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">{editingPageId ? "Editar Relatório" : "Novo Relatório"}</h2>
                        <input value={newPage.title} onChange={e=>setNewPage({...newPage, title: e.target.value})} placeholder="Título" className="w-full border p-3 rounded-xl mb-4 outline-none" />
                        <input value={newPage.embedUrl} onChange={e=>setNewPage({...newPage, embedUrl: e.target.value})} placeholder="URL de Embed / PowerBI" className="w-full border p-3 rounded-xl mb-4 outline-none" />
                        
                        {isSuper && (
                            <>
                                <label className="block mt-2 font-bold mb-2 text-sm text-gray-700">Empresa</label>
                                <select value={newPage.accountId} onChange={e=>setNewPage({...newPage, accountId: e.target.value, subAccountIds: []})} className="w-full border p-3 rounded-xl mb-6 bg-white outline-none">
                                    <option value="">Selecione...</option>
                                    {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </>
                        )}

                        {(isSuper ? newPage.accountId : userData?.accountId) && (
                            <div className="mb-4 border p-4 rounded-xl bg-gray-50">
                                <label className="block font-bold mb-3 text-sm text-gray-800">Visível nas Subcontas (Opcional)</label>
                                <div className="space-y-2">
                                    {subaccounts.filter(s=>s.accountId === (isSuper ? newPage.accountId : userData?.accountId)).map(sub => (
                                        <label key={sub.id} className="flex gap-3 items-center text-sm cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                            <input type="checkbox" className="w-4 h-4 rounded text-blue-600" checked={newPage.subAccountIds.includes(sub.id)} onChange={(e)=>{
                                                if(e.target.checked) setNewPage({...newPage, subAccountIds: [...newPage.subAccountIds, sub.id]});
                                                else setNewPage({...newPage, subAccountIds: newPage.subAccountIds.filter(id => id !== sub.id)});
                                            }} />
                                            <span className="text-gray-700">{sub.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 mt-8"><button className="px-4 py-2 text-gray-500 font-medium cursor-pointer hover:bg-gray-50 rounded-lg" type="button" onClick={()=>setShowPageModal(false)}>Cancelar</button><button onClick={handleCreatePage} disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-200 cursor-pointer hover:bg-blue-700 transition-colors">Salvar</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
