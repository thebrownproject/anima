import { PreviewPanelProvider } from '@/components/documents/preview-panel-context'

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PreviewPanelProvider>{children}</PreviewPanelProvider>
}
