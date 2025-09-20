import { useMemo, useState } from "react";
import { useOrganization } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Mail, Phone, Shield } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export default function CareCircle() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "basic_member" });
  const [touched, setTouched] = useState<{ email: boolean }>({ email: false });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["care-circle"],
    queryFn: () => apiFetch<{ members: any[] }>("/care-circle"),
  });
  const caregivers = data?.members || [];
  const invite = useMutation({
    mutationFn: (payload: any) => apiFetch("/care-circle/invite", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      setSuccessMsg("Invitation sent. They will receive an email to join your Care Circle.");
      setErrorMsg(null);
      qc.invalidateQueries({ queryKey: ["care-circle"] });
    },
    onError: (e: any) => {
      setErrorMsg(e?.message || "Failed to send invitation");
      setSuccessMsg(null);
    }
  });

  // Prefer Clerk client invite when available
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const mode = ((import.meta as any).env?.VITE_CARE_CIRCLE_MODE || '').toLowerCase();
  const preferClerkClient = mode !== 'supabase';

  const normalizeRole = (r: string) => {
    // Map UI roles to Clerk expected roles if needed
    // Clerk v5 typically uses 'basic_member' | 'admin'
    if (!r) return 'basic_member';
    if (r === 'member') return 'basic_member';
    return r;
  };

  const handleInvite = async () => {
    setSuccessMsg(null);
    setErrorMsg(null);
    const payload = { email: form.email.trim(), name: form.name.trim(), role: form.role };
    try {
      if (preferClerkClient && orgLoaded && organization) {
        // Clerk JS v5: inviteMembers({ emailAddresses: string[], role })
        await organization.inviteMembers({
          emailAddresses: [payload.email],
          role: normalizeRole(payload.role) as any,
        });
        setSuccessMsg("Invitation sent via Clerk. They will receive an email.");
        qc.invalidateQueries({ queryKey: ["care-circle"] });
      } else {
        // Fall back to API (server will use Clerk or Supabase based on mode)
        await invite.mutateAsync(payload);
      }
    } catch (e: any) {
      setErrorMsg(e?.errors?.[0]?.message || e?.message || "Failed to send invitation");
    }
  };

  const emailValid = useMemo(() => {
    const value = (form.email || "").trim();
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }, [form.email]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case "Primary Caregiver": return "bg-primary text-primary-foreground";
      case "Family Member": return "bg-secondary text-secondary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Care Circle</h1>
        <p className="text-muted-foreground">
          Manage your support network and share medication information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Member
          </CardTitle>
          <CardDescription>
            Invite family members or caregivers to your care circle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={() => setTouched((t) => ({ ...t, email: true }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              {/* Clerk roles */}
              <option value="basic_member">Member (read-only)</option>
              <option value="admin">Admin (manage)</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Button
              disabled={invite.isPending || !emailValid || (preferClerkClient && !orgLoaded)}
              onClick={handleInvite}
            >
              {invite.isPending ? "Sending..." : "Send Invitation"}
            </Button>
            {touched.email && !emailValid && <div className="text-xs text-red-600">Enter a valid email</div>}
          </div>
          {successMsg && <div className="text-sm text-medical-success">{successMsg}</div>}
          {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Current Members</h2>
        {isLoading && <div className="text-sm text-muted-foreground">Loading members...</div>}
        {error && <div className="text-sm text-red-600">{String((error as Error).message)}</div>}
        {caregivers.map((caregiver: any) => (
          <Card key={caregiver.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{caregiver.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge className={getRoleColor(caregiver.role || 'Member')}>
                        {caregiver.role || 'Member'}
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {(caregiver.permissions?.manageMedications ? 'Full Access' : 'Read Only')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{caregiver.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{caregiver.phone || '--'}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm">Edit Permissions</Button>
                <Button variant="outline" size="sm">Remove</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}