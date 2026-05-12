import { saveContract } from "@/app/actions";
import { auth } from "@/auth";
import { PaymentBadge } from "@/components/status-badge";
import { getContracts } from "@/lib/data";
import { yen } from "@/lib/format";

export default async function StaffContractsPage() {
  const session = await auth();
  const contracts = await getContracts({ staffId: session?.user.id });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約入力</h1>
      <form action={saveContract} className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-4">
        <label className="field">契約日付<input name="contract_date" type="date" /></label>
        <label className="field">契約番号<input name="contract_number" /></label>
        <label className="field">契約名前<input name="customer_name" /></label>
        <label className="field">在留資格<input name="residence_status" /></label>
        <label className="field">携帯電話<input name="phone" /></label>
        <label className="field">物件名<input name="property_name" /></label>
        <label className="field md:col-span-2">住所<input name="address" /></label>
        <label className="field">賃料<input name="rent" type="number" /></label>
        <label className="field">銀行入金<input name="bank_deposit" type="number" /></label>
        <label className="field">出金<input name="withdrawal" type="number" /></label>
        <label className="field">振込手数料<input name="transfer_fee" type="number" /></label>
        <label className="field">仲介売上<input name="brokerage_sales" type="number" /></label>
        <label className="field">AD売上<input name="ad_sales" type="number" /></label>
        <label className="field">AD入金<input name="ad_payment" type="number" /></label>
        <label className="field">選考(返金等）<input name="refund_or_adjustment" type="number" /></label>
        <label className="field">契約種類<input name="contract_type" /></label>
        <label className="field">管理会社<input name="management_company" /></label>
        <label className="field">前のAD入金<input name="previous_ad_payment" type="number" /></label>
        <label className="field">給料項目<input name="salary_item" /></label>
        <label className="field">給料清算<input name="salary_settlement" type="number" /></label>
        <label className="field">予定入金額<input name="expected_payment_amount" type="number" /></label>
        <div className="pt-6"><button className="btn btn-primary" type="submit">行を追加</button></div>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>契約日付</th><th>契約番号</th><th>契約名前</th><th>物件名</th><th>仲介売上</th><th>AD売上</th><th>状態</th></tr></thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.id}>
                <td>{contract.contract_date}</td>
                <td>{contract.contract_number}</td>
                <td className="font-semibold">{contract.customer_name}</td>
                <td>{contract.property_name}</td>
                <td>{yen.format(contract.brokerage_sales)}</td>
                <td>{yen.format(contract.ad_sales)}</td>
                <td><PaymentBadge status={contract.payment_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
