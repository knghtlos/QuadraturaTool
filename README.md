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

- `Offer.Importo finale` = somma delle budget line collegate.
- `Offer.Sconto` = `Importo in offerta - Importo finale`.
- `Commessa.Nome-Codice` = `Codice - Nome`.
- `Commessa.Budget` = somma delle budget line collegate.
- Le budget line collegano offer, activity e commessa.
- I campi derivati sono calcolati lato dominio/API, non salvati come valori statici.

## Setup locale

```bash
npm install
cp .env.example .env
npm run db:deploy
npm run db:generate
npm run dev -- -p 7321
```

Imposta `DATABASE_URL` in `.env` usando PostgreSQL locale, Neon, Supabase o Vercel Postgres.

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
