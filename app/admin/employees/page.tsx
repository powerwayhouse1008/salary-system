import { saveEmployee } from "@/app/actions";
import { getProfiles } from "@/lib/data";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const employees = await getProfiles();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">社員管理</h1>
      {params.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {params.error}
        </div>
      ) : null}
      <form action={saveEmployee} className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-4">
        <label className="field">
          氏名
          <input name="name" required />
        </label>
        <label className="field">
          Email
          <input name="email" type="email" required />
        </label>
        <label className="field">
          初期パスワード
          <input name="password" type="password" placeholder="未入力ならMicrosoft専用" />
        </label>
        <label className="field">
          権限
          <select name="role" defaultValue="staff">
            <option value="staff">staff</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label className="field">
          売買歩合率 %
          <input name="brokerage_commission_rate" type="number" step="0.01" defaultValue="30" />
        </label>
        <label className="field">
         賃貸歩合率 %
          <input name="ad_commission_rate" type="number" step="0.01" defaultValue="50" />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm font-semibold">
          <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
          有効
        </label>
        <div className="pt-6">
          <button className="btn btn-primary" type="submit">
            社員を追加
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>Email</th>
              <th>新パスワード</th>
              <th>権限</th>
              <th>売買歩合</th>
              <th>賃貸歩合</th>
              <th>状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <form action={saveEmployee} className="contents">
                  <input type="hidden" name="id" value={employee.id} />
                  <td>
                    <input name="name" defaultValue={employee.name} className="w-40" />
                  </td>
                  <td>
                    <input name="email" defaultValue={employee.email} className="w-56" />
                  </td>
                  <td>
                    <input name="password" type="password" placeholder="変更時のみ入力" className="w-40" />
                  </td>
                  <td>
                    <select name="role" defaultValue={employee.role}>
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    <input name="brokerage_commission_rate" type="number" step="0.01" defaultValue={employee.brokerage_commission_rate} className="w-24" />
                  </td>
                  <td>
                    <input name="ad_commission_rate" type="number" step="0.01" defaultValue={employee.ad_commission_rate} className="w-24" />
                  </td>
                  <td>
                    <input name="is_active" type="checkbox" defaultChecked={employee.is_active} className="h-4 w-4" />
                  </td>
                  <td>
                    <button className="btn" type="submit">
                      保存
                    </button>
                  </td>
                </form>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
