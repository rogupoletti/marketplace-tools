"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface AuthenticatedLayoutProps {
    children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const actualCollapsed = isCollapsed && !isHovered;

    return (
        <div className="min-h-screen bg-[#f5f7fa] flex">
            {/* Sidebar */}
            <Sidebar 
                isCollapsed={isCollapsed} 
                setIsCollapsed={setIsCollapsed} 
                isHovered={isHovered}
                setIsHovered={setIsHovered}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* TopBar */}
                <TopBar />

                {/* Page Content */}
                <main className="flex-grow">
                    {children}
                </main>
            </div>
        </div>
    );
}
