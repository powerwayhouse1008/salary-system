"use client";

import { useState } from "react";

type Row = {
  id: number;
};

export function OtherIncomeFields() {
  const [rows, setRows] = useState<Row[]>([]);

  function addRow() {
    setRows((current) => [...current, { id: Date.now() + current.length }]);
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <section className="md:col-span-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-700">その他収入</h2>
        <button className="btn" type="button" onClick={addRow}>
          追加
        </button>
      </div>
      {rows.length ? (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-md border border-line bg-slate-50 p-3 md:grid-cols-[1fr_160px_140px_auto]">
              <label className="field">
                項目名
                <input name="other_income_name" placeholder="例: 紹介料" />
              </label>
              <label className="field">
                金額
                <input name="other_income_amount" type="number" min="0" step="1" />
              </label>
              <label className="field">
                歩合率 %
                <input name="other_income_rate" type="number" min="0" step="0.01" />
              </label>
              <div className="flex items-end">
                <button className="btn btn-danger" type="button" onClick={() => removeRow(row.id)}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
