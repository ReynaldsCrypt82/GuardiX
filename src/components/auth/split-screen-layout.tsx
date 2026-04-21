import React from 'react'
import { BrandPanel } from './brand-panel'

interface SplitScreenLayoutProps {
  children: React.ReactNode
}

/**
 * Auth split-screen layout.
 * - lg+: 50/50 grid — left brand panel + right form panel
 * - below lg: full-screen form only (left panel hidden)
 *
 * UI-SPEC Layout Contract lines 34-59.
 */
export function SplitScreenLayout({ children }: SplitScreenLayoutProps) {
  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      {/* Left brand panel — hidden below lg; gradient from-blue-600 to-violet-600 applied inside BrandPanel */}
      <div className="hidden lg:flex from-blue-600 to-violet-600">
        <BrandPanel />
      </div>

      {/* Right form panel */}
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  )
}
