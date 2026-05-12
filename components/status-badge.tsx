import type { PaymentStatus, SalaryStatus } from "@/lib/types";

const paymentStyle: Record<PaymentStatus, string> = {
  未確認: "bg-slate-100 text-slate-700",
  入金待ち: "bg-yellow-100 text-yellow-800",
  一部入金: "bg-orange-100 text-orange-800",
  入金済み: "bg-emerald-100 text-emerald-800",
  返金あり: "bg-purple-100 text-purple-800",
  キャンセル: "bg-red-100 text-red-800"
};

const salaryStyle: Record<SalaryStatus, string> = {
  下書き: "bg-slate-100 text-slate-700",
  確定: "bg-blue-100 text-blue-800",
  支払済み: "bg-emerald-100 text-emerald-800"
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${paymentStyle[status]}`}>{status}</span>;
}

export function SalaryBadge({ status }: { status: SalaryStatus }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${salaryStyle[status]}`}>{status}</span>;
}
