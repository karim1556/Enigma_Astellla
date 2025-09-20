import { useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Calendar, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function Analytics() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<any>("/analytics/adherence");
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const adherenceRate = useMemo(() => Math.round(((data?.overall?.adherenceRate ?? 0) * 100)), [data]);
  const takenDoses = data?.overall?.takenDoses ?? 0;
  const totalDoses = data?.overall?.totalDoses ?? 0;
  const improvement = data?.overall?.improvement ?? 0;
  const onTimeRate = data?.overall?.onTimeRate ?? 0;
  const dailyTrends: Array<{ label: string; value: number }> = useMemo(() => {
    if (Array.isArray(data?.dailyTrends) && data.dailyTrends.length) {
      return data.dailyTrends.map((d: any) => ({ label: d.date || d.day || "", value: d.adherence || d.value || 0 }));
    }
    return [];
  }, [data]);

  return (
    <div className="space-y-6">
      <SignedOut>
        <div className="p-6 border rounded-lg">
          <div className="text-lg font-semibold mb-2">Sign in required</div>
          <div className="text-sm text-muted-foreground mb-4">Please sign in to view analytics.</div>
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
      <SignedIn>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Track your medication adherence and progress
        </p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adherence Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : `${adherenceRate}%`}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
            <Badge variant="outline" className="mt-2">{(improvement >= 0 ? "+" : "") + Math.round(improvement * 100) + "%"}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medications Taken</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : `${takenDoses}/${totalDoses}`}</div>
            <p className="text-xs text-muted-foreground">This period</p>
            <Badge variant="outline" className="mt-2">Total</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-time Rate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : `${Math.round(onTimeRate * 100)}%`}</div>
            <p className="text-xs text-muted-foreground">When taken late</p>
            <Badge variant="outline" className="mt-2">Current</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Weekly Adherence
          </CardTitle>
          <CardDescription>
            Your medication adherence for each day this week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(dailyTrends.length ? dailyTrends : [
            { label: "Mon", value: 0 },
            { label: "Tue", value: 0 },
            { label: "Wed", value: 0 },
            { label: "Thu", value: 0 },
            { label: "Fri", value: 0 },
            { label: "Sat", value: 0 },
            { label: "Sun", value: 0 },
          ]).map((day, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="w-12 text-sm font-medium">{day.label}</div>
              <div className="flex-1">
                <Progress 
                  value={day.value} 
                  className="h-2"
                />
              </div>
              <div className="w-12 text-sm text-right">{day.value}%</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Missed Doses</CardTitle>
            <CardDescription>Recent medication misses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">No recent misses</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Achievements</CardTitle>
            <CardDescription>Your medication milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">Achievements will appear as you build consistency</div>
          </CardContent>
        </Card>
      </div>
      </SignedIn>
    </div>
  );
}