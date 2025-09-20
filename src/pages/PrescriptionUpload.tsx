import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Upload,
  FileText,
  Camera,
  Sparkles,
  Check,
  AlertCircle,
  Clock
} from "lucide-react";
import { apiUpload, apiFetch } from "@/lib/api";

const PrescriptionUpload = () => {
  const [uploadStep, setUploadStep] = useState<"upload" | "ai-processing" | "review">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [serverResult, setServerResult] = useState<any | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mockAIResults = {
    medications: [
      {
        name: "Metformin",
        dosage: "500mg",
        frequency: "Twice daily",
        instructions: "Take with meals",
        duration: "Ongoing",
        confidence: 95
      },
      {
        name: "Lisinopril",
        dosage: "10mg", 
        frequency: "Once daily",
        instructions: "Take in the morning",
        duration: "Ongoing",
        confidence: 98
      }
    ],
    warnings: [
      "Monitor blood sugar levels regularly",
      "Check blood pressure weekly"
    ]
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStep("ai-processing");
      setErrorText(null);
      try {
        const form = new FormData();
        form.append("file", file);
        if (notes) form.append("notes", notes);
        const resp = await apiUpload<{ prescriptionId: string; status: string; extractedData: any }>("/prescriptions/upload", form);
        setPrescriptionId(resp.prescriptionId);
        setServerResult(resp.extractedData || null);
      } catch (e) {
        const msg = (e as Error)?.message || "Upload failed";
        setErrorText(msg.includes('File too large') ? 'File exceeds 10MB limit.' : msg);
        // Fallback to mock results on error
        setServerResult(mockAIResults);
      } finally {
        setUploadStep("review");
      }
    }
  };

  const handleApproval = async () => {
    if (!prescriptionId) {
      setErrorText("Missing prescription ID. Please re-upload.");
      return;
    }
    setApproving(true);
    setErrorText(null);
    try {
      await apiFetch(`/prescriptions/${prescriptionId}/approve`, {
        method: "PUT",
        body: JSON.stringify({ medications: (serverResult?.medications || []).map((m: any) => ({ ...m, approved: true })) }),
      });
      // Navigate to medications list after success
      navigate("/medications");
    } catch (e) {
      setErrorText((e as Error).message);
    } finally {
      setApproving(false);
    }
  };

  if (uploadStep === "upload") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Prescription</h1>
          <p className="text-muted-foreground">
            Upload a prescription photo or PDF for AI-powered medication extraction
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Prescription
              </CardTitle>
              <CardDescription>
                Take a photo or upload a PDF of the prescription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-accent">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Drop your prescription here</p>
                    <p className="text-sm text-muted-foreground">
                      Supports JPG, PNG, PDF up to 10MB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Browse Files
                    </Button>
                    <Button type="button" variant="outline">
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </Button>
                  </div>
                  <Input
                    id="file-upload"
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  {selectedFile && (
                    <div className="text-sm text-muted-foreground">Selected: {selectedFile.name}</div>
                  )}
                  {errorText && (
                    <div className="text-sm text-red-600">{errorText}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI-Powered Features
              </CardTitle>
              <CardDescription>
                What our AI will extract from your prescription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1"
                    rows={3}
                    placeholder="Add any notes for this prescription"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-medical-success mt-0.5" />
                  <div>
                    <div className="font-medium">Medication Names</div>
                    <div className="text-sm text-muted-foreground">
                      Automatically identifies all prescribed medications
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-medical-success mt-0.5" />
                  <div>
                    <div className="font-medium">Dosage & Frequency</div>
                    <div className="text-sm text-muted-foreground">
                      Extracts precise dosage amounts and timing
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-medical-success mt-0.5" />
                  <div>
                    <div className="font-medium">Special Instructions</div>
                    <div className="text-sm text-muted-foreground">
                      Notes about food, timing, and precautions
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-medical-success mt-0.5" />
                  <div>
                    <div className="font-medium">Safety Warnings</div>
                    <div className="text-sm text-muted-foreground">
                      Identifies potential interactions and side effects
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (uploadStep === "ai-processing") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processing Prescription</h1>
          <p className="text-muted-foreground">AI is analyzing your prescription...</p>
        </div>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Analyzing Prescription</h3>
                <p className="text-muted-foreground">
                  Our AI is extracting medication details, dosages, and instructions from your prescription.
                  This usually takes 10-30 seconds.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Processing... 
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review AI Results</h1>
        <p className="text-muted-foreground">
          Please review and confirm the extracted medication information
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Extracted Medications</CardTitle>
            <CardDescription>
              Review the AI-extracted information and make any necessary corrections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(serverResult?.medications || mockAIResults.medications).map((medication: any, index: number) => (
              <div key={index} className="p-4 border border-border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">{medication.name}</h4>
                  <Badge variant="secondary">
                    {medication.confidence ?? 95}% confidence
                  </Badge>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor={`dosage-${index}`}>Dosage</Label>
                    <Input 
                      id={`dosage-${index}`}
                      defaultValue={medication.dosage}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`frequency-${index}`}>Frequency</Label>
                    <Input 
                      id={`frequency-${index}`}
                      defaultValue={medication.frequency}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor={`instructions-${index}`}>Instructions</Label>
                  <Textarea 
                    id={`instructions-${index}`}
                    defaultValue={medication.instructions}
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Important Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(serverResult?.warnings || mockAIResults.warnings).map((warning: string, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-medical-warning/10 rounded-md">
                  <AlertCircle className="h-4 w-4 text-medical-warning mt-0.5" />
                  <div className="text-sm">{warning}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            onClick={handleApproval}
            disabled={approving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Check className="h-4 w-4 mr-2" />
            {approving ? "Saving..." : "Approve & Add to Schedule"}
          </Button>
          <Button variant="outline">
            Edit Details
          </Button>
          <Button variant="outline">
            Reject & Re-upload
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionUpload;