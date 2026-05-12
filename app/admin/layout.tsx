import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/login");
  return (
    <>
      <AppNav role="admin" name={session.user.name} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
