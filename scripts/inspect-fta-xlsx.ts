/**
 * Inspect every XLSX file the FTA publishes openly so we can extract
 * real anchor numbers to calibrate our synthetic row-level data.
 *
 * Source: https://tax.gov.ae/en/open.data/open.data.aspx
 * (downloaded into data/fta-aggregates/files/)
 */
import * as XLSX from "xlsx";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = "data/fta-aggregates/files";

const xlsxFiles = readdirSync(DIR)
  .filter((f) => f.toLowerCase().endsWith(".xlsx"))
  .sort();

console.log(`Found ${xlsxFiles.length} XLSX files in ${DIR}\n`);

for (const file of xlsxFiles) {
  const path = join(DIR, file);
  const sizeKb = (statSync(path).size / 1024).toFixed(1);

  console.log("═".repeat(80));
  console.log(`📄 ${file}  (${sizeKb} KB)`);
  console.log("═".repeat(80));

  try {
    const wb = XLSX.readFile(path);

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      console.log(`\n  Sheet: "${sheetName}"  (${json.length} rows)`);

      // Show first 25 rows max so we can see structure + actual numbers
      const preview = json.slice(0, 25);
      for (const [i, row] of preview.entries()) {
        const rowStr = (row as unknown[])
          .map((c) => (c === null ? "" : String(c)))
          .join(" | ");
        console.log(`  ${String(i + 1).padStart(3)}: ${rowStr.slice(0, 200)}`);
      }
      if (json.length > 25) console.log(`  ... (${json.length - 25} more rows)`);
    }
  } catch (err) {
    console.log(`  ⚠️  Could not read: ${(err as Error).message}`);
  }
  console.log();
}
