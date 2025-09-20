import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill, Clock, AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export default function Medications() {
  const qc = useQueryClient();
  const [notifyResult, setNotifyResult] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [newMed, setNewMed] = useState({ name: "", dosage: "", times: "" });
  const [phone, setPhone] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [customMeds, setCustomMeds] = useState<Array<{ name: string; dosage: string; time: string }>>([
    { name: "", dosage: "", time: "" },
  ]);
  const [memberMed, setMemberMed] = useState({ name: "", dosage: "", frequency: "", instructions: "", category: "", times: "" });
  const [memberPhone, setMemberPhone] = useState("");

  const { data: medsData, isLoading, error } = useQuery({
    queryKey: ["medications"],
    queryFn: () => apiFetch<{ medications: any[] }>("/medications"),
  });

  // Update medication
  const updateMedication = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => apiFetch(`/medications/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medications"] });
      refetchMemberMeds();
    },
  });

  // Delete (soft) medication
  const deleteMedication = useMutation({
    mutationFn: (id: string) => apiFetch(`/medications/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medications"] });
      refetchMemberMeds();
    },
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ [k: string]: any }>({});

  // Add medication for selected member
  const addMedicationForMember = useMutation({
    mutationFn: (payload: any) => apiFetch("/medications/for-user", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      setMemberMed({ name: "", dosage: "", frequency: "", instructions: "", category: "", times: "" });
      refetchMemberMeds();
    },
  });

  // Send custom SMS to one member
  const sendCustom = useMutation({
    mutationFn: (payload: any) => apiFetch("/notifications/send", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setNotifyError(null);
      setNotifyResult("Custom message sent");
    },
    onError: (e: any) => setNotifyError(e?.message || "Failed to send"),
  });

  // Dev auto start/stop
  const autoStart = useMutation({
    mutationFn: (payload: any) => apiFetch("/notifications/dev/start", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (r: any) => { setNotifyError(null); setNotifyResult(r?.message || "Auto started"); },
    onError: (e: any) => setNotifyError(e?.message || "Failed to start"),
  });
  const autoStop = useMutation({
    mutationFn: () => apiFetch("/notifications/dev/stop", { method: "POST" }),
    onSuccess: (r: any) => { setNotifyError(null); setNotifyResult(r?.message || "Auto stopped"); },
    onError: (e: any) => setNotifyError(e?.message || "Failed to stop"),
  });

  const addCustomRow = () => setCustomMeds([...customMeds, { name: "", dosage: "", time: "" }]);
  const updateCustomRow = (idx: number, key: 'name'|'dosage'|'time', value: string) => {
    setCustomMeds(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r));
  };
  const removeCustomRow = (idx: number) => setCustomMeds(prev => prev.filter((_, i) => i !== idx));
  const medications = medsData?.medications || [];

  const { data: profileData } = useQuery({
    queryKey: ["profile"],
    queryFn: () => apiFetch<{ id: string; phone?: string }>("/users/profile"),
  });
  const initialPhone = useMemo(() => (profileData?.phone || ""), [profileData]);

  // Care circle members for dropdown
  const { data: circleData } = useQuery({
    queryKey: ["care-circle"],
    queryFn: () => apiFetch<{ members: Array<{ id: string; name: string; email?: string; phone?: string }> }>("/care-circle"),
  });
  const members = circleData?.members || [];
  const selectedMember = useMemo(() => members.find(m => String(m.id) === String(selectedMemberId)), [members, selectedMemberId]);

  // Medications for selected member
  const { data: memberMedsData, refetch: refetchMemberMeds } = useQuery({
    queryKey: ["medications-for-user", selectedMemberId],
    queryFn: () => apiFetch<{ medications: any[] }>(`/medications/for-user?userId=${encodeURIComponent(selectedMemberId)}`),
    enabled: !!selectedMemberId,
  });
  const memberMeds = memberMedsData?.medications || [];

  // Update phone
  const savePhone = useMutation({
    mutationFn: (value: string) => apiFetch("/users/profile", {
      method: "PUT",
      body: JSON.stringify({ phone: value }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  // Add medication
  const addMedication = useMutation({
    mutationFn: (payload: any) => apiFetch("/medications", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      setNewMed({ name: "", dosage: "", times: "" });
      qc.invalidateQueries({ queryKey: ["medications"] });
    },
  });

  // Notify care circle
  const notifyCare = useMutation({
    mutationFn: () => apiFetch("/notifications/meds/now", { method: "POST" }),
    onSuccess: (res: any) => {
      setNotifyError(null);
      setNotifyResult(`Sent: ${res.sent}/${res.attempted}. Upcoming: ${res.upcoming}.`);
    },
    onError: (e: any) => {
      setNotifyResult(null);
      setNotifyError(e?.message || "Failed to notify");
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-medical-success text-medical-success-foreground";
      case "missed": return "bg-medical-critical text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle2 className="h-4 w-4" />;
      case "missed": return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Medications</h1>
        <p className="text-muted-foreground">
          Manage and track your medication schedule
        </p>
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">Loading medications...</div>}
      {error && <div className="text-sm text-red-600">{String((error as Error).message)}</div>}
      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>Notify your care circle and add medications quickly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Notify care circle */}
          <div className="flex items-center gap-3">
            <Button onClick={() => notifyCare.mutate()} disabled={notifyCare.isPending}>
              <Send className="h-4 w-4 mr-2" />
              {notifyCare.isPending ? "Notifying..." : "Notify Care Circle (Next 2 hrs)"}
            </Button>
            {notifyResult && <div className="text-sm text-medical-success">{notifyResult}</div>}
            {notifyError && <div className="text-sm text-red-600">{notifyError}</div>}
          </div>

          {/* Update phone number */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <div className="text-sm text-muted-foreground">Your phone number</div>
            <Input placeholder="+14155551212" value={phone || initialPhone} onChange={(e) => setPhone(e.target.value)} />
            <Button variant="outline" disabled={savePhone.isPending} onClick={() => savePhone.mutate((phone || initialPhone).trim())}>
              {savePhone.isPending ? "Saving..." : "Save Phone"}
            </Button>
          </div>

          {/* Add medication */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            <Input placeholder="Name" value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} />
            <Input placeholder="Dosage (e.g., 500mg)" value={newMed.dosage} onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })} />
            <Input placeholder="Times (HH:MM, comma separated)" value={newMed.times} onChange={(e) => setNewMed({ ...newMed, times: e.target.value })} />
            <div className="text-xs text-muted-foreground md:col-span-2">Example: 08:00, 20:00</div>
            <div className="md:col-span-5">
              <Button
                variant="outline"
                disabled={addMedication.isPending || !newMed.name.trim()}
                onClick={() => addMedication.mutate({
                  name: newMed.name.trim(),
                  dosage: newMed.dosage.trim(),
                  reminderTimes: newMed.times.split(',').map(t => t.trim()).filter(Boolean),
                })}
              >
                {addMedication.isPending ? "Adding..." : "Add Medication"}
              </Button>
              {addMedication.error && <div className="text-sm text-red-600 mt-2">{String((addMedication.error as Error).message)}</div>}
            </div>
          </div>

          {/* Custom notifier (select member, enter phone + multi meds) */}
          <div className="space-y-3 pt-2 border-t">
            <div className="text-sm font-medium">Custom SMS (testing)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <select value={selectedMemberId} onChange={(e) => { setSelectedMemberId(e.target.value); if (e.target.value) { const m = members.find(mm => String(mm.id) === e.target.value); if (m?.phone) { setPhone(m.phone); setMemberPhone(m.phone); } } }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select Care Circle Member</option>
                {members.map(m => (
                  <option key={m.id} value={String(m.id)}>{m.name || m.email || m.id}</option>
                ))}
              </select>
              <Input placeholder="Recipient phone (+14155551212)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <div />
            </div>
            {customMeds.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                <Input placeholder="Med name" value={row.name} onChange={(e) => updateCustomRow(idx, 'name', e.target.value)} />
                <Input placeholder="Dosage" value={row.dosage} onChange={(e) => updateCustomRow(idx, 'dosage', e.target.value)} />
                <Input placeholder="Time (HH:MM)" value={row.time} onChange={(e) => updateCustomRow(idx, 'time', e.target.value)} />
                <div className="md:col-span-3 flex gap-2">
                  <Button variant="outline" onClick={addCustomRow}>Add another</Button>
                  {customMeds.length > 1 && <Button variant="outline" onClick={() => removeCustomRow(idx)}>Remove</Button>}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Button disabled={sendCustom.isPending || !phone.trim()} onClick={() => sendCustom.mutate({ phone: phone.trim(), meds: customMeds.filter(m => m.name.trim()) })}>
                {sendCustom.isPending ? "Sending..." : "Send Now"}
              </Button>
              <Button variant="outline" disabled={autoStart.isPending || !phone.trim()} onClick={() => autoStart.mutate({ phone: phone.trim(), meds: customMeds.filter(m => m.name.trim()) })}>
                {autoStart.isPending ? "Starting..." : "Start Auto (2 min)"}
              </Button>
              <Button variant="outline" disabled={autoStop.isPending} onClick={() => autoStop.mutate()}>
                {autoStop.isPending ? "Stopping..." : "Stop Auto"}
              </Button>
            </div>

            {/* Add medication for selected member */}
            <div className="pt-4 border-t space-y-3">
              <div className="text-sm font-medium">Add Medication for Selected Member</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <select value={selectedMemberId} onChange={(e) => { setSelectedMemberId(e.target.value); const m = members.find(mm => String(mm.id) === e.target.value); setMemberPhone(m?.phone || ""); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select Care Circle Member</option>
                  {members.map(m => (
                    <option key={m.id} value={String(m.id)}>{m.name || m.email || m.id}</option>
                  ))}
                </select>
                <div className="text-xs text-muted-foreground md:col-span-2">Choose a member to add this medication for</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <Input placeholder="Phone to notify (+14155551212)" value={memberPhone} onChange={(e) => setMemberPhone(e.target.value)} />
                <div className="text-xs text-muted-foreground md:col-span-2">Optional: send an SMS right after adding</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                <Input placeholder="Name" value={memberMed.name} onChange={(e) => setMemberMed({ ...memberMed, name: e.target.value })} />
                <Input placeholder="Dosage (e.g., 500mg)" value={memberMed.dosage} onChange={(e) => setMemberMed({ ...memberMed, dosage: e.target.value })} />
                <Input placeholder="Frequency (e.g., Twice daily)" value={memberMed.frequency} onChange={(e) => setMemberMed({ ...memberMed, frequency: e.target.value })} />
                <Input placeholder="Instructions (e.g., With meals)" value={memberMed.instructions} onChange={(e) => setMemberMed({ ...memberMed, instructions: e.target.value })} />
                <Input placeholder="Category" value={memberMed.category} onChange={(e) => setMemberMed({ ...memberMed, category: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <Input placeholder="Times (HH:MM, comma separated)" value={memberMed.times} onChange={(e) => setMemberMed({ ...memberMed, times: e.target.value })} />
                <div className="text-xs text-muted-foreground md:col-span-2">Example: 08:00, 20:00</div>
              </div>
              <div>
                <Button
                  variant="default"
                  disabled={addMedicationForMember.isPending || !selectedMemberId || !memberMed.name.trim()}
                  onClick={() => addMedicationForMember.mutate({
                    userId: selectedMemberId,
                    name: memberMed.name.trim(),
                    dosage: memberMed.dosage.trim(),
                    frequency: memberMed.frequency.trim(),
                    instructions: memberMed.instructions.trim(),
                    category: memberMed.category.trim(),
                    reminderTimes: memberMed.times.split(',').map(t => t.trim()).filter(Boolean),
                  })}
                >
                  {addMedicationForMember.isPending ? "Adding..." : "Add For Member"}
                </Button>
                <Button
                  className="ml-2"
                  variant="outline"
                  disabled={sendCustom.isPending || !memberPhone.trim() || !memberMed.name.trim()}
                  onClick={() => {
                    const times = memberMed.times.split(',').map(t => t.trim()).filter(Boolean);
                    sendCustom.mutate({ phone: memberPhone.trim(), meds: [{ name: memberMed.name.trim(), dosage: memberMed.dosage.trim(), time: times[0] || undefined }] });
                  }}
                >
                  {sendCustom.isPending ? "Sending..." : "Send Now to Number"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected member medications list */}
      {selectedMemberId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Medications for {selectedMember?.name || selectedMember?.email || selectedMemberId}</CardTitle>
            <CardDescription>Viewing medications associated with the selected care circle member</CardDescription>
          </CardHeader>
          <CardContent>
            {memberMeds.length === 0 && <div className="text-sm text-muted-foreground">No medications yet.</div>}
            <div className="grid gap-4">
              {memberMeds.map((medication: any) => (
                <Card key={medication.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Pill className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{medication.name}</CardTitle>
                          <CardDescription>{medication.frequency || ""}</CardDescription>
                        </div>
                      </div>
                      <Badge className={medication.is_active ? "bg-medical-success text-medical-success-foreground" : "bg-muted text-muted-foreground"}>
                        {medication.is_active ? "active" : "inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {editId !== medication.id ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Dosage</p>
                            <p className="font-medium">{medication.dosage || "--"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Times</p>
                            <p className="font-medium">{(medication.reminder_times || []).join(", ") || "--"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Instructions</p>
                            <p className="font-medium">{medication.instructions || "--"}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => { setEditId(medication.id); setEditForm({
                            name: medication.name || "",
                            dosage: medication.dosage || "",
                            frequency: medication.frequency || "",
                            instructions: medication.instructions || "",
                            category: medication.category || "",
                            reminderTimes: (medication.reminder_times || []).join(", ")
                          }); }}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            if (confirm('Delete this medication?')) deleteMedication.mutate(medication.id);
                          }}>Delete</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-sm">
                          <Input placeholder="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                          <Input placeholder="Dosage" value={editForm.dosage} onChange={(e) => setEditForm({ ...editForm, dosage: e.target.value })} />
                          <Input placeholder="Frequency" value={editForm.frequency} onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })} />
                          <Input placeholder="Instructions" value={editForm.instructions} onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })} />
                          <Input placeholder="Category" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center mt-3">
                          <Input placeholder="Times (HH:MM, comma separated)" value={editForm.reminderTimes} onChange={(e) => setEditForm({ ...editForm, reminderTimes: e.target.value })} />
                          <div className="text-xs text-muted-foreground md:col-span-2">Example: 08:00, 20:00</div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" onClick={() => {
                            const updates: any = {
                              name: editForm.name?.trim(),
                              dosage: editForm.dosage?.trim(),
                              frequency: editForm.frequency?.trim(),
                              instructions: editForm.instructions?.trim(),
                              category: editForm.category?.trim(),
                              reminderTimes: String(editForm.reminderTimes || "").split(',').map((t: string) => t.trim()).filter(Boolean),
                            };
                            updateMedication.mutate({ id: medication.id, updates });
                            setEditId(null);
                          }}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {medications.map((medication: any) => (
          <Card key={medication.id} className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Pill className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{medication.name}</CardTitle>
                    <CardDescription>{medication.frequency || ""}</CardDescription>
                  </div>
                </div>
                <Badge className={getStatusColor(medication.is_active ? "active" : "inactive")}>
                  {getStatusIcon(medication.is_active ? "active" : "inactive")}
                  <span className="ml-1 capitalize">{medication.is_active ? "active" : "inactive"}</span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Time to take</p>
                  <p className="font-medium">{(medication.reminder_times || []).join(", ") || "--"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next dose</p>
                  <p className="font-medium">--</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Remaining doses</p>
                  <p className="font-medium">{medication.refills_remaining ?? "--"}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm">Mark as Taken</Button>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}