import { Prisma } from "@prisma/client";
import { decimalToNumber, parseJsonObject, toDate, toDecimal, toInteger, toStringOrNull } from "@/lib/coercion";
import { configTypes, getSheetConfig, isSheetKey, type SheetConfig, type SheetKey } from "@/lib/sheets";
import { prisma } from "@/lib/prisma";

export type GovernanceRecord = Record<string, unknown> & {
  id: string;
};

export type LookupOption = {
  id: string;
  label: string;
  meta?: string | null;
};

export type LookupPayload = {
  lookups: Record<"offers" | "activities" | "commesse", LookupOption[]>;
  options: Record<string, string[]>;
  configTypes: typeof configTypes;
};

function ensureSheet(sheetKey: string): SheetConfig {
  const config = getSheetConfig(sheetKey);
  if (!config) {
    throw new Error(`Foglio non supportato: ${sheetKey}`);
  }
  return config;
}

function relationLabel(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim().length > 0)
    .join(" · ");
}

function budgetLineTotal(lines: Array<{ importo: Prisma.Decimal | number | string | null }>) {
  return lines.reduce((sum, line) => sum + decimalToNumber(line.importo), 0);
}

function mapOffer(offer: Prisma.OfferGetPayload<{ include: { budgetLines: true } }>) {
  const importoApprovato = decimalToNumber(offer.importoApprovato);
  const importoInOfferta = decimalToNumber(offer.importoInOfferta);
  const codice = offer.codice ?? offer.nome;

  return {
    id: offer.id,
    externalId: offer.externalId,
    codice,
    progetto: offer.progetto,
    anno: offer.anno,
    importoApprovato,
    importoInOfferta,
    updatedAt: offer.updatedAt.toISOString()
  };
}

function mapActivity(activity: Prisma.ActivityGetPayload<{ include: { budgetLines: true } }>) {
  return {
    id: activity.id,
    externalId: activity.externalId,
    project: activity.project,
    attivita: activity.attivita,
    dataIniziativa: activity.dataIniziativa?.toISOString().slice(0, 10) ?? null,
    release: activity.release,
    refLuxottica: activity.refLuxottica,
    codiceRey: activity.codiceRey,
    refStima: activity.refStima,
    stato: activity.stato,
    importo: decimalToNumber(activity.importo),
    importoScontato: decimalToNumber(activity.importoScontato),
    scontoPercent: decimalToNumber(activity.scontoPercent),
    b2bCtia: decimalToNumber(activity.b2bCtia),
    fe: decimalToNumber(activity.fe),
    cms: decimalToNumber(activity.cms),
    bff: decimalToNumber(activity.bff),
    ctiaDevops: decimalToNumber(activity.ctiaDevops),
    b2c: decimalToNumber(activity.b2c),
    altriTeam: decimalToNumber(activity.altriTeam),
    riferimentoStima: activity.riferimentoStima,
    oldStima: activity.oldStima,
    budget: budgetLineTotal(activity.budgetLines),
    budgetLineCount: activity.budgetLines.length,
    extra: activity.extra,
    updatedAt: activity.updatedAt.toISOString()
  };
}

function mapBudgetLine(
  line: Prisma.BudgetLineGetPayload<{ include: { activity: true; commessa: true; offer: true } }>
) {
  return {
    id: line.id,
    externalId: line.externalId,
    nome: line.nome,
    activityId: line.activityId,
    activityLabel: line.activity
      ? relationLabel([line.activity.externalId, line.activity.attivita, line.activity.project])
      : null,
    commessaId: line.commessaId,
    commessaLabel: line.commessa ? relationLabel([line.commessa.codice, line.commessa.nome]) : null,
    offerId: line.offerId,
    offerLabel: line.offer ? relationLabel([line.offer.externalId, line.offer.codice ?? line.offer.nome]) : null,
    importo: decimalToNumber(line.importo),
    updatedAt: line.updatedAt.toISOString()
  };
}

function mapCommessa(commessa: Prisma.CommessaGetPayload<{ include: { budgetLines: true } }>) {
  return {
    id: commessa.id,
    externalId: commessa.externalId,
    codice: commessa.codice,
    nome: commessa.nome,
    anno: commessa.anno,
    updatedAt: commessa.updatedAt.toISOString()
  };
}

export async function getRecords(sheetKey: SheetKey): Promise<GovernanceRecord[]> {
  const config = ensureSheet(sheetKey);

  if (config.kind === "offers") {
    const offers = await prisma.offer.findMany({
      include: { budgetLines: true },
      orderBy: [{ updatedAt: "desc" }, { codice: "asc" }]
    });
    return offers.map(mapOffer);
  }

  if (config.kind === "activities") {
    const activities = await prisma.activity.findMany({
      where: config.project ? { project: config.project } : undefined,
      include: { budgetLines: true },
      orderBy: [{ updatedAt: "desc" }, { attivita: "asc" }]
    });
    return activities.map(mapActivity);
  }

  if (config.kind === "budgetLines") {
    const lines = await prisma.budgetLine.findMany({
      where: config.project ? { sheet: config.project } : undefined,
      include: { activity: true, commessa: true, offer: true },
      orderBy: [{ updatedAt: "desc" }, { nome: "asc" }]
    });
    return lines.map(mapBudgetLine);
  }

  if (config.kind === "commesse") {
    const commesse = await prisma.commessa.findMany({
      include: { budgetLines: true },
      orderBy: [{ anno: "desc" }, { codice: "asc" }]
    });
    return commesse.map(mapCommessa);
  }

  throw new Error(`Foglio non supportato: ${sheetKey}`);
}

export async function getLookups(): Promise<LookupPayload> {
  const [offers, activities, commesse, options] = await Promise.all([
    prisma.offer.findMany({ orderBy: [{ anno: "desc" }, { codice: "asc" }] }),
    prisma.activity.findMany({ orderBy: [{ project: "asc" }, { attivita: "asc" }] }),
    prisma.commessa.findMany({ orderBy: [{ anno: "desc" }, { codice: "asc" }] }),
    prisma.configOption.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { value: "asc" }] })
  ]);

  const groupedOptions: Record<string, string[]> = {};
  for (const option of options) {
    groupedOptions[option.type] ??= [];
    groupedOptions[option.type].push(option.value);
  }

  return {
    lookups: {
      offers: offers.map((offer) => ({
        id: offer.id,
        label: relationLabel([offer.externalId, offer.codice ?? offer.nome]),
        meta: relationLabel([offer.progetto, offer.anno])
      })),
      activities: activities.map((activity) => ({
        id: activity.id,
        label: relationLabel([activity.externalId, activity.attivita]),
        meta: activity.project
      })),
      commesse: commesse.map((commessa) => ({
        id: commessa.id,
        label: relationLabel([commessa.codice, commessa.nome]),
        meta: relationLabel([commessa.progetto, commessa.anno])
      }))
    },
    options: groupedOptions,
    configTypes
  };
}

function maybeSetText(data: Record<string, unknown>, values: Record<string, unknown>, key: string) {
  if (Object.prototype.hasOwnProperty.call(values, key)) data[key] = toStringOrNull(values[key]);
}

function maybeSetInt(data: Record<string, unknown>, values: Record<string, unknown>, key: string) {
  if (Object.prototype.hasOwnProperty.call(values, key)) data[key] = toInteger(values[key]);
}

function maybeSetDecimal(data: Record<string, unknown>, values: Record<string, unknown>, key: string) {
  if (Object.prototype.hasOwnProperty.call(values, key)) data[key] = toDecimal(values[key]);
}

function maybeSetDate(data: Record<string, unknown>, values: Record<string, unknown>, key: string) {
  if (Object.prototype.hasOwnProperty.call(values, key)) data[key] = toDate(values[key]);
}

function maybeSetJson(data: Record<string, unknown>, values: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(values, key)) return;
  const parsed = parseJsonObject(values[key]);
  data[key] = parsed ? (parsed as Prisma.JsonObject) : Prisma.DbNull;
}

function offerData(values: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  maybeSetText(data, values, "externalId");
  maybeSetText(data, values, "codice");
  if (Object.prototype.hasOwnProperty.call(values, "codice")) {
    data.nome = data.codice;
  }
  maybeSetText(data, values, "progetto");
  maybeSetInt(data, values, "anno");
  maybeSetDecimal(data, values, "importoApprovato");
  maybeSetDecimal(data, values, "importoInOfferta");
  return data;
}

function activityData(values: Record<string, unknown>, project?: string) {
  const data: Record<string, unknown> = {};
  if (project) data.project = project;
  maybeSetText(data, values, "project");
  data.project ??= "Altro";
  maybeSetText(data, values, "externalId");
  maybeSetText(data, values, "attivita");
  maybeSetDate(data, values, "dataIniziativa");
  maybeSetText(data, values, "release");
  maybeSetText(data, values, "refLuxottica");
  maybeSetText(data, values, "codiceRey");
  maybeSetText(data, values, "refStima");
  maybeSetText(data, values, "stato");
  maybeSetDecimal(data, values, "importo");
  maybeSetDecimal(data, values, "importoScontato");
  maybeSetDecimal(data, values, "scontoPercent");
  maybeSetDecimal(data, values, "b2bCtia");
  maybeSetDecimal(data, values, "fe");
  maybeSetDecimal(data, values, "cms");
  maybeSetDecimal(data, values, "bff");
  maybeSetDecimal(data, values, "ctiaDevops");
  maybeSetDecimal(data, values, "b2c");
  maybeSetDecimal(data, values, "altriTeam");
  maybeSetText(data, values, "riferimentoStima");
  maybeSetText(data, values, "oldStima");
  maybeSetJson(data, values, "extra");
  return data;
}

function budgetLineData(values: Record<string, unknown>, sheet?: string) {
  const data: Record<string, unknown> = {};
  if (sheet) data.sheet = sheet;
  maybeSetText(data, values, "sheet");
  data.sheet ??= "Altro";
  maybeSetText(data, values, "externalId");
  maybeSetText(data, values, "nome");
  maybeSetText(data, values, "activityId");
  maybeSetText(data, values, "commessaId");
  maybeSetText(data, values, "offerId");
  maybeSetDecimal(data, values, "importo");
  return data;
}

function commessaData(values: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  maybeSetText(data, values, "externalId");
  maybeSetInt(data, values, "anno");
  maybeSetText(data, values, "nome");
  maybeSetText(data, values, "codice");
  return data;
}

export async function createRecord(sheetKey: SheetKey, values: Record<string, unknown>) {
  const config = ensureSheet(sheetKey);

  if (config.kind === "offers") {
    return prisma.offer.create({ data: offerData(values) as Prisma.OfferCreateInput });
  }

  if (config.kind === "activities") {
    return prisma.activity.create({ data: activityData(values, config.project) as Prisma.ActivityCreateInput });
  }

  if (config.kind === "budgetLines") {
    return prisma.budgetLine.create({ data: budgetLineData(values, config.project) as Prisma.BudgetLineUncheckedCreateInput });
  }

  if (config.kind === "commesse") {
    return prisma.commessa.create({ data: commessaData(values) as Prisma.CommessaCreateInput });
  }

  throw new Error(`Foglio non supportato: ${sheetKey}`);
}

export async function updateRecord(sheetKey: SheetKey, id: string, values: Record<string, unknown>) {
  const config = ensureSheet(sheetKey);

  if (config.kind === "offers") {
    return prisma.offer.update({ where: { id }, data: offerData(values) as Prisma.OfferUpdateInput });
  }

  if (config.kind === "activities") {
    return prisma.activity.update({ where: { id }, data: activityData(values) as Prisma.ActivityUpdateInput });
  }

  if (config.kind === "budgetLines") {
    return prisma.budgetLine.update({ where: { id }, data: budgetLineData(values) as Prisma.BudgetLineUncheckedUpdateInput });
  }

  if (config.kind === "commesse") {
    return prisma.commessa.update({ where: { id }, data: commessaData(values) as Prisma.CommessaUpdateInput });
  }

  throw new Error(`Foglio non supportato: ${sheetKey}`);
}

export async function deleteRecord(sheetKey: SheetKey, id: string) {
  const config = ensureSheet(sheetKey);

  if (config.kind === "offers") return prisma.offer.delete({ where: { id } });
  if (config.kind === "activities") return prisma.activity.delete({ where: { id } });
  if (config.kind === "budgetLines") return prisma.budgetLine.delete({ where: { id } });
  if (config.kind === "commesse") return prisma.commessa.delete({ where: { id } });

  throw new Error(`Foglio non supportato: ${sheetKey}`);
}

function addToGroup(groups: Record<string, { label: string; total: number; count: number }>, label: string | null | undefined, amount: number) {
  const key = label?.trim() || "Non assegnato";
  groups[key] ??= { label: key, total: 0, count: 0 };
  groups[key].total += amount;
  groups[key].count += 1;
}

export async function getDashboardData() {
  const [offers, lines, commesse, activities] = await Promise.all([
    prisma.offer.findMany({ include: { budgetLines: true }, orderBy: { updatedAt: "desc" } }),
    prisma.budgetLine.findMany({ include: { offer: true, commessa: true, activity: true }, orderBy: { updatedAt: "desc" } }),
    prisma.commessa.findMany({ include: { budgetLines: true }, orderBy: { updatedAt: "desc" } }),
    prisma.activity.findMany({ include: { budgetLines: true }, orderBy: { updatedAt: "desc" } })
  ]);

  const mappedOffers = offers.map(mapOffer);
  const approvedAmount = mappedOffers.reduce((sum, offer) => sum + Number(offer.importoApprovato), 0);
  const offeredAmount = mappedOffers.reduce((sum, offer) => sum + Number(offer.importoInOfferta), 0);
  const budgetLineAmount = lines.reduce((sum, line) => sum + decimalToNumber(line.importo), 0);

  const byOffer: Record<string, { label: string; total: number; count: number }> = {};
  const byCommessa: Record<string, { label: string; total: number; count: number }> = {};
  const byActivity: Record<string, { label: string; total: number; count: number }> = {};

  for (const line of lines) {
    const amount = decimalToNumber(line.importo);
    addToGroup(byOffer, relationLabel([line.offer?.externalId, line.offer?.codice ?? line.offer?.nome]) || line.offerId, amount);
    addToGroup(byCommessa, relationLabel([line.commessa?.codice, line.commessa?.nome]) || line.commessaId, amount);
    addToGroup(byActivity, relationLabel([line.activity?.externalId, line.activity?.attivita]) || line.activityId, amount);
  }

  const incompleteBudgetLines = lines.filter((line) => !line.offerId || !line.commessaId || !line.activityId);
  const offersWithoutLines = offers.filter((offer) => offer.budgetLines.length === 0);
  const commesseWithoutBudget = commesse.filter((commessa) => commessa.budgetLines.length === 0);

  const recent = [
    ...mappedOffers.slice(0, 6).map((offer) => ({
      id: offer.id,
      type: "Offer",
      title: relationLabel([offer.externalId, offer.codice]) || "Offer senza codice",
      amount: offer.importoApprovato,
      status: null,
      updatedAt: offer.updatedAt
    })),
    ...lines.slice(0, 6).map((line) => ({
      id: line.id,
      type: "Budget line",
      title: relationLabel([line.externalId, line.nome]) || "Budget line senza nome",
      amount: decimalToNumber(line.importo),
      status: null,
      updatedAt: line.updatedAt.toISOString()
    })),
    ...activities.slice(0, 6).map((activity) => ({
      id: activity.id,
      type: `Activity ${activity.project}`,
      title: relationLabel([activity.externalId, activity.attivita]) || "Activity senza nome",
      amount: decimalToNumber(activity.importoScontato) || decimalToNumber(activity.importo),
      status: activity.stato,
      updatedAt: activity.updatedAt.toISOString()
    }))
  ]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 10);

  return {
    kpis: {
      offers: offers.length,
      activities: activities.length,
      budgetLines: lines.length,
      commesse: commesse.length,
      approvedAmount,
      offeredAmount,
      gap: offeredAmount - approvedAmount,
      budgetLineAmount
    },
    byOffer: Object.values(byOffer).sort((a, b) => b.total - a.total),
    byCommessa: Object.values(byCommessa).sort((a, b) => b.total - a.total),
    byActivity: Object.values(byActivity).sort((a, b) => b.total - a.total),
    prepareQueue: mappedOffers.slice(0, 8),
    recent,
    warnings: [
      {
        label: "Budget line senza relazione completa",
        count: incompleteBudgetLines.length,
        severity: incompleteBudgetLines.length > 0 ? "high" : "ok"
      },
      {
        label: "Offer senza budget line",
        count: offersWithoutLines.length,
        severity: offersWithoutLines.length > 0 ? "medium" : "ok"
      },
      {
        label: "Commesse senza budget",
        count: commesseWithoutBudget.length,
        severity: commesseWithoutBudget.length > 0 ? "medium" : "ok"
      }
    ]
  };
}

export async function getBillingOfferOptions() {
  const offers = await prisma.offer.findMany({
    orderBy: [{ anno: "desc" }, { codice: "asc" }],
    select: {
      id: true,
      externalId: true,
      codice: true,
      nome: true,
      progetto: true,
      anno: true
    }
  });

  return offers.map((offer) => ({
    id: offer.id,
    codice: offer.codice ?? offer.nome ?? "",
    nome: offer.nome,
    externalId: offer.externalId,
    progetto: offer.progetto,
    anno: offer.anno
  }));
}

export async function getBillingOffer(query: string) {
  const value = query.trim();
  if (!value) return null;

  const offerByExactMatch = await prisma.offer.findFirst({
    where: {
      OR: [
        { codice: { equals: value, mode: "insensitive" } },
        { externalId: { equals: value, mode: "insensitive" } },
        { nome: { equals: value, mode: "insensitive" } }
      ]
    },
    include: {
      budgetLines: {
        include: {
          activity: true,
          commessa: true
        },
        orderBy: [{ externalId: "asc" }, { nome: "asc" }]
      }
    }
  });
  const offer =
    offerByExactMatch ??
    (await prisma.offer.findFirst({
      where: {
        OR: [
          { codice: { contains: value, mode: "insensitive" } },
          { externalId: { contains: value, mode: "insensitive" } },
          { nome: { contains: value, mode: "insensitive" } }
        ]
      },
      orderBy: [{ updatedAt: "desc" }, { codice: "asc" }],
      include: {
        budgetLines: {
          include: {
            activity: true,
            commessa: true
          },
          orderBy: [{ externalId: "asc" }, { nome: "asc" }]
        }
      }
    }));

  if (!offer) return null;

  const lines = offer.budgetLines.map((line) => ({
    id: line.id,
    externalId: line.externalId,
    nome: line.nome,
    commessa: line.commessa ? relationLabel([line.commessa.codice, line.commessa.nome]) : "",
    attivita: line.activity ? relationLabel([line.activity.externalId, line.activity.attivita]) : "",
    importo: decimalToNumber(line.importo)
  }));

  return {
    offer: {
      id: offer.id,
      externalId: offer.externalId,
      codice: offer.codice ?? offer.nome ?? "",
      progetto: offer.progetto,
      anno: offer.anno,
      importoApprovato: decimalToNumber(offer.importoApprovato),
      importoOfferta: decimalToNumber(offer.importoInOfferta)
    },
    lines,
    totals: {
      count: lines.length,
      importo: lines.reduce((sum, line) => sum + line.importo, 0)
    }
  };
}

export function assertSheetKey(value: string): asserts value is SheetKey {
  if (!isSheetKey(value)) {
    throw new Error(`Foglio non supportato: ${value}`);
  }
}
