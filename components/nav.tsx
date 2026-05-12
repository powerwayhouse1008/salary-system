import Link from "next/link";
import { signOut } from "@/auth";
import type { Role } from "@/lib/types";

const adminLinks = [
  ["ダッシュボード", "/admin"],
  ["社員", "/admin/employees"],
  ["契約", "/admin/contracts"],
  ["給与計算", "/admin/salaries"],
  ["計算式", "/admin/formulas"]
];

const staffLinks = [
  ["契約入力", "/staff/contracts"],
  ["給与確認", "/staff/salary"]
];

export function AppNav({ role, name }: { role: Role; name?: string | null }) {
  const links = role === "admin" ? adminLinks : staffLinks;

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={role === "admin" ? "/admin" : "/staff/contracts"} className="text-lg font-bold text-brand">
          給与・歩合管理
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{name}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn" type="submit">
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
