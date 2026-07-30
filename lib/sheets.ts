import { BarChart3, BriefcaseBusiness, ClipboardList, Euro, FileSpreadsheet, Mail } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SheetKey = "activities" | "budget-lines" | "offers" | "commesse";

export type FieldType =
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "boolean"
  | "select"
  | "relation"
  | "json"
  | "derived";

export type OptionType =
  | "STATO_BL"
  | "STATO_OFFERTA"
  | "TIPOLOGIA_COMMESSA"
  | "STATO_COMMESSA"
  | "STATO_ACTIVITY";

export type LookupType = "offers" | "activities" | "commesse";

export const configTypes = [
  "STATO_BL",
  "STATO_OFFERTA",
  "TIPOLOGIA_COMMESSA",
  "STATO_COMMESSA",
  "STATO_ACTIVITY"
] as const;

export type FieldConfig = {
  key: string;
  label: string;
  aliases?: string[];
  type: FieldType;
  optionType?: OptionType;
  lookupType?: LookupType;
  readonly?: boolean;
  required?: boolean;
  table?: boolean;
  filter?: boolean;
  width?: number;
};

export type SheetConfig = {
  key: SheetKey;
  workbookName: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  kind: "offers" | "activities" | "budgetLines" | "commesse";
  project?: string;
  fields: FieldConfig[];
};

export const activityFields: FieldConfig[] = [
  { key: "externalId", label: "ID", type: "text", table: true, width: 90 },
  { key: "project", label: "Progetto", type: "text", table: true, filter: true },
  { key: "attivita", label: "Attività", type: "text", table: true, width: 260 },
  { key: "stato", label: "Stato stima", aliases: ["Stato"], type: "select", optionType: "STATO_ACTIVITY", table: true, filter: true },
  { key: "importo", label: "Importo", type: "currency", table: true },
  { key: "importoScontato", label: "Importo offerta", aliases: ["Importo scontato"], type: "currency", table: true },
  { key: "b2bCtia", label: "Importo - Team1", aliases: ["B2B - CTIA"], type: "currency", table: true },
  { key: "fe", label: "Importo - Team2", aliases: ["FE"], type: "currency", table: true },
  { key: "cms", label: "Importo - Team3", aliases: ["CMS"], type: "currency", table: true },
  { key: "bff", label: "Importo - Team4", aliases: ["BFF"], type: "currency", table: true },
  { key: "ctiaDevops", label: "Importo - Team5", aliases: ["CTIA - DevOps"], type: "currency", table: true },
  { key: "riferimentoStima", label: "Link", aliases: ["Riferimento stima"], type: "text", table: true, width: 180 },
  { key: "oldStima", label: "Note", aliases: ["Old stima"], type: "text", table: true, width: 260 },
  { key: "dataIniziativa", label: "Data iniziativa", type: "date" },
  { key: "release", label: "RELEASE", type: "text" },
  { key: "refLuxottica", label: "Ref. Luxottica", type: "text" },
  { key: "codiceRey", label: "Codice REY", type: "text" },
  { key: "refStima", label: "Ref. Stima", type: "text" },
  { key: "scontoPercent", label: "Sconto %", type: "percent" },
  { key: "b2c", label: "B2C", type: "currency" },
  { key: "altriTeam", label: "Altri team", type: "currency" },
  { key: "extra", label: "Extra", type: "json" }
];

export const budgetLineFields: FieldConfig[] = [
  { key: "externalId", label: "ID", type: "text", table: true, width: 90 },
  { key: "nome", label: "Nome", type: "text", table: true, width: 260 },
  { key: "commessaId", label: "Commessa", type: "relation", lookupType: "commesse", table: true, filter: true },
  { key: "activityId", label: "Attività", aliases: ["Activity", "Activities"], type: "relation", lookupType: "activities", table: true, filter: true },
  { key: "importo", label: "Importo", type: "currency", table: true },
  { key: "offerId", label: "Offerta", aliases: ["Offer", "Offers"], type: "relation", lookupType: "offers", table: true, filter: true }
];

export const offerFields: FieldConfig[] = [
  { key: "externalId", label: "ID", type: "text", table: true, width: 90 },
  { key: "codice", label: "Codice", aliases: ["Nome", "REY", "Codice REY"], type: "text", table: true, width: 180 },
  { key: "anno", label: "Anno", type: "number", table: true, filter: true },
  { key: "progetto", label: "Progetto", type: "text", table: true, filter: true },
  { key: "importoApprovato", label: "Importo approvato", aliases: ["Importo finale"], type: "currency", table: true },
  { key: "importoInOfferta", label: "Importo offerta", aliases: ["Importo in offerta"], type: "currency", table: true }
];

export const commessaFields: FieldConfig[] = [
  { key: "externalId", label: "ID", type: "text", table: true, width: 90 },
  { key: "codice", label: "Codice", type: "text", table: true },
  { key: "nome", label: "Nome", type: "text", table: true, width: 220 },
  { key: "anno", label: "Anno", type: "number", table: true, filter: true }
];

export const sheetConfigs: Record<SheetKey, SheetConfig> = {
  activities: {
    key: "activities",
    workbookName: "Activities",
    title: "Activities",
    shortTitle: "Activities",
    description: "Attività aggregate per progetto e ripartizione team.",
    icon: ClipboardList,
    kind: "activities",
    fields: activityFields
  },
  "budget-lines": {
    key: "budget-lines",
    workbookName: "BudgetLines",
    title: "BudgetLines",
    shortTitle: "BudgetLines",
    description: "Budget line con commessa, attività, importo e offerta collegata.",
    icon: Euro,
    kind: "budgetLines",
    fields: budgetLineFields
  },
  offers: {
    key: "offers",
    workbookName: "Offers",
    title: "Offers",
    shortTitle: "Offers",
    description: "Offerte con codice, progetto, anno e importi approvati/offerta.",
    icon: FileSpreadsheet,
    kind: "offers",
    fields: offerFields
  },
  commesse: {
    key: "commesse",
    workbookName: "Commesse",
    title: "Commesse",
    shortTitle: "Commesse",
    description: "Commesse con codice, nome e anno.",
    icon: BriefcaseBusiness,
    kind: "commesse",
    fields: commessaFields
  }
};

export const navigationItems = [
  {
    title: "General",
    href: "/",
    icon: BarChart3
  },
  {
    title: "Activities",
    href: "/sheets/activities",
    icon: ClipboardList
  },
  {
    title: "BudgetLines",
    href: "/sheets/budget-lines",
    icon: Euro
  },
  {
    title: "Offers",
    href: "/sheets/offers",
    icon: FileSpreadsheet
  },
  {
    title: "Commesse",
    href: "/sheets/commesse",
    icon: BriefcaseBusiness
  },
  {
    title: "Fatturazione",
    href: "/billing",
    icon: Mail
  }
];

export const workbookSheetNames = ["Offers", "Activities", "BudgetLines", "Commesse", "General"] as const;

export function getSheetConfig(key: string) {
  return sheetConfigs[key as SheetKey] ?? null;
}

export function isSheetKey(key: string): key is SheetKey {
  return key in sheetConfigs;
}
