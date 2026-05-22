import { deleteContract, saveContract } from "@/app/actions";
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
        <fieldset className="field">
          契約種類
          <div className="flex gap-2">
            <label className="btn flex-1"><input name="contract_type" type="radio" value="売買" defaultChecked className="h-4 w-4" />売買</label>
            <label className="btn flex-1"><input name="contract_type" type="radio" value="賃貸" className="h-4 w-4" />賃貸</label>
          </div>
        </fieldset>
        <label className="field">契約名前<input name="customer_name" /></label>
        <label className="field">在留資格<input name="residence_status" /></label>
        <label className="field">携帯電話<input name="phone" /></label>
        <label className="field">物件名<input name="property_name" /></label>
        <label className="field md:col-span-2">住所<input name="address" /></label>
        <label className="field">賃料<input name="rent" type="number" /></label>
        <label className="field">AD売上<input name="brokerage_sales" type="number" /></label>
        <label className="field">仲介売上<input name="ad_sales" type="number" /></label>
        <label className="field">選考(返金等）<input name="refund_or_adjustment" type="number" /></label>
        <label className="field">管理会社<input name="management_company" /></label>
        <div className="pt-6"><button className="btn btn-primary" type="submit">行を追加</button></div>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>契約日付</th>
              <th>契約種類</th>
              <th>契約名前</th>
              <th>在留資格</th>
              <th>携帯電話</th>
              <th>物件名</th>
              <th>住所</th>
              <th>賃料</th>
              <th>AD売上</th>
              <th>仲介売上</th>
              <th>選考(返金等）</th>
              <th>管理会社</th>
              <th>状態</th>
              <th>削除</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.id}>
                <td>{contract.contract_date}</td>
                <td>{contract.contract_type}</td>
                <td className="font-semibold">{contract.customer_name}</td>
                <td>{contract.residence_status}</td>
                <td>{contract.phone}</td>
                <td>{contract.property_name}</td>
                <td>{contract.address}</td>
                <td>{yen.format(contract.rent)}</td>
                <td>{yen.format(contract.brokerage_sales)}</td>
                <td>{yen.format(contract.ad_sales)}</td>
                <td>{yen.format(contract.refund_or_adjustment)}</td>
                <td>{contract.management_company}</td>
                <td><PaymentBadge status={contract.payment_status} /></td>
                <td>
                  <form action={deleteContract}>
                    <input type="hidden" name="id" value={contract.id} />
                    <button className="btn btn-danger" type="submit">削除</button>
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
