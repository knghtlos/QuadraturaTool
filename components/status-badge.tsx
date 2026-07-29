import { Badge, type BadgeProps } from "@/components/ui/badge";

function statusVariant(value: unknown): BadgeProps["variant"] {
  const status = String(value ?? "").toLowerCase();
  if (!status) return "neutral";
  if (/(ok|approv|chius|complet|consunt|done|vinto|attiv)/.test(status)) return "success";
  if (/(warn|bozza|draft|prepara|attesa|pending|stim)/.test(status)) return "warning";
  if (/(annull|ko|blocc|pers|rifiut|erro)/.test(status)) return "danger";
  return "secondary";
}

export function StatusBadge({ value }: { value: unknown }) {
  const text = String(value ?? "").trim();
  if (!text) return <Badge variant="neutral">Non assegnato</Badge>;
  return <Badge variant={statusVariant(text)}>{text}</Badge>;
}
