import { saveContract, updateContractPaymentItem } from "@/app/actions";
import { OtherIncomeFields } from "@/components/other-income-fields";
import { PaymentBadge } from "@/components/status-badge";
import { getContracts, getProfiles } from "@/lib/data";
import { yen } from "@/lib/format";
import type { Contract, PaymentItem, PaymentStatus } from "@/lib/types";

const statuses: PaymentStatus[] = ["未確認", "入金待ち", "一部入金", "入金済み", "返金あり", "キャンセル"];

type ContractPaymentLine = Pick<PaymentItem, "key" | "label" | "expected_amount" | "actual_received_amount" | "payment_status" | "payment_note">;

const moneyFields: { key: keyof Contract; label: string }[] = [
  { key: "rent", label: "賃料" },
  { key: "brokerage_sales", label: "AD売上" },
  { key: "ad_sales", label: "仲介売上" },
  { key: "ad_payment", label: "AD入金" },
  { key: "refund_or_adjustment", label: "選考(返金等）" }
];

function contractPaymentLines(contract: Contract): ContractPaymentLine[] {
  const savedItems = new Map((contract.payment_items ?? []).map((item) => [item.key, item]));
  const lines = moneyFields
    .map(({ key, label }) => {
      const expectedAmount = Number(contract[key] ?? 0);
      return mergePaymentItem(savedItems.get(String(key)), String(key), label, expectedAmount);
    })
    .filter((item) => item.expected_amount > 0 || item.actual_received_amount > 0 || item.payment_status !== "未確認");

  const otherIncomeLines =
    contract.other_income_items?.map((item, index) => {
      const key = `other_income_${index}`;
      return mergePaymentItem(savedItems.get(key), key, `その他収入: ${item.name || index + 1}`, Number(item.amount ?? 0));
    }) ?? [];

  return [...lines, ...otherIncomeLines].length ? [...lines, ...otherIncomeLines] : [mergePaymentItem(savedItems.get("brokerage_sales"), "brokerage_sales", "AD売上", contract.brokerage_sales)];
}

function mergePaymentItem(savedItem: PaymentItem | undefined, key: string, label: string, expectedAmount: number): ContractPaymentLine {
  return {
    key,
    label,
    expected_amount: expectedAmount,
    actual_received_amount: savedItem?.actual_received_amount ?? 0,
    payment_status: savedItem?.payment_status ?? "未確認",
    payment_note: savedItem?.payment_note ?? null
  };
}

export default async function AdminContractsPage() {
  const [contracts, profiles] = await Promise.all([getContracts(), getProfiles()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約・入金確認</h1>
      <form action={saveContract} className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-5">
        <label className="field">契約日付<input name="contract_date" type="date" /></label>
        <fieldset className="field">
          契約種類
          <div className="flex gap-2">
            <label className="btn flex-1"><input name="contract_type" type="radio" value="売買" defaultChecked className="h-4 w-4" />売買</label>
            <label className="btn flex-1"><input name="contract_type" type="radio" value="賃貸" className="h-4 w-4" />賃貸</label>
          </div>
        </fieldset>
        <label className="field">契約番号<input name="contract_number" /></label>
        <label className="field">契約名前<input name="customer_name" /></label>
        <label className="field">担当<select name="staff_id">{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="field">物件名<input name="property_name" /></label>
        <label className="field">AD売上<input name="brokerage_sales" type="number" /></label>
        <label className="field">仲介売上<input name="ad_sales" type="number" /></label>
        <label className="field">実入金額<input name="actual_received_amount" type="number" /></label>
        <OtherIncomeFields />
        <div className="pt-6"><button className="btn btn-primary" type="submit">追加</button></div>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>契約日</th>
              <th>種類</th>
              <th>番号</th>
              <th>契約名前</th>
              <th>担当</th>
              <th>物件</th>
              <th>項目</th>
              <th>入力金額</th>
              <th>実入金</th>
              <th>状態</th>
              <th>保存</th>
            </tr>
          </thead>
          <tbody>
            {contracts.flatMap((contract) => {
              const lines = contractPaymentLines(contract);
              return lines.map((item, index) => (
                  <tr key={`${contract.id}-${item.key}`}>
                    {index === 0 ? (
                      <>
                        <td rowSpan={lines.length}>{contract.contract_date}</td>
                        <td rowSpan={lines.length}>{contract.contract_type}</td>
                        <td rowSpan={lines.length}>{contract.contract_number}</td>
                        <td rowSpan={lines.length} className="font-semibold">{contract.customer_name}</td>
                        <td rowSpan={lines.length}>{contract.profiles?.name}</td>
                        <td rowSpan={lines.length}>
                          <div>{contract.property_name}</div>
                          <div className="mt-2"><PaymentBadge status={contract.payment_status} /></div>
                        </td>
                      </>
                    ) : null}
                    <td className="font-medium">{item.label}</td>
                    <td>{yen.format(item.expected_amount)}</td>
                    <td colSpan={3}>
                      <form action={updateContractPaymentItem} className="grid min-w-[520px] grid-cols-[120px_150px_1fr_auto] items-center gap-2">
                        <input type="hidden" name="id" value={contract.id} />
                        <input type="hidden" name="payment_item_key" value={item.key} />
                        <input type="hidden" name="payment_item_label" value={item.label} />
                        <input type="hidden" name="expected_amount" value={item.expected_amount} />
                        <input name="actual_received_amount" type="number" min="0" step="1" defaultValue={item.actual_received_amount || ""} />
                        <select name="payment_status" defaultValue={item.payment_status}>
                          {statuses.map((status) => <option key={status}>{status}</option>)}
                        </select>
                        <input name="payment_note" defaultValue={item.payment_note ?? ""} placeholder="メモ" />
                        <button className="btn btn-primary" type="submit">保存</button>
                      </form>
                    </td>
                  </tr>
                ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
