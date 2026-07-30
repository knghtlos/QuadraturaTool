# Quadrature Tool

Web app Next.js per gestire e riconciliare dati di governance su quattro aree operative:

- `Activities`
- `BudgetLines`
- `Offers`
- `Commesse`

La home si chiama `General` e mostra dashboard, KPI, aggregazioni e warning.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + componenti shadcn/ui-style locali
- TanStack Table per tabelle ordinabili/editabili
- React Hook Form + Zod per form di dettaglio
- Prisma + PostgreSQL
- `read-excel-file` / `write-excel-file` per import/export XLSX

## Logica principale

- `BudgetLines` contiene `ID`, `Nome`, `Commessa`, `Attività`, `Importo`, `Offerta`.
- `Offers` contiene `ID`, `Codice`, `Anno`, `Progetto`, `Importo approvato`, `Importo offerta`.
- `Commesse` contiene `ID`, `Codice`, `Nome`, `Anno`.
- Le budget line collegano offerta, attività e commessa.

## Setup locale

```bash
npm install
cp .env.example .env
npm run db:deploy
npm run db:generate
npm run dev
```

Imposta `DATABASE_URL` in `.env` usando PostgreSQL locale, Neon, Supabase o Vercel Postgres.
Lo script `dev` avvia l'app su `http://localhost:7333`.

## Import dati

L'app non inventa dati operativi. Puoi importare un workbook XLSX dalla UI con `Import`, oppure da CLI:

```bash
npm run import:xlsx -- "/percorso/workbook.xlsx"
```

L'import accetta i fogli consolidati `Activities` e `BudgetLines`. Per compatibilità legge anche workbook storici divisi in `Activities - Leonardo/VIVA/Intranet` e `Budget Lines - Leonardo/VIVA/Intranet`, consolidandoli nelle due tab dell'app.

## Export XLSX

Il pulsante `Export` scarica un workbook con soli fogli:

- `Offers`
- `Activities`
- `BudgetLines`
- `Commesse`
- `General`

## Deploy Vercel

1. Crea un database PostgreSQL compatibile.
2. Aggiungi `DATABASE_URL` nelle Environment Variables del progetto Vercel.
3. Esegui le migration:

```bash
npm run db:deploy
```

4. Deploy con:

```bash
npm run build
```

## Verifiche

```bash
npm run lint
npm run typecheck
npm run build
```
