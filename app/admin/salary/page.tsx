import { redirect } from "next/navigation";

export default function LegacySalaryPage() {
  redirect("/admin/salaries");
}
