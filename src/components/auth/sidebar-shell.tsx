'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings, Users, UserCog, Shield, CircleDollarSign } from 'lucide-react'

interface AlertCounts {
  policies: number
  assemblies: number
}

interface SidebarShellProps {
  slug: string
  alertCounts?: AlertCounts
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  sectionLabel?: boolean
  children?: { label: string; href: string }[]
}

export function SidebarShell({ slug, alertCounts }: SidebarShellProps) {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: `/${slug}/dashboard`,
      icon: <LayoutDashboard size={16} />,
    },
    {
      label: 'Clientes',
      href: `/${slug}/clientes`,
      icon: <Users size={16} />,
    },
    // Seção "Produtos" — label não clicável
    {
      label: 'Produtos',
      href: '',
      icon: null,
      sectionLabel: true,
    },
    {
      label: 'Seguros',
      href: `/${slug}/seguros`,
      icon: <Shield size={16} />,
    },
    {
      label: 'Consórcio',
      href: `/${slug}/consorcio`,
      icon: <CircleDollarSign size={16} />,
    },
    {
      label: 'Corretores',
      href: `/${slug}/corretores`,
      icon: <UserCog size={16} />,
    },
    {
      label: 'Parceiros',
      href: `/${slug}/parceiros`,
      icon: <Users size={16} />,
    },
    {
      label: 'Configurações',
      href: `/${slug}/configuracoes`,
      icon: <Settings size={16} />,
      children: [
        {
          label: 'Usuários',
          href: `/${slug}/configuracoes/usuarios`,
        },
        {
          label: 'Pipeline',
          href: `/${slug}/configuracoes/pipeline`,
        },
      ],
    },
  ]

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-base font-semibold tracking-tight">NEXUS AGENT</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <div key={item.label}>
            {item.sectionLabel ? (
              // Seção label — não clicável, não active (D-02)
              <div className="px-3 py-1 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {item.label}
              </div>
            ) : item.children ? (
              <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground">
                {item.icon}
                {item.label}
              </div>
            ) : (
              <Link
                href={item.href}
                className={[
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {item.icon}
                {item.label}
                {item.label === 'Seguros' && (alertCounts?.policies ?? 0) > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white px-1">
                    {(alertCounts?.policies ?? 0) > 99 ? '99+' : alertCounts?.policies}
                  </span>
                )}
                {item.label === 'Consórcio' && (alertCounts?.assemblies ?? 0) > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-semibold text-white px-1">
                    {(alertCounts?.assemblies ?? 0) > 99 ? '99+' : alertCounts?.assemblies}
                  </span>
                )}
              </Link>
            )}

            {item.children && (
              <div className="mt-1 ml-4 flex flex-col gap-1 border-l pl-3">
                {item.children.map((child) => (
                  <Link
                    key={child.label}
                    href={child.href}
                    className={[
                      'rounded-md px-3 py-1.5 text-sm transition-colors flex items-center gap-2',
                      isActive(child.href)
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    ].join(' ')}
                  >
                    <UserCog size={14} />
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}
