import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, Fragment } from "react";
import { useAuth } from "@/lib/auth";
import {
  Download, Printer, Calendar, Banknote, Smartphone, Clock,
  Users, Ship, CheckCircle2, CircleDashed, LayoutList
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({ component: Reports });

/* ─── Types ────────────────────────────────────────────────────────────── */
type Range = "daily" | "weekly" | "monthly" | "custom";

type PaxItem = {
  id: string; name: string; phone: string | null; fare: number;
  payment_method: string; payment_status: string;
};
type TripGroup = {
  trip: { id: string; name: string; trip_date: string; trip_time: string | null };
  passengers: PaxItem[];
};
type Analytics = {
  revenue: number; expense: number; profit: number;
  cash: number; upi: number; pending: number;
  trips: number; passengers: number; tripGroups: TripGroup[];
};

/* ─── Date helpers ─────────────────────────────────────────────────────── */
const fmt = (d: Date) => d.toISOString().slice(0, 10);

function rangeBounds(r: Range, custom: { from: string; to: string }) {
  const today = new Date();
  if (r === "daily") {
    return { from: fmt(today), to: fmt(today), label: "Today" };
  }
  if (r === "weekly") {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { from: fmt(start), to: fmt(today), label: "Last 7 days" };
  }
  if (r === "monthly") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(start), to: fmt(today), label: "This month" };
  }
  return { from: custom.from, to: custom.to, label: `${custom.from} → ${custom.to}` };
}

/* ─── Main Component ────────────────────────────────────────────────────── */
function Reports() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("monthly");
  const [custom, setCustom] = useState({ from: fmt(new Date()), to: fmt(new Date()) });

  const { from, to, label } = rangeBounds(range, custom);

  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["analytics-report", user?.userId, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/?from=${from}&to=${to}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
  });

  /* ── CSV Export ── */
  function exportCsv() {
    if (!data) return;
    const rows: string[][] = [
      ["Trip Date", "Trip Name", "Passenger", "Phone", "Fare", "Method", "Status"],
    ];
    for (const g of data.tripGroups) {
      for (const p of g.passengers) {
        rows.push([
          g.trip.trip_date,
          g.trip.name,
          p.name,
          p.phone ?? "",
          String(p.fare),
          p.payment_method,
          p.payment_status,
        ]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bluwaves-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          nav, header { display: none !important; }
          @page { size: A4 portrait; margin: 15mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-avoid-break { page-break-inside: avoid; }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── SCREEN UI (HIDDEN IN PRINT) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="space-y-6 pb-10 print:hidden">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-semibold">Statement</h2>
            <p className="text-xs text-muted-foreground mt-1">Detailed trip and passenger ledger</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={!data}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-all disabled:opacity-40">
              <Download className="size-4" /> CSV
            </button>
            <button onClick={printReport} disabled={!data}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-40">
              <Printer className="size-4" /> PDF
            </button>
          </div>
        </div>

        {/* ── Period selector ── */}
        <div className="space-y-2">
          <div className="flex gap-2">
            {(["daily", "weekly", "monthly", "custom"] as Range[]).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={[
                  "flex-1 py-2 rounded-xl text-xs font-semibold transition-all",
                  range === r ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-secondary-foreground",
                ].join(" ")}>
                {r === "daily" ? "Day" : r === "weekly" ? "Week" : r === "monthly" ? "Month" : "Custom"}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">From</span>
                <input type="date" value={custom.from} onChange={e => setCustom(p => ({ ...p, from: e.target.value }))}
                  className="w-full h-10 mt-1 px-3 rounded-xl bg-card border border-border text-sm outline-none focus:border-ring" />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">To</span>
                <input type="date" value={custom.to} onChange={e => setCustom(p => ({ ...p, to: e.target.value }))}
                  className="w-full h-10 mt-1 px-3 rounded-xl bg-card border border-border text-sm outline-none focus:border-ring" />
              </label>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="space-y-4">
            <div className="h-32 rounded-3xl bg-muted animate-pulse" />
            <div className="h-40 rounded-3xl bg-muted animate-pulse" />
          </div>
        )}

        {data && (
          <>
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card p-4 border border-border shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Ship className="size-3" /> Total Trips</p>
                <p className="font-display text-2xl font-bold">{data.trips}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.passengers} Passengers</p>
              </div>
              <div className="rounded-2xl bg-card p-4 border border-border shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Banknote className="size-3" /> Total Revenue</p>
                <p className="font-display text-2xl font-bold text-success">₹{data.revenue.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-1">Cash: ₹{data.cash.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-2xl bg-card p-4 border border-border shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Smartphone className="size-3" /> UPI Collected</p>
                <p className="font-display text-2xl font-bold">₹{data.upi.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-1">Digital payments</p>
              </div>
              <div className="rounded-2xl bg-card p-4 border border-border shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="size-3" /> Pending</p>
                <p className="font-display text-2xl font-bold text-warning-foreground">₹{data.pending.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-1">Outstanding dues</p>
              </div>
            </div>

            {/* ── Trip Ledger List ── */}
            <div className="space-y-4 mt-6">
              <h3 className="font-display font-semibold text-lg flex items-center gap-2 border-b border-border pb-2">
                <LayoutList className="size-5 text-primary" /> Trip Details
              </h3>

              {data.tripGroups.map(({ trip, passengers }) => {
                const collected = passengers.filter(p => p.payment_status === "paid").reduce((s, p) => s + Number(p.fare), 0);
                const pend = passengers.filter(p => p.payment_status !== "paid").reduce((s, p) => s + Number(p.fare), 0);
                
                return (
                  <div key={trip.id} className="rounded-2xl bg-card border border-border shadow-[var(--shadow-soft)] overflow-hidden">
                    <div className="p-4 bg-secondary/30 border-b border-border flex justify-between items-start">
                      <div>
                        <h4 className="font-display font-semibold text-base">{trip.name}</h4>
                        <p className="text-xs font-medium text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <Calendar className="size-3" /> {trip.trip_date} 
                          {trip.trip_time && <><Clock className="size-3 ml-1" /> {trip.trip_time.slice(0, 5)}</>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Collected</p>
                        <p className="font-display font-bold text-success">₹{collected.toLocaleString("en-IN")}</p>
                        {pend > 0 && <p className="text-[10px] font-semibold text-warning-foreground">Pending: ₹{pend.toLocaleString("en-IN")}</p>}
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {passengers.length === 0 ? (
                        <p className="p-4 text-xs text-muted-foreground text-center">No passengers recorded.</p>
                      ) : (
                        passengers.map(p => (
                          <div key={p.id} className="p-3 px-4 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                            <div>
                              <p className="font-medium text-sm flex items-center gap-1.5">
                                {p.name}
                                {p.payment_status === "paid" ? (
                                  <CheckCircle2 className="size-3.5 text-success" />
                                ) : (
                                  <CircleDashed className="size-3.5 text-warning-foreground" />
                                )}
                              </p>
                              {p.phone && <p className="text-[10px] text-muted-foreground mt-0.5">{p.phone}</p>}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">₹{Number(p.fare).toLocaleString("en-IN")}</p>
                              <span className={`text-[9px] uppercase font-bold tracking-widest ${p.payment_method === 'upi' ? 'text-accent' : 'text-muted-foreground'}`}>
                                {p.payment_method}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!isLoading && !data && (
          <div className="text-center py-14 text-muted-foreground">
            <LayoutList className="size-10 mx-auto opacity-40" />
            <p className="mt-3 text-sm">No data for this period.</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── PDF PRINT UI (HIDDEN ON SCREEN) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {data && (
        <div className="hidden print:block w-full font-sans text-black">
          {/* Header */}
          <div className="border-b-[3px] border-black pb-4 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-black m-0 p-0 leading-none">BLUWAVES</h1>
              <p className="text-sm font-semibold text-gray-500 tracking-widest uppercase mt-1">Boat Service Manager</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-800 m-0 p-0 leading-none">Statement of Account</h2>
              <p className="text-sm font-medium text-gray-600 mt-2">Period: {label}</p>
              <p className="text-xs text-gray-500 mt-0.5">Generated: {new Date().toLocaleString("en-IN")}</p>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="flex gap-4 mb-8">
            <div className="flex-1 bg-gray-100 p-4 rounded-lg border border-gray-200">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Trips</p>
              <p className="text-2xl font-bold text-black">{data.trips}</p>
              <p className="text-xs text-gray-600 mt-1">{data.passengers} passengers</p>
            </div>
            <div className="flex-1 bg-gray-100 p-4 rounded-lg border border-gray-200">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-black">₹{data.revenue.toLocaleString("en-IN")}</p>
              <p className="text-xs text-gray-600 mt-1">₹{data.cash.toLocaleString("en-IN")} Cash</p>
            </div>
            <div className="flex-1 bg-gray-100 p-4 rounded-lg border border-gray-200">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Digital (UPI)</p>
              <p className="text-2xl font-bold text-black">₹{data.upi.toLocaleString("en-IN")}</p>
              <p className="text-xs text-gray-600 mt-1">Linked payments</p>
            </div>
            <div className="flex-1 bg-gray-100 p-4 rounded-lg border border-gray-200">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Pending Dues</p>
              <p className="text-2xl font-bold text-black">₹{data.pending.toLocaleString("en-IN")}</p>
              <p className="text-xs text-gray-600 mt-1">Outstanding</p>
            </div>
          </div>

          {/* Ledger Table */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white border-b-2 border-black">
                <th className="text-left py-2 px-3 font-semibold w-1/3">Passenger</th>
                <th className="text-left py-2 px-3 font-semibold">Contact</th>
                <th className="text-center py-2 px-3 font-semibold">Method</th>
                <th className="text-center py-2 px-3 font-semibold">Status</th>
                <th className="text-right py-2 px-3 font-semibold">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.tripGroups.map((group) => {
                const collected = group.passengers.filter(p => p.payment_status === "paid").reduce((s, p) => s + Number(p.fare), 0);
                return (
                  <Fragment key={group.trip.id}>
                    {/* Trip Subheader Row */}
                    <tr className="bg-gray-100 border-y border-gray-300 print-avoid-break">
                      <td colSpan={4} className="py-2 px-3">
                        <span className="font-bold text-gray-900">{group.trip.name}</span>
                        <span className="text-gray-500 ml-2">
                          ({group.trip.trip_date} {group.trip.trip_time ? `at ${group.trip.trip_time.slice(0, 5)}` : ""})
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-gray-900">
                        ₹{collected.toLocaleString("en-IN")}
                      </td>
                    </tr>
                    {/* Passenger Rows */}
                    {group.passengers.length === 0 ? (
                      <tr className="border-b border-gray-200 print-avoid-break">
                        <td colSpan={5} className="py-2 px-3 text-center text-gray-500 italic">No passengers</td>
                      </tr>
                    ) : (
                      group.passengers.map((p) => (
                        <tr key={p.id} className="border-b border-gray-200 print-avoid-break">
                          <td className="py-2 px-3 text-gray-900 font-medium pl-6">{p.name}</td>
                          <td className="py-2 px-3 text-gray-600">{p.phone || "—"}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-600 border border-gray-300 rounded px-1.5 py-0.5">
                              {p.payment_method}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`text-[10px] uppercase font-bold tracking-widest ${p.payment_status === "paid" ? "text-green-700" : "text-red-600"}`}>
                              {p.payment_status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-gray-900">
                            ₹{Number(p.fare).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-[3px] border-black bg-gray-50">
                <td colSpan={4} className="py-3 px-3 text-right font-bold uppercase tracking-wider text-gray-700">
                  Total Collected
                </td>
                <td className="py-3 px-3 text-right font-bold text-lg text-black">
                  ₹{data.revenue.toLocaleString("en-IN")}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer Notes */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
            This is a computer generated statement and does not require a physical signature.
          </div>
        </div>
      )}
    </>
  );
}
