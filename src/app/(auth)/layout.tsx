import { SplitScreenLayout } from '@/components/auth/split-screen-layout'
import { Toaster } from '@/components/ui/sonner'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SplitScreenLayout>{children}</SplitScreenLayout>
      <Toaster position="top-right" />
    </>
  )
}
