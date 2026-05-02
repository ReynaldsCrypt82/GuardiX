'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings, Users, UserCog, Shield, CircleDollarSign, Wallet, Bot } from 'lucide-react'

interface AlertCounts {
  policies: number
  assemblies: number
}

interface SidebarShellProps {
  slug: string
  alertCounts?: AlertCounts
  userRole?: string
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  sectionLabel?: boolean
  children?: { label: string; href: string }[]
}

export function SidebarShell({ slug, alertCounts, userRole }: SidebarShellProps) {
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
    // D-05: Financeiro APENAS para admin e financeiro
    ...(userRole === 'admin' || userRole === 'financeiro'
      ? [{
          label: 'Financeiro',
          href: `/${slug}/financeiro`,
          icon: <Wallet size={16} />,
        }]
      : []),
    // D-AI: Assistente IA disponivel para admin, corretor e financeiro (nao para visualizador)
    ...(userRole === 'admin' || userRole === 'corretor' || userRole === 'financeiro'
      ? [{
          label: 'Assistente IA',
          href: `/${slug}/assistente`,
          icon: <Bot size={16} />,
        }]
      : []),
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
        ...(userRole === 'admin'
          ? [{ label: 'Automações', href: `/${slug}/configuracoes/automacoes` }]
          : []),
      ],
    },
  ]

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="flex h-full w-60 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary">
          <Shield size={14} className="text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight text-sidebar-foreground">GuardiX</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {navItems.map((item) => (
          <div key={item.label}>
            {item.sectionLabel ? (
              <div className="px-3 py-1 mt-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
                {item.label}
              </div>
            ) : item.children ? (
              <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70">
                {item.icon}
                {item.label}
              </div>
            ) : (
              <Link
                href={item.href}
                className={[
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive(item.href)
                    ? 'bg-sidebar-primary/15 text-sidebar-primary font-semibold'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
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
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white px-1">
                    {(alertCounts?.assemblies ?? 0) > 99 ? '99+' : alertCounts?.assemblies}
                  </span>
                )}
              </Link>
            )}

            {item.children && (
              <div className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                {item.children.map((child) => (
                  <Link
                    key={child.label}
                    href={child.href}
                    className={[
                      'rounded-lg px-3 py-1.5 text-sm transition-colors',
                      isActive(child.href)
                        ? 'text-sidebar-primary font-semibold'
                        : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                    ].join(' ')}
                  >
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
