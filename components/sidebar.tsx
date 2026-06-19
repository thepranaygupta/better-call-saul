'use client';

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutListIcon,
  BarChart3Icon,
  SettingsIcon,
  LogOutIcon,
  MenuIcon,
  PhoneCallIcon,
  ArrowRightIcon,
  UsersIcon,
  SlidersHorizontalIcon,
  UploadIcon,
  ClockIcon,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
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
import type { SidebarStats, NextLeadInfo } from '@/lib/sidebar-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  stats: SidebarStats;
  nextLead: NextLeadInfo | null;
}

export interface RecentLead {
  id: string;
  name: string;
  band: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENT_LEADS_KEY = 'saul:recent-leads';

const BAND_DOT_COLORS: Record<string, string> = {
  call_now: 'bg-red-800',
  qualify: 'bg-amber-600',
  nurture: 'bg-teal-700',
  cold: 'bg-stone-400',
  disqualified: 'bg-stone-300',
};

const navItems = [
  { href: '/queue', label: 'Lead Queue', icon: LayoutListIcon },
  { href: '/analytics', label: 'Analytics', icon: BarChart3Icon },
];

const adminSubNav = [
  { href: '/admin', label: 'Users & Projects', icon: UsersIcon },
  { href: '/admin/scoring', label: 'Scoring Config', icon: SlidersHorizontalIcon },
  { href: '/admin/import', label: 'Import Leads', icon: UploadIcon },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function readRecentLeads(): RecentLead[] {
  try {
    const raw = localStorage.getItem(RECENT_LEADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const emptyLeads: RecentLead[] = [];

function useRecentLeads(): RecentLead[] {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener('saul:recent-leads-updated', onStoreChange);
    return () => window.removeEventListener('saul:recent-leads-updated', onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => {
    return JSON.stringify(readRecentLeads());
  }, []);

  const getServerSnapshot = useCallback(() => {
    return JSON.stringify(emptyLeads);
  }, []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const leads: RecentLead[] = JSON.parse(raw);
  return leads.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NextLeadButton({ nextLead }: { nextLead: NextLeadInfo | null }) {
  const router = useRouter();

  if (!nextLead) {
    return (
      <button
        disabled
        className="flex w-full items-center justify-center gap-2 bg-stone-200 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400"
      >
        No hot leads
      </button>
    );
  }

  return (
    <button
      onClick={() => router.push(`/leads/${nextLead.id}`)}
      className="flex w-full items-center justify-center gap-2 bg-amber-700 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-amber-800 active:bg-amber-900"
    >
      Next Lead
      <ArrowRightIcon className="size-3.5" />
    </button>
  );
}

function QuickStats({ stats }: { stats: SidebarStats }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      <div className="flex flex-col items-center rounded bg-stone-50 px-2 py-1.5">
        <span className="font-mono text-base font-bold text-red-800">
          {stats.callNowCount}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
          Call now
        </span>
      </div>
      <div className="flex flex-col items-center rounded bg-stone-50 px-2 py-1.5">
        <span className="font-mono text-base font-bold text-stone-700">
          {stats.calledToday}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
          Called
        </span>
      </div>
      <div className="flex flex-col items-center rounded bg-stone-50 px-2 py-1.5">
        <span className="font-mono text-base font-bold text-stone-700">
          {stats.totalLeads}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
          Total
        </span>
      </div>
    </div>
  );
}

function RecentLeadsSection({ leads }: { leads: RecentLead[] }) {
  if (leads.length === 0) return null;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 px-3 pt-1">
        <ClockIcon className="size-3 text-stone-400" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
          Recent
        </span>
      </div>
      {leads.map((lead) => (
        <Link
          key={lead.id}
          href={`/leads/${lead.id}`}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950"
        >
          <span
            className={cn(
              'inline-block size-2 shrink-0 rounded-full',
              BAND_DOT_COLORS[lead.band] ?? 'bg-stone-300',
            )}
          />
          <span className="truncate">{lead.name}</span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav content (shared between desktop and mobile sheet)
// ---------------------------------------------------------------------------

function NavContent({
  user,
  pathname,
  stats,
  nextLead,
  recentLeads,
}: SidebarProps & { pathname: string; recentLeads: RecentLead[] }) {
  const isAdmin = user.role === 'admin';
  const adminActive = pathname.startsWith('/admin');

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <PhoneCallIcon className="size-5 text-amber-700" />
        <span className="text-sm font-semibold uppercase tracking-widest text-stone-950">
          SAUL
        </span>
      </div>

      <Separator />

      {/* Next Lead + Quick Stats */}
      <div className="space-y-2 p-2">
        <NextLeadButton nextLead={nextLead} />
        <QuickStats stats={stats} />
      </div>

      <Separator />

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-xs font-medium uppercase tracking-widest transition-colors',
                isActive
                  ? 'bg-amber-700 text-white'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-950',
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {/* Badge on Lead Queue -- call_now count */}
              {item.href === '/queue' && stats.callNowCount > 0 && (
                <span
                  className={cn(
                    'inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-700 text-white',
                  )}
                >
                  {stats.callNowCount > 99 ? '99+' : stats.callNowCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* Admin with sub-navigation */}
        {isAdmin && (
          <div>
            <div
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-xs font-medium uppercase tracking-widest',
                adminActive
                  ? 'bg-amber-700 text-white'
                  : 'text-stone-500',
              )}
            >
              <SettingsIcon className="size-4" aria-hidden="true" />
              Admin
            </div>
            {/* Sub-links */}
            <div className="ml-7 mt-0.5 space-y-0.5">
              {adminSubNav.map((sub) => {
                const subActive = pathname === sub.href;
                return (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    aria-current={subActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded px-2 py-1 text-[11px] transition-colors',
                      subActive
                        ? 'font-medium text-amber-700'
                        : 'text-stone-400 hover:text-stone-700',
                    )}
                  >
                    <sub.icon className="size-3" aria-hidden="true" />
                    {sub.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Recent leads */}
        <RecentLeadsSection leads={recentLeads} />
      </nav>

      <Separator />

      {/* User info + sign out */}
      <div className="flex items-center gap-3 p-4">
        <Avatar size="sm">
          <AvatarFallback className="bg-amber-100 text-amber-800">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-stone-950">
            {user.name ?? 'User'}
          </span>
          <span className="truncate text-xs uppercase tracking-widest text-stone-500">
            {user.role ?? 'bda'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Sign out"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOutIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar (exported)
// ---------------------------------------------------------------------------

export function Sidebar({ user, stats, nextLead }: SidebarProps) {
  const pathname = usePathname();
  const recentLeads = useRecentLeads();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:flex md:flex-col">
        <NavContent
          user={user}
          pathname={pathname}
          stats={stats}
          nextLead={nextLead}
          recentLeads={recentLeads}
        />
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
            <NavContent
              user={user}
              pathname={pathname}
              stats={stats}
              nextLead={nextLead}
              recentLeads={recentLeads}
            />
          </SheetContent>
        </Sheet>
        <PhoneCallIcon className="size-4 text-amber-700" />
        <span className="text-xs font-semibold uppercase tracking-widest text-stone-950">
          SAUL
        </span>
        {/* Mobile: call_now badge next to brand */}
        {stats.callNowCount > 0 && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-red-800 text-[10px] font-bold text-white">
            {stats.callNowCount > 99 ? '99+' : stats.callNowCount}
          </span>
        )}
      </div>
    </>
  );
}
