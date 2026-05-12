import { confirmPayment, saveContract, updateContractStatus } from "@/app/actions";
import { PaymentBadge } from "@/components/status-badge";
import { getContracts, getProfiles } from "@/lib/data";
import { yen } from "@/lib/format";
import type { PaymentStatus } from "@/lib/types";

const statuses: PaymentStatus[] = ["未確認", "入金待ち", "一部入金", "入金済み", "返金あり", "キャンセル"];

export default async function AdminContractsPage() {
  const [contracts, profiles] = await Promise.all([getContracts(), getProfiles()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約・入金確認</h1>
      <form action={saveContract} className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-5">
        <label className="field">契約日付<input name="contract_date" type="date" /></label>
        <label className="field">契約番号<input name="contract_number" /></label>
        <label className="field">契約名前<input name="customer_name" /></label>
        <label className="field">担当<select name="staff_id">{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="field">物件名<input name="property_name" /></label>
        <label className="field">仲介売上<input name="brokerage_sales" type="number" /></label>
        <label className="field">AD売上<input name="ad_sales" type="number" /></label>
        <label className="field">予定入金額<input name="expected_payment_amount" type="number" /></label>
        <label className="field">実入金額<input name="actual_received_amount" type="number" /></label>
        <div className="pt-6"><button className="btn btn-primary" type="submit">追加</button></div>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>契約日</th><th>番号</th><th>契約名前</th><th>担当</th><th>物件</th><th>仲介売上</th><th>AD売上</th><th>予定</th><th>実入金</th><th>状態</th><th>入金確認</th></tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.id}>
                <td>{contract.contract_date}</td>
                <td>{contract.contract_number}</td>
                <td className="font-semibold">{contract.customer_name}</td>
                <td>{contract.profiles?.name}</td>
                <td>{contract.property_name}</td>
                <td>{yen.format(contract.brokerage_sales)}</td>
                <td>{yen.format(contract.ad_sales)}</td>
                <td>{yen.format(contract.expected_payment_amount)}</td>
                <td>
                  <form action={confirmPayment} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={contract.id} />
                    <input name="actual_received_amount" type="number" defaultValue={contract.actual_received_amount || contract.expected_payment_amount} className="w-28" />
                    <input name="payment_note" defaultValue={contract.payment_note ?? ""} placeholder="メモ" className="w-28" />
                    <button className="btn btn-primary" type="submit">入金確認済みにする</button>
                  </form>
                </td>
                <td><PaymentBadge status={contract.payment_status} /></td>
                <td>
                  <form action={updateContractStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={contract.id} />
                    <select name="payment_status" defaultValue={contract.payment_status}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
                    <button className="btn" type="submit">状態保存</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
