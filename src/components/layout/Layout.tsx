import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/clerk-react";
import { Bell, Settings } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  // Dev-only signed-in status indicator
  const { isSignedIn, getToken } = useAuth();
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const t = await getToken({ skipCache: true } as any);
        if (active) setTokenPreview(t ? String(t).slice(0, 8) : null);
      } catch {
        if (active) setTokenPreview(null);
      }
    })();
    return () => { active = false; };
  }, [isSignedIn, getToken]);

  const isDev = (import.meta as any).env?.MODE === 'development';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="font-semibold text-lg tracking-tight">MediGuide</div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
              {isDev && (
                <div className="hidden md:flex items-center text-xs px-2 py-1 rounded border border-border text-muted-foreground">
                  <span className="mr-1">Signed:</span>
                  <span className={isSignedIn ? "text-medical-success" : "text-medical-critical"}>
                    {isSignedIn ? "yes" : "no"}
                  </span>
                  <span className="mx-2">|</span>
                  <span>tok: {tokenPreview ? `${tokenPreview}…` : "none"}</span>
                </div>
              )}
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="outline" size="sm">Login</Button>
                </SignInButton>
              </SignedOut>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}