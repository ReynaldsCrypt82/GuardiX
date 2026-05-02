/**
 * Left brand panel for auth split-screen layout.
 * Gradient: from-blue-600 to-violet-600 (only hardcoded Tailwind palette permitted here — UI-SPEC line 125)
 * No images — Phase 1 polish deferred (D-14)
 */
export function BrandPanel() {
  return (
    <div className="relative flex h-full min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-violet-600 p-12">
      {/* Overlay to deepen gradient */}
      <div className="absolute inset-0 bg-black/10" />

      {/* Decorative abstract card shapes */}
      <div className="absolute left-8 top-16 h-24 w-40 rotate-[-8deg] rounded-xl bg-white/10 backdrop-blur-sm" />
      <div className="absolute bottom-24 right-8 h-20 w-32 rotate-[6deg] rounded-xl bg-white/10 backdrop-blur-sm" />
      <div className="absolute bottom-40 left-12 h-16 w-24 rotate-[12deg] rounded-lg bg-white/10 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        {/* Product logo */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-semibold tracking-tight text-white">
            GuardiX
          </span>
        </div>

        {/* Taglines */}
        <div className="flex flex-col gap-2">
          <p className="max-w-xs text-lg font-semibold leading-snug text-white">
            Sua corretora segura. Seu cliente protegido.
          </p>
        </div>
      </div>
    </div>
  )
}
