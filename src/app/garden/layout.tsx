import { AppShell } from "@/components/layout/AppShell";

export default function GardenLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
