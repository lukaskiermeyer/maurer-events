import { ToastProvider } from "@/components/ui/Toast";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="admin-area">{children}</div>
    </ToastProvider>
  );
}
