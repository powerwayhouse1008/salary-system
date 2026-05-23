export function SavedToast({ show, message = "保存しました" }: { show?: boolean; message?: string }) {
  if (!show) return null;
  return (
    <div className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-xs leading-none text-white">✓</span>
      {message}
    </div>
  );
}
