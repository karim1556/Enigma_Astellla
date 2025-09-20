import { useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  Plus,
  TrendingUp
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export function DashboardOverview() {
  const [medications, setMedications] = useState<any[]>([]);
  const [adherence, setAdherence] = useState<{ overall?: { adherenceRate?: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const meds = await apiFetch<any>('/medications');
        const analytics = await apiFetch<any>('/analytics/adherence');
        if (!cancelled) {
          const medsNormalized = Array.isArray(meds) ? meds : (((meds as any)?.items) || []);
          setMedications(medsNormalized as any[]);
          setAdherence(analytics || null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "success";
      case "pending": return "warning";
      case "missed": return "destructive";
      default: return "secondary";
    }
  };

  // For now, we don't have per-schedule status; compute simple placeholders
  const todaysMedications = useMemo(() => (medications || []).slice(0, 4).map((m: any, idx: number) => ({
    id: m.id || idx,
    name: m.name,
    dosage: m.dosage || '',
    time: (m.reminder_times && m.reminder_times[0]) || '--',
    status: (m.status || 'pending') as string,
    type: m.category || 'general'
  })), [medications]);

  const completedToday = 0;
  const adherenceRate = Math.round(((adherence?.overall?.adherenceRate ?? 0) * 100));

  return (
    <div className="space-y-6">
      <SignedOut>
        <div className="p-6 border rounded-lg">
          <div className="text-lg font-semibold mb-2">Sign in required</div>
          <div className="text-sm text-muted-foreground mb-4">Please sign in to view your dashboard.</div>
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
      <SignedIn>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Medication adherence overview</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Prescription
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-medical-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedToday}/{todaysMedications.length}</div>
            <p className="text-xs text-muted-foreground">
              medications taken
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adherence Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-medical-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : `${adherenceRate}%`}</div>
            <Progress value={adherenceRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Medications</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : medications.length}</div>
            <p className="text-xs text-muted-foreground">
              currently prescribed
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Care Circle</CardTitle>
            <Users className="h-4 w-4 text-medical-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              family members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Medication Schedule
          </CardTitle>
          <CardDescription>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          <div className="space-y-3">
            {todaysMedications.map((medication) => (
              <div 
                key={medication.id} 
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    (medication.status === 'completed') ? 'bg-medical-success' :
                    (medication.status === 'pending') ? 'bg-medical-warning' :
                    'bg-medical-critical'
                  }`} />
                  <div>
                    <div className="font-medium">{medication.name}</div>
                    <div className="text-sm text-muted-foreground">{medication.dosage}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">{medication.time}</div>
                  <Badge 
                    variant={getStatusColor(medication.status)}
                    className="capitalize"
                  >
                    {medication.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <Plus className="h-4 w-4 mr-2" />
              Upload New Prescription
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Users className="h-4 w-4 mr-2" />
              Invite Care Circle Member
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Report Side Effect
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-2 rounded-md bg-medical-warning/10">
              <AlertTriangle className="h-4 w-4 text-medical-warning mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Medication reminder</div>
                <div className="text-muted-foreground">Aspirin due at 12:00 PM</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 rounded-md bg-medical-info/10">
              <CheckCircle className="h-4 w-4 text-medical-info mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Prescription approved</div>
                <div className="text-muted-foreground">Metformin added to schedule</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </SignedIn>
    </div>
  );
}