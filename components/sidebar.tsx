'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutListIcon,
  BarChart3Icon,
  SettingsIcon,
  LogOutIcon,
  MenuIcon,
  PhoneCallIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
}

const navItems = [
  { href: '/queue', label: 'Lead Queue', icon: LayoutListIcon },
  { href: '/analytics', label: 'Analytics', icon: BarChart3Icon },
];

const adminItem = { href: '/admin', label: 'Admin', icon: SettingsIcon };

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function NavContent({
  user,
  pathname,
}: SidebarProps & { pathname: string }) {
  const items = user.role === 'admin' ? [...navItems, adminItem] : navItems;

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-4">
        <PhoneCallIcon className="size-5 text-primary" />
        <span className="text-lg font-semibold tracking-tight">Saul</span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User info + sign out */}
      <div className="flex items-center gap-3 p-4">
        <Avatar size="sm">
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            {user.name ?? 'User'}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {user.role ?? 'bda'}
          </span>
        </div>
        <form action="/api/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
          >
            <LogOutIcon className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:flex md:flex-col">
        <NavContent user={user} pathname={pathname} />
      </aside>

      {/* Mobile header + sheet sidebar */}
      <div className="flex items-center gap-2 border-b bg-sidebar p-3 md:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Open menu" />
            }
          >
            <MenuIcon className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <NavContent user={user} pathname={pathname} />
          </SheetContent>
        </Sheet>
        <PhoneCallIcon className="size-4 text-primary" />
        <span className="text-sm font-semibold">Saul</span>
      </div>
    </>
  );
}
