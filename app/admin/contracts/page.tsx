import { deleteSelectedContracts, saveContract, updateContractPaymentItems } from "@/app/actions";
import { auth } from "@/auth";
import { OtherIncomeFields } from "@/components/other-income-fields";
import { SavedToast } from "@/components/saved-toast";
import { PaymentBadge } from "@/components/status-badge";
import { getContracts, getManageableProfiles, getProfiles } from "@/lib/data";
import { yen } from "@/lib/format";
import type { Contract, PaymentItem, PaymentStatus } from "@/lib/types";

const statuses: PaymentStatus[] = ["未確認", "入金待ち", "一部入金", "入金済み", "返金あり", "キャンセル"];

type ContractPaymentLine = Pick<PaymentItem, "key" | "label" | "expected_amount" | "actual_received_amount" | "payment_status" | "payment_note">;
type ContractInfoLine = {
  kind: "info";
  key: string;
  label: string;
  value: string;
};
type ContractManagementLine = (ContractPaymentLine & { kind: "payment" }) | ContractInfoLine;

const contractGroupStyles = ["bg-white", "bg-sky-50/70", "bg-emerald-50/60", "bg-amber-50/60", "bg-rose-50/50", "bg-violet-50/50"];

const moneyFields: { key: keyof Contract; label: string }[] = [
  { key: "brokerage_sales", label: "AD売上" },
  { key: "ad_sales", label: "仲介売上" },
  { key: "refund_or_adjustment", label: "選考(返金等）" }
];

function salesItemLabel(contract: Contract, key: keyof Contract, fallback: string) {
  const prefix = contract.contract_type === "賃貸" ? "賃貸" : "売買";
  if (key === "brokerage_sales") return `${prefix}AD売上`;
  if (key === "ad_sales") return `${prefix}仲介売上`;
  return fallback;
}

function contractPaymentLines(contract: Contract): ContractPaymentLine[] {
  const savedItems = new Map((contract.payment_items ?? []).map((item) => [item.key, item]));
  const hasSavedPaymentItems = savedItems.size > 0;
  const lines = moneyFields
    .map(({ key, label }) => {
      const expectedAmount = Number(contract[key] ?? 0);
      return mergePaymentItem(savedItems.get(String(key)), String(key), salesItemLabel(contract, key, label), expectedAmount, hasSavedPaymentItems ? null : contract);
    })
    .filter((item) => item.expected_amount > 0 || (item.actual_received_amount ?? 0) > 0 || item.payment_status !== "未確認");

  const otherIncomeLines =
    contract.other_income_items?.map((item, index) => {
      const key = `other_income_${index}`;
      return mergePaymentItem(savedItems.get(key), key, `その他収入: ${item.name || index + 1}`, Number(item.amount ?? 0), hasSavedPaymentItems ? null : contract);
    }) ?? [];

  return [...lines, ...otherIncomeLines].length
    ? [...lines, ...otherIncomeLines]
    : [mergePaymentItem(savedItems.get("brokerage_sales"), "brokerage_sales", salesItemLabel(contract, "brokerage_sales", "AD売上"), contract.brokerage_sales, hasSavedPaymentItems ? null : contract)];
}

function contractManagementLines(contract: Contract): ContractManagementLine[] {
  const infoLines = [
    { key: "residence_status", label: "在留資格", value: contract.residence_status },
    { key: "phone", label: "携帯電話", value: contract.phone },
    { key: "address", label: "住所", value: contract.address },
    { key: "rent", label: "賃料(物件価額）", value: contract.rent ? yen.format(contract.rent) : null },
    { key: "management_company", label: "管理会社", value: contract.management_company }
  ]
    .filter((item): item is { key: string; label: string; value: string } => Boolean(item.value))
    .map((item) => ({ ...item, kind: "info" as const }));

  return [...infoLines, ...contractPaymentLines(contract).map((item) => ({ ...item, kind: "payment" as const }))];
}

function mergePaymentItem(savedItem: PaymentItem | undefined, key: string, label: string, expectedAmount: number, contractFallback?: Contract | null): ContractPaymentLine {
  return {
    key,
    label,
    expected_amount: expectedAmount,
    actual_received_amount: savedItem?.actual_received_amount ?? contractFallback?.actual_received_amount ?? null,
    payment_status: savedItem?.payment_status ?? contractFallback?.payment_status ?? "未確認",
    payment_note: savedItem?.payment_note ?? contractFallback?.payment_note ?? null
  };
}

function matchesSearch(contract: Contract, query: string) {
  if (!query) return true;
  const values = [
    contract.contract_date,
    contract.contract_number,
    contract.customer_name,
    contract.residence_status,
    contract.phone,
    contract.property_name,
    contract.address,
    contract.management_company,
    contract.contract_type,
    contract.profiles?.name,
    contract.profiles?.email
  ];
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

export default async function AdminContractsPage({ searchParams }: { searchParams: Promise<{ month?: string; q?: string; staff?: string; saved?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const isAdmin = session?.user.role === "admin";
  const profiles = isAdmin ? await getProfiles() : session?.user ? await getManageableProfiles(session.user) : [];
  const contracts = await getContracts(isAdmin ? {} : { staffIds: profiles.map((profile) => profile.id) });
  const selectedMonth = params.month ?? "";
  const selectedStaff = params.staff ?? "";
  const searchQuery = (params.q ?? "").trim().toLowerCase();
  const filteredContracts = contracts.filter((contract) => {
    const monthMatches = selectedMonth ? contract.contract_date?.startsWith(selectedMonth) : true;
    const staffMatches = selectedStaff ? contract.staff_id === selectedStaff : true;
    return monthMatches && staffMatches && matchesSearch(contract, searchQuery);
  });

  return (
    <div className="space-y-6">
      <SavedToast show={params.saved === "1"} />
      <h1 className="text-2xl font-bold">契約・入金確認</h1>
      {isAdmin ? <form action={saveContract} className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-5">
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
      </form> : null}
      <form className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-[180px_220px_1fr_auto]">
        <label className="field">対象月<input type="month" name="month" defaultValue={selectedMonth} /></label>
        <label className="field">
          担当
          <select name="staff" defaultValue={selectedStaff}>
            <option value="">すべて</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <label className="field">検索<input name="q" defaultValue={params.q ?? ""} placeholder="契約名前・物件名・住所など" /></label>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" type="submit">絞り込み</button>
          <button className="btn btn-primary" type="submit" form="contract-payment-items-form">保存</button>
          {isAdmin ? <button className="btn border-red-200 text-red-700 hover:bg-red-50" type="submit" form="contract-payment-items-form" formAction={deleteSelectedContracts}>選択削除</button> : null}
          <a className="btn" href="/admin/contracts">解除</a>
        </div>
      </form>
      <form id="contract-payment-items-form" action={updateContractPaymentItems} className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>選択</th>
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
            {filteredContracts.flatMap((contract, contractIndex) => {
              const lines = contractManagementLines(contract);
              const groupStyle = contractGroupStyles[contractIndex % contractGroupStyles.length];
              return lines.map((item, index) => (
                  <tr key={`${contract.id}-${item.key}`} className={groupStyle}>
                    {index === 0 ? (
                      <>
                        <td rowSpan={lines.length}>{contractIndex + 1}</td>
                        <td rowSpan={lines.length}>
                          <input type="checkbox" name="selected_contract_id" value={contract.id} className="h-4 w-4" />
                        </td>
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
                    {item.kind === "info" ? (
                      <td colSpan={4} className="text-slate-700">{item.value}</td>
                    ) : (
                      <>
                        <td>{yen.format(item.expected_amount)}</td>
                        <td colSpan={3}>
                          <div className="grid min-w-[520px] grid-cols-[120px_150px_1fr_auto] items-center gap-2">
                            <input type="hidden" name="contract_id" value={contract.id} />
                            <input type="hidden" name="payment_item_key" value={item.key} />
                            <input type="hidden" name="payment_item_label" value={item.label} />
                            <input type="hidden" name="expected_amount" value={item.expected_amount} />
                            <input name="actual_received_amount" type="number" min="0" step="1" defaultValue={item.actual_received_amount ?? ""} />
                            <select name="payment_status" defaultValue={item.payment_status}>
                              {statuses.map((status) => <option key={status}>{status}</option>)}
                            </select>
                            <input name="payment_note" defaultValue={item.payment_note ?? ""} placeholder="メモ" />
                            <button className="btn btn-primary" type="submit">保存</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ));
            })}
          </tbody>
        </table>
      </form>
    </div>
  );
}
