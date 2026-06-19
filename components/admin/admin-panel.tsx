'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ProjectForm } from '@/components/admin/project-form';
import { UserForm } from '@/components/admin/user-form';
import { UserEditDialog } from '@/components/admin/user-edit-dialog';
import { UserDeactivateButton } from '@/components/admin/user-deactivate-button';
import { ProjectActiveToggle } from '@/components/admin/project-active-toggle';
import type {
  SerializedProject,
  SerializedUser,
} from '@/app/(app)/admin/actions';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  sales_lead: 'Sales Lead',
  bda: 'BDA',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-800/10 text-red-800',
  sales_lead: 'bg-amber-700/10 text-amber-800',
  bda: 'bg-teal-700/10 text-teal-700',
};

interface AdminPanelProps {
  projects: SerializedProject[];
  users: SerializedUser[];
}

export function AdminPanel({ projects, users }: AdminPanelProps) {
  // Build a project name lookup for the user table
  const projectMap = new Map(projects.map((p) => [p._id, p]));

  return (
    <Tabs defaultValue="projects">
      <TabsList variant="line">
        <TabsTrigger
          value="projects"
          className="text-xs font-semibold uppercase tracking-widest"
        >
          Projects ({projects.length})
        </TabsTrigger>
        <TabsTrigger
          value="users"
          className="text-xs font-semibold uppercase tracking-widest"
        >
          Users ({users.length})
        </TabsTrigger>
      </TabsList>

      {/* Projects tab */}
      <TabsContent value="projects">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-stone-500">
              Manage brands and business groups.
            </p>
            <ProjectForm />
          </div>

          {projects.length === 0 ? (
            <div className="flex items-center justify-center border border-dashed border-stone-300 p-8">
              <p className="text-[13px] text-stone-500">
                No projects yet. Create your first project above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="border-stone-200 hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Name
                    </TableHead>
                    <TableHead className="hidden text-[10px] font-semibold uppercase tracking-widest text-stone-500 sm:table-cell">
                      Slug
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Status
                    </TableHead>
                    <TableHead className="hidden text-[10px] font-semibold uppercase tracking-widest text-stone-500 md:table-cell">
                      Created
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project._id} className="border-stone-200">
                      <TableCell className="text-[13px] font-medium text-stone-950">
                        {project.name}
                      </TableCell>
                      <TableCell className="hidden font-mono text-[12px] text-stone-500 sm:table-cell">
                        {project.slug}
                      </TableCell>
                      <TableCell>
                        {project.active ? (
                          <Badge
                            variant="secondary"
                            className="bg-teal-700/10 text-[10px] font-semibold uppercase tracking-widest text-teal-700"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-stone-200 text-[10px] font-semibold uppercase tracking-widest text-stone-500"
                          >
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-[12px] text-stone-500 md:table-cell">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <ProjectActiveToggle
                          projectId={project._id}
                          active={project.active}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </TabsContent>

      {/* Users tab */}
      <TabsContent value="users">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-stone-500">
              Manage team members and their project assignments.
            </p>
            <UserForm projects={projects} />
          </div>

          {users.length === 0 ? (
            <div className="flex items-center justify-center border border-dashed border-stone-300 p-8">
              <p className="text-[13px] text-stone-500">
                No users yet. Create your first user above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="border-stone-200 hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Name
                    </TableHead>
                    <TableHead className="hidden text-[10px] font-semibold uppercase tracking-widest text-stone-500 sm:table-cell">
                      Email
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Role
                    </TableHead>
                    <TableHead className="hidden text-[10px] font-semibold uppercase tracking-widest text-stone-500 md:table-cell">
                      Projects
                    </TableHead>
                    <TableHead className="hidden text-[10px] font-semibold uppercase tracking-widest text-stone-500 lg:table-cell">
                      Created
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user._id}
                      className={`border-stone-200 ${user.active === false ? 'opacity-50' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium text-stone-950">
                            {user.name}
                          </span>
                          {user.active === false && (
                            <Badge
                              variant="secondary"
                              className="bg-stone-200 text-[9px] font-semibold uppercase tracking-widest text-stone-500"
                            >
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 sm:hidden">
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-[12px] text-stone-500 sm:table-cell">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-semibold uppercase tracking-widest ${ROLE_COLORS[user.role] ?? ''}`}
                        >
                          {ROLE_LABELS[user.role] ?? user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {user.role === 'admin' ? (
                          <span className="text-[11px] italic text-stone-400">
                            All projects
                          </span>
                        ) : user.assignedProjectIds.length === 0 ? (
                          <span className="text-[11px] text-stone-400">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.assignedProjectIds.map((pid) => {
                              const project = projectMap.get(pid);
                              return (
                                <span
                                  key={pid}
                                  className="inline-block bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
                                >
                                  {project?.name ?? pid}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-[12px] text-stone-500 lg:table-cell">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <UserEditDialog user={user} projects={projects} />
                          <UserDeactivateButton user={user} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
