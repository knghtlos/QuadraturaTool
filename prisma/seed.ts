import { existsSync, readFileSync } from "fs";
import { importWorkbook } from "../lib/workbook";
import { prisma } from "../lib/prisma";

async function main() {
  const workbookPath = process.env.QUADRATURE_WORKBOOK_PATH;

  if (workbookPath && existsSync(workbookPath)) {
    const summary = await importWorkbook(readFileSync(workbookPath));
    console.log(`Workbook importato da ${workbookPath}`);
    for (const sheet of summary.sheets) {
      console.log(`${sheet.name}: ${sheet.imported}/${sheet.rows} righe`);
    }
    for (const warning of summary.warnings) {
      console.warn(warning);
    }
    return;
  }

  console.log("Nessun workbook indicato in QUADRATURE_WORKBOOK_PATH: seed operativo lasciato vuoto.");
  console.log("Nessun dato operativo inventato. Importa un workbook dalla UI o con npm run import:xlsx.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
