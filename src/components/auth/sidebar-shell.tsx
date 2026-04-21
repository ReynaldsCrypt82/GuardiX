'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings, Users } from 'lucide-react'

interface SidebarShellProps {
  slug: string
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  children?: { label: string; href: string }[]
}

export function SidebarShell({ slug }: SidebarShellProps) {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: `/${slug}/dashboard`,
      icon: <LayoutDashboard size={16} />,
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
            <Link
              href={item.href}
              className={[
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isActive(item.href) && !item.children
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-foreground hover:bg-muted',
              ].join(' ')}
            >
              {item.icon}
              {item.label}
            </Link>

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
                    <Users size={14} />
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
