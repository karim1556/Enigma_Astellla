import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";

function ChipsField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (vals: string[]) => void; placeholder?: string; }) {
  const [val, setVal] = useState("");
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => onChange(values.filter((_, idx) => idx !== i))}>
            {v}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder || "Add and press Enter"}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const t = val.trim();
              if (t) onChange([...(values || []), t]);
              setVal("");
            }
          }}
        />
        <Button type="button" onClick={() => { const t = val.trim(); if (t) { onChange([...(values || []), t]); setVal(""); } }}>Add</Button>
      </div>
    </div>
  );
}

export default function HealthProfile() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["health-profile"],
    queryFn: () => apiFetch<{ profile: any }>("/health/profile"),
  });
  const profile = data?.profile || {};

  const [form, setForm] = useState<any>({});
  useEffect(() => { setForm(profile); }, [JSON.stringify(profile)]);

  const [justSaved, setJustSaved] = useState(false);
  const save = useMutation({
    mutationFn: (payload: any) => apiFetch("/health/profile", { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      await refetch();
    }
  });

  if (isLoading) return <div className="p-4">Loading...</div>;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Health Profile</CardTitle>
          <CardDescription>Keep your medical background and current health information up to date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ChipsField label="Conditions (past/ongoing)" values={form.conditions || []} onChange={(v) => setForm({ ...form, conditions: v })} placeholder="e.g., Hypertension" />
          <ChipsField label="Allergies" values={form.allergies || []} onChange={(v) => setForm({ ...form, allergies: v })} placeholder="e.g., Penicillin" />

          <Separator />
          <div className="space-y-3">
            <div className="text-sm font-medium">Current Medications</div>
            {(form.current_meds || []).map((m: any, idx: number) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                <Input placeholder="Name" value={m.name || ""} onChange={(e) => {
                  const arr = [...(form.current_meds || [])]; arr[idx] = { ...arr[idx], name: e.target.value }; setForm({ ...form, current_meds: arr });
                }} />
                <Input placeholder="Dosage" value={m.dosage || ""} onChange={(e) => {
                  const arr = [...(form.current_meds || [])]; arr[idx] = { ...arr[idx], dosage: e.target.value }; setForm({ ...form, current_meds: arr });
                }} />
                <Input placeholder="Frequency" value={m.frequency || ""} onChange={(e) => {
                  const arr = [...(form.current_meds || [])]; arr[idx] = { ...arr[idx], frequency: e.target.value }; setForm({ ...form, current_meds: arr });
                }} />
                <Input placeholder="Started on (YYYY-MM-DD)" value={m.started_on || ""} onChange={(e) => {
                  const arr = [...(form.current_meds || [])]; arr[idx] = { ...arr[idx], started_on: e.target.value }; setForm({ ...form, current_meds: arr });
                }} />
                <Button variant="outline" onClick={() => setForm({ ...form, current_meds: (form.current_meds || []).filter((_: any, i: number) => i !== idx) })}>Remove</Button>
              </div>
            ))}
            <Button variant="outline" onClick={() => setForm({ ...form, current_meds: [...(form.current_meds || []), {}] })}>Add Medication</Button>
          </div>

          <Separator />
          <div className="space-y-3">
            <div className="text-sm font-medium">Surgeries / Procedures</div>
            {(form.surgeries || []).map((s: any, idx: number) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                <Input placeholder="Name" value={s.name || ""} onChange={(e) => { const arr = [...(form.surgeries || [])]; arr[idx] = { ...arr[idx], name: e.target.value }; setForm({ ...form, surgeries: arr }); }} />
                <Input placeholder="Date (YYYY-MM-DD)" value={s.date || ""} onChange={(e) => { const arr = [...(form.surgeries || [])]; arr[idx] = { ...arr[idx], date: e.target.value }; setForm({ ...form, surgeries: arr }); }} />
                <Input placeholder="Notes" value={s.notes || ""} onChange={(e) => { const arr = [...(form.surgeries || [])]; arr[idx] = { ...arr[idx], notes: e.target.value }; setForm({ ...form, surgeries: arr }); }} />
                <Button variant="outline" onClick={() => setForm({ ...form, surgeries: (form.surgeries || []).filter((_: any, i: number) => i !== idx) })}>Remove</Button>
              </div>
            ))}
            <Button variant="outline" onClick={() => setForm({ ...form, surgeries: [...(form.surgeries || []), {}] })}>Add Surgery</Button>
          </div>

          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="text-sm font-medium pb-2">Lifestyle</div>
              <Input placeholder="Smoking (e.g., none)" value={form.lifestyle?.smoking || ""} onChange={(e) => setForm({ ...form, lifestyle: { ...(form.lifestyle || {}), smoking: e.target.value } })} />
              <Input className="mt-2" placeholder="Alcohol (e.g., occasional)" value={form.lifestyle?.alcohol || ""} onChange={(e) => setForm({ ...form, lifestyle: { ...(form.lifestyle || {}), alcohol: e.target.value } })} />
              <Input className="mt-2" placeholder="Activity Level (e.g., moderate)" value={form.lifestyle?.activityLevel || ""} onChange={(e) => setForm({ ...form, lifestyle: { ...(form.lifestyle || {}), activityLevel: e.target.value } })} />
              <Input className="mt-2" placeholder="Diet (e.g., low-carb)" value={form.lifestyle?.diet || ""} onChange={(e) => setForm({ ...form, lifestyle: { ...(form.lifestyle || {}), diet: e.target.value } })} />
            </div>
            <div>
              <div className="text-sm font-medium pb-2">Vitals</div>
              <Input placeholder="Height (cm)" value={form.vitals?.height_cm || ""} onChange={(e) => setForm({ ...form, vitals: { ...(form.vitals || {}), height_cm: e.target.value } })} />
              <Input className="mt-2" placeholder="Weight (kg)" value={form.vitals?.weight_kg || ""} onChange={(e) => setForm({ ...form, vitals: { ...(form.vitals || {}), weight_kg: e.target.value } })} />
              <Input className="mt-2" placeholder="Blood Pressure (e.g., 120/80)" value={form.vitals?.bp || ""} onChange={(e) => setForm({ ...form, vitals: { ...(form.vitals || {}), bp: e.target.value } })} />
              <Input className="mt-2" placeholder="Blood Sugar" value={form.vitals?.blood_sugar || ""} onChange={(e) => setForm({ ...form, vitals: { ...(form.vitals || {}), blood_sugar: e.target.value } })} />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-medium pb-2">Family History</div>
              <Textarea placeholder="e.g., Father: diabetes; Mother: hypertension" value={(form.family_history || []).join("\n")} onChange={(e) => setForm({ ...form, family_history: e.target.value.split(/\n+/).map((s) => s.trim()).filter(Boolean) })} />
              <div className="text-xs text-muted-foreground mt-1">One per line.</div>
            </div>
          </div>

          <Separator />
          <div className="space-y-2">
            <div className="text-sm font-medium">Notes</div>
            <Textarea placeholder="Anything else you'd like to add..." value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="pt-2">
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>{save.isPending ? "Saving..." : (justSaved ? "Saved" : "Save Profile")}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Preview / Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details Preview</CardTitle>
          <CardDescription>Click on chips to delete. Use the remove buttons for list items to delete.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Conditions</div>
            {(form.conditions || []).length ? (
              <div className="flex flex-wrap gap-2">
                {(form.conditions || []).map((c: string, i: number) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setForm({ ...form, conditions: (form.conditions || []).filter((_: any, idx: number) => idx !== i) })}>{c}</Badge>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground">None</div>}
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Allergies</div>
            {(form.allergies || []).length ? (
              <div className="flex flex-wrap gap-2">
                {(form.allergies || []).map((a: string, i: number) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setForm({ ...form, allergies: (form.allergies || []).filter((_: any, idx: number) => idx !== i) })}>{a}</Badge>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground">None</div>}
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Current Medications</div>
            {(form.current_meds || []).length ? (
              <div className="grid gap-2">
                {(form.current_meds || []).map((m: any, idx: number) => (
                  <div key={idx} className="text-sm flex flex-wrap gap-3 items-center">
                    <span className="font-medium">{m.name || "Unnamed"}</span>
                    <span className="text-muted-foreground">{m.dosage || "-"}</span>
                    <span className="text-muted-foreground">{m.frequency || "-"}</span>
                    <span className="text-muted-foreground">{m.started_on || "-"}</span>
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...form, current_meds: (form.current_meds || []).filter((_: any, i: number) => i !== idx) })}>Delete</Button>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground">None</div>}
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Surgeries</div>
            {(form.surgeries || []).length ? (
              <div className="grid gap-2">
                {(form.surgeries || []).map((s: any, idx: number) => (
                  <div key={idx} className="text-sm flex flex-wrap gap-3 items-center">
                    <span className="font-medium">{s.name || "Unnamed"}</span>
                    <span className="text-muted-foreground">{s.date || "-"}</span>
                    <span className="text-muted-foreground">{s.notes || "-"}</span>
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...form, surgeries: (form.surgeries || []).filter((_: any, i: number) => i !== idx) })}>Delete</Button>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground">None</div>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">Lifestyle</div>
              <div className="text-sm text-muted-foreground">Smoking: {form.lifestyle?.smoking || '-'}</div>
              <div className="text-sm text-muted-foreground">Alcohol: {form.lifestyle?.alcohol || '-'}</div>
              <div className="text-sm text-muted-foreground">Activity: {form.lifestyle?.activityLevel || '-'}</div>
              <div className="text-sm text-muted-foreground">Diet: {form.lifestyle?.diet || '-'}</div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Vitals</div>
              <div className="text-sm text-muted-foreground">Height: {form.vitals?.height_cm || '-'} cm</div>
              <div className="text-sm text-muted-foreground">Weight: {form.vitals?.weight_kg || '-'} kg</div>
              <div className="text-sm text-muted-foreground">BP: {form.vitals?.bp || '-'}</div>
              <div className="text-sm text-muted-foreground">Blood Sugar: {form.vitals?.blood_sugar || '-'}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Family History</div>
            {(form.family_history || []).length ? (
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {(form.family_history || []).map((f: string, i: number) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            ) : <div className="text-sm text-muted-foreground">None</div>}
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Notes</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{form.notes || '-'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
