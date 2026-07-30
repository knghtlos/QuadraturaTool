import readXlsxFile, { type Sheet as ReadWorkbookSheet } from "read-excel-file/node";
import writeXlsxFile, { type Sheet as WriteWorkbookSheet, type SheetData } from "write-excel-file/node";
import { Prisma } from "@prisma/client";
import { toDate, toDecimal, toInteger, toStringOrNull } from "@/lib/coercion";
import { getDashboardData, getRecords } from "@/lib/repository";
import { prisma } from "@/lib/prisma";
import { sheetConfigs, type FieldConfig, type SheetConfig } from "@/lib/sheets";

type RawRow = Record<string, unknown>;

export type ImportSummary = {
  sheets: Array<{
    name: string;
    rows: number;
    imported: number;
  }>;
  warnings: string[];
};

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function sheetRows(workbook: ReadWorkbookSheet[], sheetName: string): RawRow[] {
  const sheet = workbook.find((candidate) => candidate.sheet === sheetName);
  if (!sheet) return [];

  const [headerRow, ...bodyRows] = sheet.data;
  if (!headerRow) return [];
  const headers = headerRow.map((value) => (isBlank(value) ? null : String(value)));
  const rows: RawRow[] = [];

  for (const row of bodyRows) {
    const item: RawRow = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) return;
      const value = row[index] ?? null;
      item[header] = value;
      if (!isBlank(value)) hasValue = true;
    });

    if (hasValue) rows.push(item);
  }

  return rows;
}

function hasSheet(workbook: ReadWorkbookSheet[], sheetName: string) {
  return workbook.some((sheet) => sheet.sheet === sheetName);
}

function rowReader(row: RawRow, fields: FieldConfig[]) {
  const normalizedEntries = new Map<string, { key: string; value: unknown }>();
  for (const [key, value] of Object.entries(row)) {
    normalizedEntries.set(normalize(key), { key, value });
  }

  const aliases = new Map<string, string>();
  for (const field of fields) {
    aliases.set(normalize(field.label), field.key);
    aliases.set(normalize(field.key), field.key);
    for (const alias of field.aliases ?? []) {
      aliases.set(normalize(alias), field.key);
    }
  }

  function get(fieldKey: string) {
    const field = fields.find((candidate) => candidate.key === fieldKey);
    const keys = [fieldKey, field?.label, ...(field?.aliases ?? [])].filter(Boolean).map(normalize);
    for (const key of keys) {
      const entry = normalizedEntries.get(key);
      if (entry && !isBlank(entry.value)) return entry.value;
    }
    return null;
  }

  function extra() {
    const extraValues: Record<string, unknown> = {};
    for (const [normalizedKey, entry] of normalizedEntries.entries()) {
      if (!aliases.has(normalizedKey) && !isBlank(entry.value)) {
        extraValues[entry.key] = entry.value;
      }
    }
    return Object.keys(extraValues).length > 0 ? extraValues : null;
  }

  return { get, extra };
}

function offerDataFromRow(row: RawRow, config: SheetConfig) {
  const reader = rowReader(row, config.fields);
  const codice = toStringOrNull(reader.get("codice"));
  return {
    externalId: toStringOrNull(reader.get("externalId")),
    codice,
    nome: codice,
    progetto: toStringOrNull(reader.get("progetto")),
    anno: toInteger(reader.get("anno")),
    importoApprovato: toDecimal(reader.get("importoApprovato")),
    importoInOfferta: toDecimal(reader.get("importoInOfferta"))
  };
}

function activityDataFromRow(row: RawRow, config: SheetConfig) {
  const reader = rowReader(row, config.fields);
  return {
    externalId: toStringOrNull(reader.get("externalId")),
    project: config.project ?? toStringOrNull(reader.get("project")) ?? "Altro",
    attivita: toStringOrNull(reader.get("attivita")),
    dataIniziativa: toDate(reader.get("dataIniziativa")),
    release: toStringOrNull(reader.get("release")),
    refLuxottica: toStringOrNull(reader.get("refLuxottica")),
    codiceRey: toStringOrNull(reader.get("codiceRey")),
    refStima: toStringOrNull(reader.get("refStima")),
    stato: toStringOrNull(reader.get("stato")),
    importo: toDecimal(reader.get("importo")),
    importoScontato: toDecimal(reader.get("importoScontato")),
    scontoPercent: toDecimal(reader.get("scontoPercent")),
    b2bCtia: toDecimal(reader.get("b2bCtia")),
    fe: toDecimal(reader.get("fe")),
    cms: toDecimal(reader.get("cms")),
    bff: toDecimal(reader.get("bff")),
    ctiaDevops: toDecimal(reader.get("ctiaDevops")),
    b2c: toDecimal(reader.get("b2c")),
    altriTeam: toDecimal(reader.get("altriTeam")),
    riferimentoStima: toStringOrNull(reader.get("riferimentoStima")),
    oldStima: toStringOrNull(reader.get("oldStima")),
    extra: reader.extra() as Prisma.JsonObject | null
  };
}

function commessaDataFromRow(row: RawRow, config: SheetConfig) {
  const reader = rowReader(row, config.fields);
  return {
    externalId: toStringOrNull(reader.get("externalId")),
    codice: toStringOrNull(reader.get("codice")),
    nome: toStringOrNull(reader.get("nome")),
    anno: toInteger(reader.get("anno"))
  };
}

function budgetLineRawFromRow(row: RawRow, config: SheetConfig) {
  const reader = rowReader(row, config.fields);
  return {
    data: {
      externalId: toStringOrNull(reader.get("externalId")),
      sheet: config.project ?? toStringOrNull(reader.get("sheet")) ?? "Altro",
      nome: toStringOrNull(reader.get("nome")),
      importo: toDecimal(reader.get("importo"))
    },
    activityValue: toStringOrNull(reader.get("activityId")),
    commessaValue: toStringOrNull(reader.get("commessaId")),
    offerValue: toStringOrNull(reader.get("offerId"))
  };
}

async function upsertByExternalId<T extends { externalId: string | null }>(
  externalId: string | null,
  create: () => Promise<T>,
  upsert: (externalId: string) => Promise<T>
) {
  if (!externalId) return create();
  return upsert(externalId);
}

function matchText(value: string | null | undefined, candidates: Array<string | null | undefined>) {
  if (!value) return false;
  const normalizedValue = normalize(value);
  return candidates.some((candidate) => normalize(candidate) === normalizedValue);
}

async function relationMaps() {
  const [offers, activities, commesse] = await Promise.all([
    prisma.offer.findMany(),
    prisma.activity.findMany(),
    prisma.commessa.findMany()
  ]);

  return {
    offer(value: string | null) {
      if (!value) return null;
      return (
        offers.find((offer) =>
          matchText(value, [
            offer.id,
            offer.externalId,
            offer.codice,
            offer.nome,
            `${offer.externalId} ${offer.codice ?? offer.nome}`
          ])
        )
          ?.id ?? null
      );
    },
    activity(value: string | null, project?: string) {
      if (!value) return null;
      return (
        activities.find(
          (activity) =>
            (!project || activity.project === project) &&
            matchText(value, [
              activity.id,
              activity.externalId,
              activity.attivita,
              activity.codiceRey,
              `${activity.externalId} ${activity.attivita}`
            ])
        )?.id ?? null
      );
    },
    commessa(value: string | null) {
      if (!value) return null;
      return (
        commesse.find((commessa) =>
          matchText(value, [
            commessa.id,
            commessa.externalId,
            commessa.codice,
            commessa.nome,
            `${commessa.codice} ${commessa.nome}`,
            `${commessa.codice} - ${commessa.nome}`
          ])
        )?.id ?? null
      );
    }
  };
}

export async function importWorkbook(buffer: Buffer): Promise<ImportSummary> {
  const workbook = await readXlsxFile(buffer);
  const summary: ImportSummary = { sheets: [], warnings: [] };
  const activityImportConfigs: SheetConfig[] = [
    sheetConfigs.activities,
    { ...sheetConfigs.activities, workbookName: "Activities - Leonardo", project: "Leonardo" },
    { ...sheetConfigs.activities, workbookName: "Activities - VIVA", project: "VIVA" },
    { ...sheetConfigs.activities, workbookName: "Activities - Intranet", project: "Intranet" }
  ];
  const budgetLineImportConfigs: SheetConfig[] = [
    sheetConfigs["budget-lines"],
    { ...sheetConfigs["budget-lines"], workbookName: "Budget Lines - Leonardo", project: "Leonardo" },
    { ...sheetConfigs["budget-lines"], workbookName: "Budget Lines - VIVA", project: "VIVA" },
    { ...sheetConfigs["budget-lines"], workbookName: "Budget Lines - Intranet", project: "Intranet" }
  ];

  for (const config of [sheetConfigs.offers, ...activityImportConfigs, sheetConfigs.commesse]) {
    const rows = sheetRows(workbook, config.workbookName);
    let imported = 0;

    for (const row of rows) {
      if (config.kind === "offers") {
        const data = offerDataFromRow(row, config);
        await upsertByExternalId(
          data.externalId,
          () => prisma.offer.create({ data: data as Prisma.OfferCreateInput }),
          (externalId) =>
            prisma.offer.upsert({
              where: { externalId },
              update: data as Prisma.OfferUpdateInput,
              create: data as Prisma.OfferCreateInput
            })
        );
      }

      if (config.kind === "activities") {
        const data = activityDataFromRow(row, config);
        await upsertByExternalId(
          data.externalId,
          () => prisma.activity.create({ data: data as Prisma.ActivityCreateInput }),
          (externalId) =>
            prisma.activity.upsert({
              where: { externalId },
              update: data as Prisma.ActivityUpdateInput,
              create: data as Prisma.ActivityCreateInput
            })
        );
      }

      if (config.kind === "commesse") {
        const data = commessaDataFromRow(row, config);
        await upsertByExternalId(
          data.externalId,
          () => prisma.commessa.create({ data: data as Prisma.CommessaCreateInput }),
          (externalId) =>
            prisma.commessa.upsert({
              where: { externalId },
              update: data as Prisma.CommessaUpdateInput,
              create: data as Prisma.CommessaCreateInput
            })
        );
      }

      imported += 1;
    }

    if (rows.length > 0 || hasSheet(workbook, config.workbookName)) {
      summary.sheets.push({ name: config.workbookName, rows: rows.length, imported });
    }
  }

  const maps = await relationMaps();

  for (const config of budgetLineImportConfigs) {
    const rows = sheetRows(workbook, config.workbookName);
    let imported = 0;

    for (const row of rows) {
      const raw = budgetLineRawFromRow(row, config);
      const data = {
        ...raw.data,
        activityId: maps.activity(raw.activityValue, config.project),
        commessaId: maps.commessa(raw.commessaValue),
        offerId: maps.offer(raw.offerValue)
      };

      if (!data.activityId && raw.activityValue) {
        summary.warnings.push(`${config.workbookName}: activity non trovata per "${raw.activityValue}".`);
      }
      if (!data.commessaId && raw.commessaValue) {
        summary.warnings.push(`${config.workbookName}: commessa non trovata per "${raw.commessaValue}".`);
      }
      if (!data.offerId && raw.offerValue) {
        summary.warnings.push(`${config.workbookName}: offer non trovata per "${raw.offerValue}".`);
      }

      if (data.externalId) {
        await prisma.budgetLine.upsert({
          where: { sheet_externalId: { sheet: data.sheet, externalId: data.externalId } },
          update: data as Prisma.BudgetLineUncheckedUpdateInput,
          create: data as Prisma.BudgetLineUncheckedCreateInput
        });
      } else {
        await prisma.budgetLine.create({ data: data as Prisma.BudgetLineUncheckedCreateInput });
      }
      imported += 1;
    }

    if (rows.length > 0 || hasSheet(workbook, config.workbookName)) {
      summary.sheets.push({ name: config.workbookName, rows: rows.length, imported });
    }
  }

  const hasActivities = hasSheet(workbook, "Activities") || activityImportConfigs.some((config) => hasSheet(workbook, config.workbookName));
  const hasBudgetLines = hasSheet(workbook, "BudgetLines") || budgetLineImportConfigs.some((config) => hasSheet(workbook, config.workbookName));

  if (!hasSheet(workbook, "Offers")) {
    summary.warnings.push("Foglio mancante nel workbook: Offers.");
  }
  if (!hasActivities) {
    summary.warnings.push("Foglio mancante nel workbook: Activities.");
  }
  if (!hasBudgetLines) {
    summary.warnings.push("Foglio mancante nel workbook: BudgetLines.");
  }
  if (!hasSheet(workbook, "Commesse")) {
    summary.warnings.push("Foglio mancante nel workbook: Commesse.");
  }

  return summary;
}

function exportValue(record: Record<string, unknown>, field: FieldConfig) {
  if (field.type === "relation") {
    if (field.key === "activityId") return record.activityLabel ?? record.activityExcelId ?? record.activityId ?? "";
    if (field.key === "commessaId") return record.commessaLabel ?? record.commessaId ?? "";
    if (field.key === "offerId") return record.offerLabel ?? record.offerId ?? "";
  }

  const value = record[field.key];
  if (field.type === "boolean") return value ? "TRUE" : "FALSE";
  if (field.type === "json") return value ? JSON.stringify(value) : "";
  return value ?? "";
}

async function sheetData(sheetKey: keyof typeof sheetConfigs) {
  const config = sheetConfigs[sheetKey];
  const records = await getRecords(sheetKey);
  return records.map((record) => {
    const row: Record<string, unknown> = {};
    for (const field of config.fields) {
      row[field.label] = exportValue(record, field);
    }
    return row;
  });
}

function exportCell(value: unknown) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function jsonSheet(name: string, rows: Array<Record<string, unknown>>): WriteWorkbookSheet<Buffer> {
  const effectiveRows = rows.length > 0 ? rows : [{}];
  const headers = Array.from(new Set(effectiveRows.flatMap((row) => Object.keys(row))));
  const data: SheetData = [
    headers.map((header) => ({
      value: header,
      type: String,
      fontWeight: "bold",
      backgroundColor: "#E7F0EE"
    })),
    ...rows.map((row) => headers.map((header) => exportCell(row[header])))
  ];
  const columns = headers.map((header) => ({
    width: Math.min(Math.max(String(header).length + 4, 12), 42)
  }));

  return {
    sheet: name,
    data,
    columns,
    stickyRowsCount: 1
  };
}

export async function buildWorkbookBuffer() {
  const workbook: WriteWorkbookSheet<Buffer>[] = [];

  for (const sheetKey of ["offers", "activities", "budget-lines", "commesse"] as const) {
    workbook.push(jsonSheet(sheetConfigs[sheetKey].workbookName, await sheetData(sheetKey)));
  }

  const dashboard = await getDashboardData();
  const appRows: Array<Record<string, unknown>> = [
    { Blocco: "KPI", Metrica: "Offers", Valore: dashboard.kpis.offers },
    { Blocco: "KPI", Metrica: "Activities", Valore: dashboard.kpis.activities },
    { Blocco: "KPI", Metrica: "BudgetLines", Valore: dashboard.kpis.budgetLines },
    { Blocco: "KPI", Metrica: "Commesse", Valore: dashboard.kpis.commesse },
    { Blocco: "KPI", Metrica: "Importo approvato", Valore: dashboard.kpis.approvedAmount },
    { Blocco: "KPI", Metrica: "Importo offerta", Valore: dashboard.kpis.offeredAmount },
    { Blocco: "KPI", Metrica: "Gap", Valore: dashboard.kpis.gap },
    ...dashboard.byOffer.map((item) => ({
      Blocco: "Offerta",
      Metrica: item.label,
      Valore: item.total,
      Record: item.count
    })),
    ...dashboard.byCommessa.map((item) => ({
      Blocco: "Commessa",
      Metrica: item.label,
      Valore: item.total,
      Record: item.count
    })),
    ...dashboard.byActivity.map((item) => ({
      Blocco: "Attività",
      Metrica: item.label,
      Valore: item.total,
      Record: item.count
    })),
    ...dashboard.warnings.map((item) => ({
      Blocco: "Warning",
      Metrica: item.label,
      Valore: item.count,
      Severita: item.severity
    }))
  ];

  workbook.push(jsonSheet("General", appRows));
  const output = writeXlsxFile(workbook, {
    fontFamily: "Arial",
    fontSize: 11
  });
  return output.toBuffer();
}
