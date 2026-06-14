import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Mail, Phone, Plus, RefreshCw, Send, Trash2, Users, Radio } from "lucide-react";
import { toast } from "sonner";
import {
  addSecurityContact,
  deleteSecurityContact,
  fetchAlertDispatches,
  fetchSecurityContacts,
  sendTestSecurityAlert,
  type AlertDispatch,
  type SecurityContact,
} from "@/lib/api";
import { useBackendHealth } from "@/hooks/use-backend";

function friendlyLoadError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Backend is not reachable. Start it with: cd backend && python app.py";
  }
  if (lower.includes("security_contacts") || lower.includes("does not exist")) {
    return "Security tables missing in Supabase. Run backend/supabase_schema.sql in the SQL editor.";
  }
  return message;
}

export function SecurityPersonnelPanel() {
  const { data: backendUp } = useBackendHealth();
  const [contacts, setContacts] = useState<SecurityContact[]>([]);
  const [dispatches, setDispatches] = useState<AlertDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (backendUp === false) {
        setLoadError(
          "Backend is offline. Security settings need the API on port 5000 (python app.py)."
        );
        setLoading(false);
        return;
      }
      if (backendUp !== true) return;

      if (!opts?.silent) setLoading(true);
      try {
        const [c, d] = await Promise.all([fetchSecurityContacts(), fetchAlertDispatches()]);
        setContacts(c);
        setDispatches(d);
        setLoadError(null);
      } catch (e) {
        const msg = friendlyLoadError(e instanceof Error ? e.message : "Unknown error");
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
    },
    [backendUp]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (backendUp !== true) return;
    const id = window.setInterval(() => load({ silent: true }), 30000);
    return () => clearInterval(id);
  }, [backendUp, load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!email.trim() && !phone.trim()) {
      toast.error("Add at least an email or phone number");
      return;
    }
    try {
      await addSecurityContact({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notify_email: notifyEmail,
        notify_sms: notifySms,
      });
      toast.success(`Added ${name} to security alerts`);
      setName("");
      setEmail("");
      setPhone("");
      load({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSecurityContact(id);
      toast.success("Contact removed");
      load({ silent: true });
    } catch {
      toast.error("Could not remove contact");
    }
  };

  const handleTest = async () => {
    setSending(true);
    try {
      await sendTestSecurityAlert();
      toast.success("Test alert sent to all security personnel");
      setTimeout(() => load({ silent: true }), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-5 lg:col-span-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-primary" />
          Security Personnel — Alert Dispatch
        </h3>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-mono text-destructive">
            <Radio className="w-3 h-3 animate-pulse" />
            AUTO-SEND ON DETECTION
          </span>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading || backendUp !== true}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            title="Refresh security settings"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={sending || contacts.length === 0 || backendUp !== true}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 disabled:opacity-40 transition-colors"
          >
            <Send className="w-3 h-3" />
            {sending ? "Sending…" : "Test Alert"}
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex gap-2 items-start p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs text-foreground"
        >
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="leading-relaxed">{loadError}</p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        When the AI detects violence, weapons, or suspicious behavior, alerts are automatically
        sent via <strong className="text-foreground">email</strong> (and SMS if configured) to
        everyone listed below.
      </p>

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name *"
          className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50"
          required
          disabled={backendUp !== true}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50"
          disabled={backendUp !== true}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (+91...)"
          className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50"
          disabled={backendUp !== true}
        />
        <button
          type="submit"
          disabled={backendUp !== true}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Personnel
        </button>
      </form>

      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
            className="rounded border-border"
          />
          <Mail className="w-3 h-3 text-muted-foreground" />
          Email alerts
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notifySms}
            onChange={(e) => setNotifySms(e.target.checked)}
            className="rounded border-border"
          />
          <Phone className="w-3 h-3 text-muted-foreground" />
          SMS alerts (Twilio)
        </label>
      </div>

      {loading ? (
        <p className="text-xs font-mono text-muted-foreground">Loading personnel…</p>
      ) : contacts.length === 0 && !loadError ? (
        <p className="text-xs font-mono text-muted-foreground p-4 border border-dashed border-border rounded-lg text-center">
          No security personnel yet. Add contacts above, or set ALERT_EMAILS in backend .env
        </p>
      ) : contacts.length === 0 ? null : (
        <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{c.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground truncate">
                  {c.email || "—"} {c.phone ? `• ${c.phone}` : ""}
                </p>
                <p className="text-[9px] text-primary mt-0.5">
                  {c.notify_email ? "Email" : ""}
                  {c.notify_email && c.notify_sms ? " + " : ""}
                  {c.notify_sms ? "SMS" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
          Recent dispatch log
        </h4>
        <div className="max-h-36 overflow-y-auto scrollbar-thin space-y-1">
          {dispatches.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">No dispatches yet</p>
          ) : (
            dispatches.slice(0, 15).map((d) => (
              <div
                key={d.id}
                className="flex justify-between gap-2 text-[10px] font-mono py-1 border-b border-border/30"
              >
                <span className="text-muted-foreground truncate">
                  {d.channel} → {d.contact_name || d.contact_id || "—"}
                </span>
                <span className={d.status === "sent" ? "text-success" : "text-destructive"}>
                  {d.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
