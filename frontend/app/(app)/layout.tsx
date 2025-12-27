import { cookies } from "next/headers";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { PreviewPanelProvider } from "@/components/documents/preview-panel-context";
import { SelectedDocumentProvider } from "@/components/documents/selected-document-context";

export default async function AppLayout({
  children,
  header,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
}) {
  // Sidebar state persistence
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh overflow-hidden"
    >
      <AppSidebar />
      <SidebarInset>
        <PreviewPanelProvider>
          <SelectedDocumentProvider>
            <header className="flex h-12 shrink-0 items-center gap-2 px-4 border-b">
              <SidebarTrigger className="ml-2.5" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              {header}
            </header>
            <div className="flex flex-1 flex-col min-h-0">{children}</div>
          </SelectedDocumentProvider>
        </PreviewPanelProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
