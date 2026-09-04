import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function DashboardLayout({ children, user, onLogout }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const navBtn = "group mb-2 flex items-center gap-3 text-left px-4 py-2.5 rounded-xl text-blue-50 transition-all duration-300 hover:bg-white/15 hover:text-white hover:translate-x-1";

    return (
        <div className="flex h-screen w-full max-w-full overflow-hidden text-slate-800">

            {/* ================= SIDEBAR (DESKTOP) ================= */}
            <div className="hidden md:flex flex-col w-64 bg-gradient-to-b from-blue-700 to-indigo-800 border-r border-blue-900/40 text-white p-5 flex-shrink-0 relative overflow-hidden">

                <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-sky-400/25 blur-3xl" />

                <h2 className="relative text-2xl font-bold mb-10 tracking-tight">
                   Pujo<span className="text-sky-300">Pe</span>
                </h2>

                <button onClick={() => navigate('/home')} className={navBtn}>
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    Home
                </button>

                <button onClick={() => navigate('/pay')} className={navBtn}>
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    Pay Subscription
                </button>

                <button onClick={() => navigate('/search')} className={navBtn}>
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    Search People
                </button>

                <button onClick={() => navigate('/individual-collection')} className={navBtn}>
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    Individual Collection
                </button>

                {user === "admin@sdapp.com" && (
                    <button onClick={() => navigate('/admin-config')} className={navBtn}>
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-300 opacity-0 transition-opacity group-hover:opacity-100" />
                        Admin
                    </button>
                )}

                {/* LOGOUT */}
                <div className="mt-auto relative">
                    <button
                        onClick={onLogout}
                        className="btn-danger w-full"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* ================= MOBILE HEADER ================= */}
            {/* ================= MOBILE HEADER ================= */}
            {/* ================= MOBILE HEADER ================= */}
            <div className="md:hidden fixed top-0 left-0 right-0 w-full bg-gradient-to-r from-blue-700 to-indigo-800 border-b border-white/10 text-white flex items-center h-14 px-4 z-50 shadow-glow-soft">

                {/* LEFT TITLE */}
                <div className="flex items-center">
                    <span className="text-lg font-semibold">Puja<span className="text-sky-300">Pay</span></span>
                </div>

                {/* PUSH SPACE */}
                <div className="flex-1" />

                {/* RIGHT HAMBURGER */}
                <button
                    onClick={() => setOpen(true)}
                    className="flex items-center justify-center text-2xl"
                >
                    ☰
                </button>

            </div>

            {/* ================= BACKDROP ================= */}
            <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${open ? "opacity-100 visible" : "opacity-0 invisible"
                    }`}
                onClick={() => setOpen(false)}
            />

            {/* ================= RIGHT SLIDE MENU ================= */}
            <div
                className={`fixed top-0 right-0 h-full w-72 bg-gradient-to-b from-blue-700 to-indigo-800 border-l border-white/10 z-50 shadow-neon transform transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"
                    }`}
            >

                <div className="flex flex-col h-full p-5">

                    {/* HEADER */}
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Menu</h2>
                        <button onClick={() => setOpen(false)} className="text-xl text-blue-100 hover:text-white transition">
                            ✕
                        </button>
                    </div>

                    {/* LINKS */}
                    <button
                        onClick={() => { navigate('/home'); setOpen(false); }}
                        className={navBtn}
                    >
                        Home
                    </button>

                    <button
                        onClick={() => { navigate('/pay'); setOpen(false); }}
                        className={navBtn}
                    >
                        Pay Subscription
                    </button>

                    <button
                        onClick={() => { navigate('/search'); setOpen(false); }}
                        className={navBtn}
                    >
                        Search People
                    </button>

                    <button
                        onClick={() => { navigate('/individual-collection'); setOpen(false); }}
                        className={navBtn}
                    >
                        Individual Collection
                    </button>

                    {user === "admin@sdapp.com" && (
                        <button
                            onClick={() => { navigate('/admin-config'); setOpen(false); }}
                            className={navBtn}
                        >
                            Admin
                        </button>
                    )}

                    {/* LOGOUT */}
                    <button
                        onClick={onLogout}
                        className="btn-danger mt-auto w-full"
                    >
                        Logout
                    </button>

                </div>
            </div>

            {/* ================= MAIN CONTENT ================= */}
            <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">

                {/* HEADER */}
                <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 px-3 sm:px-6 py-2.5 md:py-3 flex items-center mt-14 md:mt-0 shadow-sm min-w-0">
                    <span className="block min-w-0 truncate text-sm md:text-base text-slate-600">
                        Welcome, <b className="text-blue-600">{user}</b>
                    </span>
                </div>

                {/* PAGE CONTENT */}
                <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
                    {children}
                </div>

            </div>

        </div>
    );
}

export default DashboardLayout;