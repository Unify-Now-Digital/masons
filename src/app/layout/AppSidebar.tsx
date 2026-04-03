import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem
} from "@/shared/components/ui/sidebar";
import { useSidebar } from "@/shared/components/ui/sidebar-context";
import { Inbox, MapPin, FileText, ChartBar, ListCheck, Bell, MessageSquare, Users, Building2, Hammer, Landmark, Italic, CreditCard, UserCog, ClipboardCheck } from 'lucide-react';

const navigationItems = [
  { title: "Unified Inbox", url: "/dashboard/inbox", icon: Inbox },
  { title: "Map of Jobs", url: "/dashboard/map", icon: MapPin },
  { title: "Jobs", url: "/dashboard/jobs", icon: Hammer },
  { title: "Orders", url: "/dashboard/orders", icon: ListCheck },
  { title: "People", url: "/dashboard/customers", icon: Users },
  { title: "Companies", url: "/dashboard/companies", icon: Building2 },
  { title: "Products", url: "/dashboard/memorials", icon: Landmark },
  { title: "Inscriptions", url: "/dashboard/inscriptions", icon: Italic },
  { title: "Permits", url: "/dashboard/permit-tracker", icon: ClipboardCheck },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard },
  { title: "Invoicing", url: "/dashboard/invoicing", icon: FileText },
  { title: "Reporting", url: "/dashboard/reporting", icon: ChartBar },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
  { title: "Team Chat", url: "/dashboard/team", icon: MessageSquare },
  { title: "Workers", url: "/dashboard/workers", icon: UserCog },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  const getNavClassName = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-blue-100 text-blue-700 font-medium" : "hover:bg-slate-100";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClassName}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

