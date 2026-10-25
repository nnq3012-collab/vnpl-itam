import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

/** Download response for `rows` as .xlsx (default) or .csv. `filename` is
 * given without extension. */
export function spreadsheetResponse(rows: object[], sheetName: string, filename: string, format: "xlsx" | "csv" = "xlsx") {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const disposition = `attachment; filename="${filename}.${format}"`;

  if (format === "csv") {
    // BOM so Excel opens the CSV as UTF-8 (Vietnamese names otherwise garble).
    return new NextResponse("﻿" + XLSX.utils.sheet_to_csv(worksheet), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": disposition },
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return new NextResponse(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": disposition,
    },
  });
}
