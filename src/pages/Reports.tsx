import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, Share2 } from "lucide-react";

export default function Reports() {
  const reports = [
    {
      id: 1,
      title: "Monthly Adherence Report",
      description: "Comprehensive medication adherence summary for December 2024",
      date: "Dec 31, 2024",
      type: "Adherence",
      status: "Ready",
      size: "2.3 MB"
    },
    {
      id: 2,
      title: "Side Effects Report",
      description: "Documented side effects and reactions for the past month",
      date: "Dec 31, 2024",
      type: "Side Effects",
      status: "Ready",
      size: "1.1 MB"
    },
    {
      id: 3,
      title: "Care Circle Activity",
      description: "Summary of caregiver interactions and notifications",
      date: "Dec 30, 2024",
      type: "Care Circle",
      status: "Generating",
      size: "0.8 MB"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ready": return "bg-medical-success text-white";
      case "Generating": return "bg-medical-warning text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Adherence": return "bg-primary text-primary-foreground";
      case "Side Effects": return "bg-medical-critical text-white";
      case "Care Circle": return "bg-secondary text-secondary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and download detailed medication reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate New Report
          </CardTitle>
          <CardDescription>
            Create custom reports for specific time periods and data types
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option>Adherence Report</option>
              <option>Side Effects Report</option>
              <option>Care Circle Activity</option>
              <option>Comprehensive Report</option>
            </select>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 3 months</option>
              <option>Custom range</option>
            </select>
            <Button className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Available Reports</h2>
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                    <CardDescription>{report.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getTypeColor(report.type)}>
                    {report.type}
                  </Badge>
                  <Badge className={getStatusColor(report.status)}>
                    {report.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{report.date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Size: </span>
                  <span className="font-medium">{report.size}</span>
                </div>
                <div className="flex gap-2">
                  {report.status === "Ready" && (
                    <>
                      <Button size="sm" className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" className="flex items-center gap-1">
                        <Share2 className="h-3 w-3" />
                        Share
                      </Button>
                    </>
                  )}
                  {report.status === "Generating" && (
                    <Button size="sm" disabled>
                      Generating...
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}