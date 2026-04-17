"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface HeaderProps {
    brand?: "shopee" | "meli" | "amazon" | "default";
}

export default function Header({ brand = "default" }: HeaderProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { user, userData, logout } = useAuth();

    const isShopee = brand === "shopee";
    const isMeli = brand === "meli";
    const isAmazon = brand === "amazon";

    const brandName = isShopee ? "Shopee Pro" : isMeli ? "Mercado Livre Pro" : isAmazon ? "Amazon Pro" : "Marketplace Tools";
    const brandColor = isShopee ? "text-primary" : isMeli ? "text-meli-secondary" : isAmazon ? "text-[#FF9900]" : "text-gray-900";
    const bgColor = isShopee ? "bg-primary" : isMeli ? "bg-meli-primary" : isAmazon ? "bg-[#232F3E]" : "bg-gray-900";

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 group transition-opacity hover:opacity-90">
                    <div className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center`}>
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                        </svg>
                    </div>
                    <div>
                        <h1 className={`text-lg font-bold ${brandColor} leading-tight`}>{brandName}</h1>
                        <p className="text-xs text-gray-500">Calculadora de Precificação</p>
                    </div>
                </Link>

                {/* Mobile menu button */}
                <div className="md:hidden flex items-center">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none cursor-pointer"
                    >
                        <span className="sr-only">Abrir menu</span>
                        {isMenuOpen ? (
                            <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Desktop menu */}
                <nav className="hidden md:flex items-center space-x-8 h-full">
                    <Link href="/" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors cursor-pointer">Home</Link>

                    {/* Calculadoras Dropdown */}
                    <div className="relative group h-full flex items-center">
                        <button className={`text-sm font-medium flex items-center gap-1 h-full px-1 cursor-pointer transition-colors ${isShopee || isMeli || isAmazon ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-blue-600'
                            }`}>
                            Calculadoras
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <div className="absolute top-full left-0 w-48 bg-white rounded-b-xl shadow-lg border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            <Link href="/shopee" className={`block px-4 py-2 text-sm font-medium ${isShopee ? 'text-primary bg-orange-50' : 'text-gray-600'} hover:text-primary hover:bg-gray-50 transition-colors cursor-pointer`}>
                                Shopee
                            </Link>
                            <Link href="/meli" className={`block px-4 py-2 text-sm font-medium ${isMeli ? 'text-meli-secondary bg-blue-50' : 'text-gray-600'} hover:text-meli-secondary hover:bg-gray-50 transition-colors cursor-pointer`}>
                                Mercado Livre
                            </Link>
                            <Link href="/amazon" className={`block px-4 py-2 text-sm font-medium ${isAmazon ? 'text-[#FF9900] bg-yellow-50' : 'text-gray-600'} hover:text-[#FF9900] hover:bg-gray-50 transition-colors cursor-pointer`}>
                                Amazon
                            </Link>
                        </div>
                    </div>

                    {user && (
                        <Link href="/reposicao-full" className="text-sm font-medium text-gray-600 hover:text-[#2d3277] transition-colors cursor-pointer h-full flex items-center px-1">
                            Reposição Full
                        </Link>
                    )}

                    <div className="h-6 w-px bg-gray-200 mx-2"></div>

                    {user ? (
                        <>
                            <Link href="/dash" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer">Meus Relatórios</Link>
                            {(userData?.isAdmin || userData?.role === 'superadmin' || userData?.role === 'account_admin') && (
                                <Link href="/admin" className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer">Admin</Link>
                            )}
                            <button
                                onClick={() => logout()}
                                className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                            >
                                Sair
                            </button>
                        </>
                    ) : (
                        <Link href="/login" className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl shadow-md shadow-blue-100 transition-all active:scale-95 cursor-pointer">Login</Link>
                    )}
                </nav>
            </div>

            {/* Mobile menu, show/hide based on menu state */}
            {isMenuOpen && (
                <div className="md:hidden bg-white border-t border-gray-200">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <Link
                            href="/"
                            onClick={() => setIsMenuOpen(false)}
                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-primary hover:bg-gray-50 cursor-pointer"
                        >
                            Home
                        </Link>
                        <Link
                            href="/shopee"
                            onClick={() => setIsMenuOpen(false)}
                            className={`block px-3 py-2 rounded-md text-base font-medium ${isShopee ? 'text-primary bg-orange-50' : 'text-gray-600'} hover:text-primary hover:bg-gray-50 cursor-pointer`}
                        >
                            Shopee
                        </Link>
                        <Link
                            href="/meli"
                            onClick={() => setIsMenuOpen(false)}
                            className={`block px-3 py-2 rounded-md text-base font-medium ${isMeli ? 'text-meli-secondary bg-blue-50' : 'text-gray-600'} hover:text-meli-secondary hover:bg-gray-50 cursor-pointer`}
                        >
                            Mercado Livre
                        </Link>
                        <Link
                            href="/amazon"
                            onClick={() => setIsMenuOpen(false)}
                            className={`block px-3 py-2 rounded-md text-base font-medium ${isAmazon ? 'text-[#FF9900] bg-yellow-50' : 'text-gray-600'} hover:text-[#FF9900] hover:bg-gray-50 cursor-pointer`}
                        >
                            Amazon
                        </Link>

                        <div className="border-t border-gray-100 my-2 pt-2">
                            {user ? (
                                <>
                                    <Link
                                        href="/dash"
                                        onClick={() => setIsMenuOpen(false)}
                                        className="block px-3 py-2 rounded-md text-base font-bold text-blue-600 hover:bg-gray-50 cursor-pointer"
                                    >
                                        Meus Relatórios
                                    </Link>
                                    {(userData?.isAdmin || userData?.role === 'superadmin' || userData?.role === 'account_admin') && (
                                        <Link
                                            href="/admin"
                                            onClick={() => setIsMenuOpen(false)}
                                            className="block px-3 py-2 rounded-md text-base font-bold text-gray-900 hover:bg-gray-50 cursor-pointer"
                                        >
                                            Painel Admin
                                        </Link>
                                    )}
                                    <button
                                        onClick={() => {
                                            logout();
                                            setIsMenuOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-500 hover:bg-gray-50 cursor-pointer"
                                    >
                                        Sair
                                    </button>
                                </>
                            ) : (
                                <Link
                                    href="/login"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="block px-3 py-2 rounded-md text-base font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                                >
                                    Login
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
