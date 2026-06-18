"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    Calculator,
    ChevronDown,
    ChevronRight,
    LayoutDashboard,
    PackageSearch,
    PanelLeftClose,
    PanelLeftOpen,
    ShieldCheck,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    isHovered: boolean;
    setIsHovered: (hovered: boolean) => void;
}

interface SubItem {
    name: string;
    href: string;
}

type NavItem =
    | {
        name: string;
        href: string;
        icon: LucideIcon;
        isDropdown?: false;
    }
    | {
        name: string;
        icon: LucideIcon;
        isDropdown: true;
        isOpen: boolean;
        toggle: () => void;
        subItems: SubItem[];
    };

interface NavSection {
    section: string;
    items: NavItem[];
}

export default function Sidebar({ isCollapsed, setIsCollapsed, isHovered, setIsHovered }: SidebarProps) {
    const pathname = usePathname();
    const { userData } = useAuth();
    const [isCalculadorasOpen, setIsCalculadorasOpen] = useState(false);
    const [isIntegracoesOpen, setIsIntegracoesOpen] = useState(false);
    const [isReposFullOpen, setIsReposFullOpen] = useState(false);

    const actualCollapsed = isCollapsed && !isHovered;
    const isAdmin = userData?.isAdmin || userData?.role === "superadmin" || userData?.role === "account_admin";
    const actualCalculadorasOpen = isCalculadorasOpen || pathname.includes("/shopee") || pathname.includes("/meli") || pathname.includes("/amazon");
    const actualIntegracoesOpen = isIntegracoesOpen || pathname.includes("/integrations");
    const actualReposFullOpen = isReposFullOpen || pathname.includes("/full-replenishment");

    const navItems: NavSection[] = [
        {
            section: "OPERACIONAL",
            items: [
                {
                    name: "Reposição Full",
                    icon: PackageSearch,
                    isDropdown: true,
                    isOpen: actualReposFullOpen,
                    toggle: () => setIsReposFullOpen(!isReposFullOpen),
                    subItems: [
                        { name: "Mercado Livre", href: "/full-replenishment/meli" },
                        { name: "Shopee", href: "/full-replenishment/shopee" },
                    ],
                },
                { name: "Cadastros", href: "/catalog", icon: LayoutDashboard },
                { name: "Relatórios", href: "/dashboard", icon: BarChart3 },
            ],
        },
        {
            section: "FERRAMENTAS",
            items: [
                {
                    name: "Calculadoras",
                    icon: Calculator,
                    isDropdown: true,
                    isOpen: actualCalculadorasOpen,
                    toggle: () => setIsCalculadorasOpen(!isCalculadorasOpen),
                    subItems: [
                        { name: "Shopee", href: "/shopee" },
                        { name: "Mercado Livre", href: "/meli" },
                        { name: "Amazon", href: "/amazon" },
                    ],
                },
            ],
        },
        {
            section: "CONFIGURAÇÕES",
            items: [
                ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: ShieldCheck } satisfies NavItem] : []),
                {
                    name: "Integrações",
                    icon: Zap,
                    isDropdown: true,
                    isOpen: actualIntegracoesOpen,
                    toggle: () => setIsIntegracoesOpen(!isIntegracoesOpen),
                    subItems: [
                        { name: "Anymarket", href: "/integrations/anymarket" },
                        { name: "Tray", href: "/integrations/tray" },
                        { name: "Mercado Livre", href: "/integrations/mercadolivre" },
                    ],
                },
            ],
        },
    ];

    return (
        <aside
            className={`sticky top-0 h-screen bg-white text-gray-500 transition-all duration-300 z-50 flex flex-col border-r border-gray-200 flex-shrink-0
                ${actualCollapsed ? "w-20" : "w-64"}`}
            onMouseEnter={() => isCollapsed && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="h-20 flex items-center px-6 border-b border-gray-100">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="min-w-[32px] h-10 flex items-center justify-center transition-transform group-hover:scale-105">
                        <Image src="/images/logo-symbol.png" alt="S" width={32} height={32} className="h-8 w-auto object-contain" />
                    </div>
                    <span className={`font-bold text-xl text-gray-900 tracking-tight transition-all duration-300 whitespace-nowrap ${actualCollapsed ? "opacity-0 invisible w-0" : "opacity-100 visible w-auto"}`}>
                        Seller<span className="text-blue-600">Dock</span>
                    </span>
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 scrollbar-thin scrollbar-thumb-gray-200">
                {navItems.map((section) => (
                    <div key={section.section} className="mb-6">
                        <h3 className={`px-6 mb-2 text-[10px] font-bold tracking-widest text-gray-400 transition-opacity duration-300 ${actualCollapsed ? "opacity-0" : "opacity-100"}`}>
                            {section.section}
                        </h3>

                        <div className={`space-y-1 ${actualCollapsed ? "px-2" : "px-3"}`}>
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = item.isDropdown
                                    ? item.subItems.some((sub) => pathname === sub.href)
                                    : pathname === item.href;

                                if (item.isDropdown) {
                                    return (
                                        <div key={item.name} className="relative">
                                            <button
                                                onClick={item.toggle}
                                                className={`w-full flex items-center rounded-xl transition-all group cursor-pointer
                                                    ${actualCollapsed ? "aspect-square justify-center" : "px-3 py-3 gap-3"}
                                                    ${isActive ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50 hover:text-gray-900"}`}
                                            >
                                                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-blue-600" : "group-hover:text-gray-900 transition-colors"}`} />
                                                {!actualCollapsed && (
                                                    <>
                                                        <span className="flex-1 text-sm font-medium text-left whitespace-nowrap animate-in fade-in duration-300">
                                                            {item.name}
                                                        </span>
                                                        {item.isOpen ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                                                    </>
                                                )}
                                            </button>

                                            <div className={`overflow-hidden transition-all duration-300 ${(!actualCollapsed && item.isOpen) ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"}`}>
                                                {item.subItems.map((sub) => (
                                                    <Link
                                                        key={sub.name}
                                                        href={sub.href}
                                                        className={`flex items-center gap-3 pl-11 pr-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap
                                                            ${pathname === sub.href ? "text-blue-600 font-semibold" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`}
                                                    >
                                                        {sub.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`w-full flex items-center rounded-xl transition-all group
                                            ${actualCollapsed ? "aspect-square justify-center" : "px-3 py-3 gap-3"}
                                            ${pathname === item.href ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10" : "hover:bg-gray-50 hover:text-gray-900"}`}
                                    >
                                        <Icon className={`w-5 h-5 flex-shrink-0 ${pathname === item.href ? "text-white" : "group-hover:text-gray-900 transition-colors"}`} />
                                        {!actualCollapsed && (
                                            <span className="text-sm font-medium whitespace-nowrap animate-in fade-in duration-300">
                                                {item.name}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`w-full flex items-center rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-all group cursor-pointer
                        ${actualCollapsed ? "aspect-square justify-center" : "px-3 py-3 gap-3"}`}
                >
                    {isCollapsed ? (
                        <PanelLeftOpen className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    ) : (
                        <PanelLeftClose className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    )}
                    {!actualCollapsed && (
                        <span className="text-sm font-medium whitespace-nowrap animate-in fade-in duration-300">
                            Recolher Menu
                        </span>
                    )}
                </button>
            </div>
        </aside>
    );
}
