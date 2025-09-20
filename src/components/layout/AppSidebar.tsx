import { NavLink, useLocation } from "react-router-dom";
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { 
  Home,
  PlusCircle,
  Calendar,
  Users,
  BarChart3,
  MessageSquare,
  FileText,
  HeartPulse
} from "lucide-react";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Add Prescription", url: "/prescription/add", icon: PlusCircle },
  { title: "Medications", url: "/medications", icon: Calendar },
  { title: "Care Circle", url: "/care-circle", icon: Users },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Health Profile", url: "/health", icon: HeartPulse },
  { title: "AI Assistant", url: "/assistant", icon: MessageSquare },
  { title: "Reports", url: "/reports", icon: FileText },
];

export function AppSidebar() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground">
            Medical Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                     <NavLink 
                      to={item.url} 
                      className={({ isActive: navActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                        navActive || isActive(item.url)
                          ? "bg-sidebar-accent !text-foreground !opacity-100 font-semibold"
                          : "!text-foreground !opacity-100 hover:bg-sidebar-accent hover:!text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4 !text-foreground" />
                      <span>{item.title}</span>
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