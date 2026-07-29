import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { importWorkbook } from "../lib/workbook";
import { prisma } from "../lib/prisma";

async function main() {
  const input = process.argv[2] ?? process.env.QUADRATURE_WORKBOOK_PATH;

  if (!input) {
    throw new Error("Passa il percorso del file XLSX: npm run import:xlsx -- '/path/workbook.xlsx'");
  }

  const workbookPath = resolve(input);

  if (!existsSync(workbookPath)) {
    throw new Error(`File non trovato: ${workbookPath}`);
  }

  const summary = await importWorkbook(readFileSync(workbookPath));

  console.log(`Workbook importato da ${workbookPath}`);
  for (const sheet of summary.sheets) {
    console.log(`${sheet.name}: ${sheet.imported}/${sheet.rows} righe`);
  }

  if (summary.warnings.length > 0) {
    console.log("\nWarning:");
    for (const warning of summary.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
