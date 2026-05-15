import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Ship, MessageSquareText, Wallet, LogOut, ChartColumn } from "lucide-react";
import { useAuth } from "@/lib/auth";

const tabs = [
  { to: "/dashboard", label: "Stats", Icon: LayoutDashboard },
  { to: "/trips", label: "Trips", Icon: Ship },
  { to: "/sms", label: "SMS", Icon: MessageSquareText },
  { to: "/expenses", label: "Expenses", Icon: Wallet },
  { to: "/reports", label: "Reports", Icon: ChartColumn },
] as const;

export function AppLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-20 bg-[image:var(--gradient-hero)] text-primary-foreground px-5 pt-5 pb-6 rounded-b-3xl shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] opacity-80">Bluwaves</p>
            <h1 className="font-display text-2xl font-semibold leading-tight">Boat Manager</h1>
          </div>
          <button
            onClick={async () => { await signOut(); nav({ to: "/login" }); }}
            className="size-10 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 transition"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        {user?.email && <p className="text-xs opacity-75 mt-1 truncate">{user.email}</p>}
      </header>

      <main className="flex-1 px-4 pt-5 pb-28 max-w-xl w-full mx-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border">
        <div className="max-w-xl mx-auto grid grid-cols-5">
          {tabs.map(({ to, label, Icon }) => {
            const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`size-5 ${active ? "stroke-[2.4]" : ""}`} />
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
        <div style={{ height: "env(safe-area-inset-bottom)" }} />
      </nav>
    </div>
  );
}
