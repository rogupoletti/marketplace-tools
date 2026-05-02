"use client";

import React, { useState } from "react";
import { 
    LogOut, 
    ChevronDown, 
    User as UserIcon,
    Settings
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function TopBar() {
    const { user, userData, logout } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const getRoleName = (role?: string) => {
        switch (role) {
            case 'superadmin': return 'Super Administrador';
            case 'account_admin': return 'Administrador de Conta';
            case 'account_user': return 'Usuário da Conta';
            case 'subaccount_user': return 'Acesso Subconta';
            default: return 'Usuário';
        }
    };

    return (
        <header className="h-20 bg-white border-b border-gray-100 sticky top-0 z-40 flex items-center justify-between px-8">
            {/* Left side - Can be used for page title or breadcrumbs if needed */}
            <div className="flex items-center gap-4">
                {/* Search removed as per user request */}
            </div>

            {/* Right side - User Profile Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-4 group cursor-pointer p-2 rounded-2xl hover:bg-gray-50 transition-colors"
                >
                    <div className="flex flex-col items-end hidden sm:flex">
                        <span className="text-sm font-bold text-gray-900 leading-tight">
                            {user?.displayName || user?.email?.split('@')[0]}
                        </span>
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mt-0.5">
                            {getRoleName(userData?.role)}
                        </span>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200 overflow-hidden group-hover:border-blue-200 transition-colors">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon className="w-6 h-6 text-gray-400" />
                        )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                    <>
                        <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setIsUserMenuOpen(false)}
                        ></div>
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-20 transition-all duration-200 origin-top-right">
                            <div className="px-4 py-3 border-b border-gray-50 mb-1">
                                <p className="text-xs text-gray-400 font-medium">CONECTADO COMO</p>
                                <p className="text-sm font-bold text-gray-900 truncate">{user?.email}</p>
                            </div>
                            
                            <button 
                                onClick={() => logout()}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" />
                                SAIR DA CONTA
                            </button>
                        </div>
                    </>
                )}
            </div>
        </header>
    );
}
