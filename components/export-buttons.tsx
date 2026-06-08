"use client";

import jsPDF from "jspdf";
import * as XLSX from "xlsx";

type Row = Record<string, string | number | null | undefined>;

type DetailRow = {
  label: string;
  value: string | number | null | undefined;
};

export function ExportButtons({
  rows,
  filename,
  detailTitle,
  detailRows
}: {
  rows: Row[];
  filename: string;
  detailTitle?: string;
  detailRows?: DetailRow[];
}) {
  function excel() {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "給与");
    XLSX.writeFile(book, `${filename}.xlsx`);
  }

  function pdf() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 14;
    let y = 16;

    doc.setFontSize(13);
    doc.text(detailTitle ?? filename, left, y);
    y += 9;

    if (detailRows?.length) {
      const labelWidth = 72;
      const valueWidth = pageWidth - left * 2 - labelWidth;
      doc.setFontSize(10);
      detailRows.forEach((row) => {
        if (y > 282) {
          doc.addPage();
          y = 16;
        }
        doc.rect(left, y - 5, labelWidth, 8);
        doc.rect(left + labelWidth, y - 5, valueWidth, 8);
        doc.text(String(row.label), left + 2, y);
        doc.text(String(row.value ?? ""), left + labelWidth + 2, y);
        y += 8;
      });
    } else {
      doc.setFontSize(10);
      rows.slice(0, 28).forEach((row, index) => {
        doc.text(Object.values(row).join("  "), left, y + index * 7);
      });
    }
    doc.save(`${filename}.pdf`);
  }

  return (
    <div className="flex gap-2">
      <button className="btn" type="button" onClick={excel}>Excel出力</button>
      <button className="btn" type="button" onClick={pdf}>PDF出力</button>
    </div>
  );
}
