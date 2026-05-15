import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  MessageSquareText, Link2, Unlink, Trash2, BadgeCheck,
  X, ArrowDownLeft, ArrowUpRight, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/sms")({ component: SmsInbox });

/* ─── Types ──────────────────────────────────────────────────────────── */
type SmsMsg = {
  id: string;
  amount: number;
  upi_ref: string | null;
  upi_id: string | null;
  sender_name: string | null;
  bank_to: string | null;
  bank_from: string | null;
  from_number: string | null;
  received_at: string;
  text: string;
  linked_passenger_id: string | null;
};

type PendingPax = {
  id: string;
  name: string;
  fare: number;
  trip_name?: string;
  trip_date?: string;
};

type FilterTab = "all" | "received" | "sent" | "linked" | "unlinked";

/* ─── Detect transaction direction from SMS text ─────────────────────── */
function detectDirection(text: string): "received" | "sent" | "unknown" {
  const t = text.toLowerCase();
  if (
    t.includes("credited") ||
    t.includes("received") ||
    t.includes("credit") ||
    t.includes("deposited")
  ) return "received";
  if (
    t.includes("debited") ||
    t.includes("sent") ||
    t.includes("debit") ||
    t.includes("paid") ||
    t.includes("withdrawn")
  ) return "sent";
  return "unknown";
}

/* ─── Toast ──────────────────────────────────────────────────────────── */
function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const show = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

/* ─── Main Page ───────────────────────────────────────────────────────── */
function SmsInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<FilterTab>("all");
  const [linking, setLinking] = useState<{ smsId: string; amount: number | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SmsMsg | null>(null);
  const { toast, show: showToast } = useToast();

  const { data: msgs, isLoading } = useQuery({
    queryKey: ["sms", user?.userId],
    queryFn: async () => {
      const res = await fetch("/api/sms-messages/", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load SMS");
      const d = await res.json();
      return d.messages as SmsMsg[];
    },
    enabled: !!user,
  });

  /* Unlink mutation */
  const unlinkMut = useMutation({
    mutationFn: async (smsId: string) => {
      const res = await fetch(`/api/sms-messages/${smsId}`, {
        method: "PATCH", credentials: "include",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) throw new Error("Unlink failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms"] });
      showToast("Passenger unlinked");
    },
    onError: () => showToast("Failed to unlink", "error"),
  });

  /* Delete mutation */
  const deleteMut = useMutation({
    mutationFn: async (smsId: string) => {
      const res = await fetch(`/api/sms-messages/${smsId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms"] });
      setConfirmDelete(null);
      showToast("SMS deleted");
    },
    onError: () => showToast("Failed to delete", "error"),
  });

  /* Filtered messages */
  const filtered = (msgs ?? []).filter((m) => {
    const dir = detectDirection(m.text);
    if (tab === "received") return dir === "received";
    if (tab === "sent") return dir === "sent";
    if (tab === "linked") return !!m.linked_passenger_id;
    if (tab === "unlinked") return !m.linked_passenger_id;
    return true;
  });

  const counts = {
    all: (msgs ?? []).length,
    received: (msgs ?? []).filter(m => detectDirection(m.text) === "received").length,
    sent: (msgs ?? []).filter(m => detectDirection(m.text) === "sent").length,
    linked: (msgs ?? []).filter(m => !!m.linked_passenger_id).length,
    unlinked: (msgs ?? []).filter(m => !m.linked_passenger_id).length,
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all",      label: `All (${counts.all})` },
    { key: "received", label: `Received (${counts.received})` },
    { key: "sent",     label: `Sent (${counts.sent})` },
    { key: "linked",   label: `Linked (${counts.linked})` },
    { key: "unlinked", label: `Unlinked (${counts.unlinked})` },
  ];

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-semibold">UPI SMS Inbox</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Bank payment messages received via webhook. Link to passengers, unlink, or delete.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              "shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all",
              tab === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-14 text-muted-foreground">
          <MessageSquareText className="size-10 mx-auto opacity-40" />
          <p className="mt-3 text-sm font-medium">No messages here</p>
          <p className="text-xs mt-1 opacity-60">
            {tab === "all" ? "Send a test via the Python script or your phone." : "Try another filter."}
          </p>
        </div>
      )}

      {/* Message list */}
      <ul className="space-y-3">
        {filtered.map((m) => {
          const dir = detectDirection(m.text);
          const isReceived = dir === "received";
          const isSent = dir === "sent";

          return (
            <li key={m.id} className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-soft)]">

              {/* Top row: direction icon + amount + link badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {/* Direction icon bubble — uses app palette */}
                  <span className={[
                    "flex items-center justify-center size-9 rounded-xl shrink-0",
                    isReceived ? "bg-accent/15 text-accent" : isSent ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
                  ].join(" ")}>
                    {isReceived
                      ? <ArrowDownLeft className="size-4" />
                      : isSent
                      ? <ArrowUpRight className="size-4" />
                      : <MessageSquareText className="size-4" />}
                  </span>

                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <p className="font-display text-xl font-bold">
                        ₹{Number(m.amount ?? 0).toLocaleString("en-IN")}
                      </p>
                      {/* Received / Sent label */}
                      {isReceived && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">IN</span>
                      )}
                      {isSent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">OUT</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {m.from_number || m.sender_name || "—"} · {new Date(m.received_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>

                {/* Link / Linked badge */}
                {m.linked_passenger_id ? (
                  <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-success/15 text-success font-medium shrink-0">
                    <BadgeCheck className="size-3" /> Linked
                  </span>
                ) : (
                  <button
                    onClick={() => setLinking({ smsId: m.id, amount: m.amount })}
                    className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 active:scale-95 transition-all shrink-0"
                  >
                    <Link2 className="size-3" /> Link
                  </button>
                )}
              </div>

              {/* SMS body */}
              <p className="text-[13px] mt-3 leading-snug text-foreground/75">{m.text}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {m.upi_ref   && <Tag>Ref: {m.upi_ref}</Tag>}
                {m.upi_id    && <Tag>{m.upi_id}</Tag>}
                {m.sender_name && <Tag>From: {m.sender_name}</Tag>}
                {m.bank_from && <Tag>From: {m.bank_from}</Tag>}
                {m.bank_to   && <Tag>To: {m.bank_to}</Tag>}
              </div>

              {/* Action row */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                {m.linked_passenger_id && (
                  <button
                    onClick={() => unlinkMut.mutate(m.id)}
                    disabled={unlinkMut.isPending}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/70 active:scale-95 transition-all disabled:opacity-50 font-medium"
                  >
                    <Unlink className="size-3.5" />
                    {unlinkMut.isPending ? "Unlinking…" : "Unlink"}
                  </button>
                )}
                <button
                  onClick={() => setConfirmDelete(m)}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 active:scale-95 transition-all ml-auto font-medium"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Link Sheet */}
      {linking && (
        <LinkSheet
          smsId={linking.smsId}
          amount={linking.amount}
          onClose={() => setLinking(null)}
          onLinked={() => {
            setLinking(null);
            qc.invalidateQueries({ queryKey: ["sms"] });
            showToast("Passenger linked successfully");
          }}
        />
      )}

      {/* Delete Confirm Dialog */}
      {confirmDelete && (
        <ConfirmDeleteDialog
          msg={confirmDelete}
          isPending={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(confirmDelete.id)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={[
          "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-[var(--shadow-elevated)] animate-in slide-in-from-bottom-4 whitespace-nowrap",
          toast.type === "success" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground",
        ].join(" ")}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ─── Tag chip ────────────────────────────────────────────────────────── */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[11px]">
      {children}
    </span>
  );
}

/* ─── Link Sheet ──────────────────────────────────────────────────────── */
function LinkSheet({ smsId, amount, onClose, onLinked }: {
  smsId: string; amount: number | null; onClose: () => void; onLinked: () => void;
}) {
  const { data: pending } = useQuery({
    queryKey: ["pending-pax"],
    queryFn: async () => {
      const now = new Date().toISOString().slice(0, 10);
      const aRes = await fetch(`/api/analytics/?from=2020-01-01&to=${now}`, { credentials: "include" });
      const d = await aRes.json();
      const allPax: PendingPax[] = [];
      for (const g of d.tripGroups ?? []) {
        for (const p of g.passengers) {
          if (p.payment_status !== "paid") {
            allPax.push({ id: p.id, name: p.name, fare: p.fare, trip_name: g.trip.name, trip_date: g.trip.trip_date });
          }
        }
      }
      return allPax;
    },
  });

  async function link(passengerId: string) {
    await fetch("/api/sms-messages/", {
      method: "PATCH", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sms_id: smsId, passenger_id: passengerId }),
    });
    onLinked();
  }

  return (
    <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-auto bg-background rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto shadow-[var(--shadow-elevated)]"
      >
        <div className="w-12 h-1 bg-border rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl font-semibold">Link to passenger</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-5" />
          </button>
        </div>
        {amount && (
          <p className="text-sm text-muted-foreground mb-4">
            Amount: <span className="font-semibold text-foreground ml-1">₹{Number(amount).toLocaleString("en-IN")}</span>
          </p>
        )}
        <ul className="space-y-2">
          {pending?.length === 0 && (
            <li className="text-sm text-muted-foreground text-center py-8">No pending passengers.</li>
          )}
          {pending?.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => link(p.id)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border hover:border-ring hover:shadow-[var(--shadow-soft)] transition-all active:scale-[0.99]"
              >
                <div className="text-left">
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.trip_name} · {p.trip_date}</p>
                </div>
                <p className="font-display font-semibold text-sm">₹{Number(p.fare).toLocaleString("en-IN")}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Confirm Delete Dialog ───────────────────────────────────────────── */
function ConfirmDeleteDialog({ msg, isPending, onCancel, onConfirm }: {
  msg: SmsMsg; isPending: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-background rounded-3xl p-6 shadow-[var(--shadow-elevated)] animate-in zoom-in-95"
      >
        <div className="flex items-center justify-center size-12 rounded-2xl bg-secondary mx-auto mb-4">
          <AlertTriangle className="size-6 text-foreground" />
        </div>
        <h3 className="font-display text-lg font-semibold text-center">Delete this SMS?</h3>
        <p className="text-sm text-muted-foreground text-center mt-1">
          ₹{Number(msg.amount ?? 0).toLocaleString("en-IN")} · {msg.from_number || msg.sender_name || "Unknown sender"}
        </p>
        {msg.linked_passenger_id && (
          <p className="text-xs text-muted-foreground text-center bg-secondary rounded-xl px-3 py-2 mt-3">
            This SMS is linked to a passenger. Deleting will revert their payment to pending.
          </p>
        )}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
