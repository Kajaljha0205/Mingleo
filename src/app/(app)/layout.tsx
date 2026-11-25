import { AppShell } from "@/components/app/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
