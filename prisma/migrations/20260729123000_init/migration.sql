-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "nome" TEXT,
    "progetto" TEXT,
    "anno" INTEGER,
    "stato" TEXT,
    "rey" TEXT,
    "importoInOfferta" DECIMAL(14,2),
    "preparaOfferta" BOOLEAN NOT NULL DEFAULT false,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "project" TEXT NOT NULL,
    "attivita" TEXT,
    "dataIniziativa" TIMESTAMP(3),
    "release" TEXT,
    "refLuxottica" TEXT,
    "codiceRey" TEXT,
    "refStima" TEXT,
    "stato" TEXT,
    "importo" DECIMAL(14,2),
    "importoScontato" DECIMAL(14,2),
    "scontoPercent" DECIMAL(7,4),
    "b2bCtia" DECIMAL(14,2),
    "fe" DECIMAL(14,2),
    "cms" DECIMAL(14,2),
    "bff" DECIMAL(14,2),
    "ctiaDevops" DECIMAL(14,2),
    "b2c" DECIMAL(14,2),
    "altriTeam" DECIMAL(14,2),
    "riferimentoStima" TEXT,
    "oldStima" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "sheet" TEXT NOT NULL,
    "nome" TEXT,
    "stato" TEXT,
    "importo" DECIMAL(14,2),
    "activityId" TEXT,
    "commessaId" TEXT,
    "offerId" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commessa" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "anno" INTEGER,
    "nome" TEXT,
    "codice" TEXT,
    "progetto" TEXT,
    "bu" TEXT,
    "tipologia" TEXT,
    "stato" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commessa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigOption" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMapping" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "mailId" TEXT,
    "ccMail" TEXT,
    "activityId" TEXT,
    "activityExcelId" TEXT,
    "replyId" TEXT,
    "ccReply" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_externalId_key" ON "Offer"("externalId");

-- CreateIndex
CREATE INDEX "Offer_anno_idx" ON "Offer"("anno");

-- CreateIndex
CREATE INDEX "Offer_progetto_idx" ON "Offer"("progetto");

-- CreateIndex
CREATE INDEX "Offer_stato_idx" ON "Offer"("stato");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_externalId_key" ON "Activity"("externalId");

-- CreateIndex
CREATE INDEX "Activity_project_idx" ON "Activity"("project");

-- CreateIndex
CREATE INDEX "Activity_stato_idx" ON "Activity"("stato");

-- CreateIndex
CREATE INDEX "Activity_codiceRey_idx" ON "Activity"("codiceRey");

-- CreateIndex
CREATE INDEX "BudgetLine_sheet_idx" ON "BudgetLine"("sheet");

-- CreateIndex
CREATE INDEX "BudgetLine_stato_idx" ON "BudgetLine"("stato");

-- CreateIndex
CREATE INDEX "BudgetLine_activityId_idx" ON "BudgetLine"("activityId");

-- CreateIndex
CREATE INDEX "BudgetLine_commessaId_idx" ON "BudgetLine"("commessaId");

-- CreateIndex
CREATE INDEX "BudgetLine_offerId_idx" ON "BudgetLine"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_sheet_externalId_key" ON "BudgetLine"("sheet", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Commessa_externalId_key" ON "Commessa"("externalId");

-- CreateIndex
CREATE INDEX "Commessa_anno_idx" ON "Commessa"("anno");

-- CreateIndex
CREATE INDEX "Commessa_progetto_idx" ON "Commessa"("progetto");

-- CreateIndex
CREATE INDEX "Commessa_bu_idx" ON "Commessa"("bu");

-- CreateIndex
CREATE INDEX "Commessa_stato_idx" ON "Commessa"("stato");

-- CreateIndex
CREATE INDEX "ConfigOption_type_idx" ON "ConfigOption"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigOption_type_value_key" ON "ConfigOption"("type", "value");

-- CreateIndex
CREATE INDEX "MailMapping_conversationId_idx" ON "MailMapping"("conversationId");

-- CreateIndex
CREATE INDEX "MailMapping_mailId_idx" ON "MailMapping"("mailId");

-- CreateIndex
CREATE INDEX "MailMapping_activityId_idx" ON "MailMapping"("activityId");

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMapping" ADD CONSTRAINT "MailMapping_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
