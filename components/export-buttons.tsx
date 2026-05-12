"use client";

import jsPDF from "jspdf";
import * as XLSX from "xlsx";

type Row = Record<string, string | number | null | undefined>;

export function ExportButtons({ rows, filename }: { rows: Row[]; filename: string }) {
  function excel() {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "給与");
    XLSX.writeFile(book, `${filename}.xlsx`);
  }

  function pdf() {
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(filename, 14, 16);
    rows.slice(0, 28).forEach((row, index) => {
      doc.text(Object.values(row).join("  "), 14, 28 + index * 7);
    });
    doc.save(`${filename}.pdf`);
  }

  return (
    <div className="flex gap-2">
      <button className="btn" type="button" onClick={excel}>Excel出力</button>
      <button className="btn" type="button" onClick={pdf}>PDF出力</button>
    </div>
  );
}
