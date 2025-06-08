import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Submission, Log, User } from "@shared/schema";
import { useState, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PieChart, BarChart, AlertCircle, Users, Camera, Clipboard, Share2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import TestCaseCreator, { TestCase } from "@/components/TestCaseCreator";
import { useToast } from "@/hooks/use-toast";

interface SubmissionWithUser extends Submission {
  user?: User;
}

interface SubmissionGrade {
  submissionId: number;
  score: number;
  feedback: string;
}

interface StudentGrade {
  id: number;
  submissionId: number;
  userId: number;
  subject: string;
  score: number;
  feedback: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [logTypeFilter, setLogTypeFilter] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithUser | null>(null);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [userEmailSearch, setUserEmailSearch] = useState("");
  const [gradeScore, setGradeScore] = useState("90");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [selectedTestSubject, setSelectedTestSubject] = useState("javascript");
  const [isSavingTestCases, setIsSavingTestCases] = useState(false);
  const [showTestCaseModal, setShowTestCaseModal] = useState(false);
  const [initialTestCases, setInitialTestCases] = useState<TestCase[]>([]);
  
  const studentEmailRef = useRef<HTMLInputElement>(null);
  
  // Fetch submissions
  const { data: submissions = [], isLoading: isLoadingSubmissions } = useQuery<SubmissionWithUser[]>({
    queryKey: ["/api/submissions"],
  });
  
  // Fetch logs
  const { data: logs = [], isLoading: isLoadingLogs } = useQuery<Log[]>({
    queryKey: ["/api/logs"],
  });
  
  // Fetch student grades (when email is provided)
  const { data: studentGrades = [], isLoading: isLoadingStudentGrades } = useQuery<StudentGrade[]>({
    queryKey: ["/api/admin/grades", userEmailSearch],
    enabled: userEmailSearch !== "",
  });
  
  // Submit grade mutation
  const gradeMutation = useMutation({
    mutationFn: async (data: SubmissionGrade) => {
      const res = await apiRequest("POST", "/api/admin/grade", data);
      return await res.json();
    },
    onSuccess: () => {
      // Close the dialog and refresh data
      setSelectedSubmission(null);
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grades"] });
      
      toast({
        title: "Grade submitted successfully",
        description: "The student will be able to see this grade in their dashboard",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit grade",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Filter submissions by subject
  const filteredSubmissions = subjectFilter === "all" 
    ? submissions 
    : submissions.filter(submission => submission.subject === subjectFilter);
  
  // Filter logs by type
  const filteredLogs = logTypeFilter === "all"
    ? logs
    : logs.filter(log => log.type === logTypeFilter);
  
  // Format time distance
  const formatTime = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };
  
  // Handle grade submission
  const handleSubmitGrade = () => {
    if (!selectedSubmission) return;
    
    gradeMutation.mutate({
      submissionId: selectedSubmission.id,
      score: parseInt(gradeScore),
      feedback: gradeFeedback
    });
  };
  
  // Handle search for student grades
  const handleStudentGradeSearch = () => {
    if (studentEmailRef.current && studentEmailRef.current.value) {
      setUserEmailSearch(studentEmailRef.current.value);
    }
  };
  
  // Get statistics
  const totalSubmissions = submissions.length;
  const totalLogs = logs.length;
  // Fixed the Set iteration issue
  const uniqueStudentIds = Array.from(new Set(submissions.map(s => s.userId)));
  const uniqueStudents = uniqueStudentIds.length;
  const tabSwitchLogs = logs.filter(log => log.type === 'tab-switch').length;
  const screenshotLogs = logs.filter(log => log.type === 'screenshot').length;
  const screenShareLogs = logs.filter(log => log.type === 'screen-share').length;
  
  // Get score badge color
  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-800";
    if (score >= 70) return "bg-[#C9B88C] text-[#0F172A]";
    if (score >= 50) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  // Get grade letter
  const getGradeLetter = (score: number) => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-[#F9F8F6]">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-serif font-medium text-[#1F2937]">Administrator Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-[#1F2937]">{user?.email}</span>
              <Button 
                variant="outline" 
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="text-sm text-[#1F2937] hover:bg-[#F9F8F6] border-[#E5E7EB] rounded-lg"
              >
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Admin content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Dashboard overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-4">
                    <PieChart className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#1F2937] opacity-70">Total Submissions</p>
                    <h3 className="text-2xl font-bold text-[#1F2937]">{totalSubmissions}</h3>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-4">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#1F2937] opacity-70">Unique Students</p>
                    <h3 className="text-2xl font-bold text-[#1F2937]">{uniqueStudents}</h3>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 mr-4">
                    <BarChart className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#1F2937] opacity-70">Total Logs</p>
                    <h3 className="text-2xl font-bold text-[#1F2937]">{totalLogs}</h3>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mr-4">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#1F2937] opacity-70">Tab Switches</p>
                    <h3 className="text-2xl font-bold text-[#1F2937]">{tabSwitchLogs}</h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="submissions" className="space-y-6">
            <TabsList className="bg-white border border-[#E5E7EB] p-1 rounded-xl">
              <TabsTrigger 
                value="submissions" 
                className="rounded-lg px-4 py-2 data-[state=active]:bg-[#0F172A] data-[state=active]:text-white"
              >
                Code Submissions
              </TabsTrigger>
              <TabsTrigger 
                value="grades" 
                className="rounded-lg px-4 py-2 data-[state=active]:bg-[#0F172A] data-[state=active]:text-white"
              >
                Student Grades
              </TabsTrigger>
              <TabsTrigger 
                value="monitoring" 
                className="rounded-lg px-4 py-2 data-[state=active]:bg-[#0F172A] data-[state=active]:text-white"
              >
                Live Monitoring
              </TabsTrigger>
              <TabsTrigger 
                value="test-cases" 
                className="rounded-lg px-4 py-2 data-[state=active]:bg-[#0F172A] data-[state=active]:text-white"
              >
                Test Cases
              </TabsTrigger>
              <TabsTrigger 
                value="logs" 
                className="rounded-lg px-4 py-2 data-[state=active]:bg-[#0F172A] data-[state=active]:text-white"
              >
                Event Logs
              </TabsTrigger>
              <TabsTrigger 
                value="debug" 
                className="rounded-lg px-4 py-2 data-[state=active]:bg-[#0F172A] data-[state=active]:text-white"
              >
                Screenshot Debug
              </TabsTrigger>
            </TabsList>
            
            {/* Test Cases Tab */}
            <TabsContent value="test-cases">
              <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
                <CardHeader className="border-b border-[#E5E7EB] flex flex-row justify-between items-center">
                  <CardTitle className="text-xl font-serif text-[#1F2937]">Create & Manage Test Cases</CardTitle>
                  <div>
                    <Select value={selectedTestSubject} onValueChange={setSelectedTestSubject}>
                      <SelectTrigger className="w-[180px] border-[#E5E7EB] rounded-lg">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="java">Java</SelectItem>
                        <SelectItem value="cpp">C++</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="mb-6">
                    <p className="text-[#1F2937] mb-4">
                      Create and edit test cases for the {selectedTestSubject.charAt(0).toUpperCase() + selectedTestSubject.slice(1)} challenge. 
                      These test cases will be used to evaluate student submissions automatically.
                    </p>
                    
                    <Button 
                      onClick={() => {
                        // Fetch the current test cases for this subject
                        fetch(`/api/admin/test-cases/${selectedTestSubject}`)
                          .then(res => res.json())
                          .then(data => {
                            setInitialTestCases(data);
                            setShowTestCaseModal(true);
                          })
                          .catch(err => {
                            toast({
                              title: "Error loading test cases",
                              description: err.message,
                              variant: "destructive"
                            });
                          });
                      }}
                      className="bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-lg"
                    >
                      Edit Test Cases
                    </Button>
                    
                    {/* Test Case Creator Dialog */}
                    <Dialog open={showTestCaseModal} onOpenChange={setShowTestCaseModal}>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-serif text-[#1F2937]">
                            Test Case Editor - {selectedTestSubject.charAt(0).toUpperCase() + selectedTestSubject.slice(1)}
                          </DialogTitle>
                        </DialogHeader>
                        <TestCaseCreator 
                          subject={selectedTestSubject}
                          initialTestCases={initialTestCases}
                          isSaving={isSavingTestCases}
                          onSave={(testCases) => {
                            setIsSavingTestCases(true);
                            // Save test cases to API
                            fetch(`/api/admin/test-cases/${selectedTestSubject}`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({ testCases }),
                            })
                              .then(response => response.json())
                              .then(data => {
                                if (data.success) {
                                  toast({
                                    title: "Test cases saved",
                                    description: `Saved ${testCases.length} test cases for ${selectedTestSubject}`,
                                  });
                                  setShowTestCaseModal(false);
                                } else {
                                  throw new Error('Failed to save test cases');
                                }
                              })
                              .catch(error => {
                                toast({
                                  title: "Error saving test cases",
                                  description: error.message,
                                  variant: "destructive"
                                });
                              })
                              .finally(() => {
                                setIsSavingTestCases(false);
                              });
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-[#1F2937] mb-2">Current Challenge</h3>
                    <div className="p-4 border border-[#E5E7EB] rounded-lg bg-[#F9F8F6]">
                      <h4 className="font-medium text-[#1F2937]">Prime Number Challenge</h4>
                      <p className="text-sm text-[#1F2937] mt-1">
                        Create a function that checks if a number is prime. The function should return true if the number is prime and false otherwise.
                      </p>
                      <div className="mt-3 p-3 bg-white rounded border border-[#E5E7EB]">
                        <pre className="text-xs font-mono">
                          {`// Example in JavaScript:
function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  
  let i = 5;
  while (i * i <= num) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
    i += 6;
  }
  return true;
}`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Monitoring tab */}
            <TabsContent value="monitoring">
              <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
                <CardHeader className="border-b border-[#E5E7EB]">
                  <CardTitle className="text-xl font-serif text-[#1F2937]">Student Activity Monitoring</CardTitle>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Tab Switch Activity */}
                    <Card className="bg-[#F9F8F6] shadow-sm rounded-2xl border-[#E5E7EB]">
                      <CardContent className="p-6">
                        <div className="flex items-center">
                          <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mr-4">
                            <Clipboard className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm text-[#1F2937] opacity-70">Tab Switches</p>
                            <h3 className="text-2xl font-bold text-[#1F2937]">{tabSwitchLogs}</h3>
                          </div>
                        </div>
                        <p className="mt-4 text-sm text-[#1F2937]">
                          Detects when students switch tabs or applications during an assessment. 
                          This may indicate attempts to search for solutions online.
                        </p>
                      </CardContent>
                    </Card>
                    
                    {/* Screenshot Activity */}
                    <Card className="bg-[#F9F8F6] shadow-sm rounded-2xl border-[#E5E7EB]">
                      <CardContent className="p-6">
                        <div className="flex items-center">
                          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-4">
                            <Camera className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm text-[#1F2937] opacity-70">Screenshots</p>
                            <h3 className="text-2xl font-bold text-[#1F2937]">{screenshotLogs}</h3>
                          </div>
                        </div>
                        <p className="mt-4 text-sm text-[#1F2937]">
                          Periodic screen captures stored in memory as base64 data. These show student 
                          activities and can be viewed in the logs section.
                        </p>
                      </CardContent>
                    </Card>
                    
                    {/* Screen Share Activity */}
                    <Card className="bg-[#F9F8F6] shadow-sm rounded-2xl border-[#E5E7EB]">
                      <CardContent className="p-6">
                        <div className="flex items-center">
                          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-4">
                            <Share2 className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm text-[#1F2937] opacity-70">Screen Shares</p>
                            <h3 className="text-2xl font-bold text-[#1F2937]">{screenShareLogs}</h3>
                          </div>
                        </div>
                        <p className="mt-4 text-sm text-[#1F2937]">
                          Screen sharing implementation via HTML2Canvas (not WebRTC). Images are 
                          stored as base64 data in logs.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-[#1F2937] mb-4">Recent Student Activities</h3>
                    
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F9F8F6]">
                          <TableHead className="text-[#1F2937]">Type</TableHead>
                          <TableHead className="text-[#1F2937]">Student</TableHead>
                          <TableHead className="text-[#1F2937]">Time</TableHead>
                          <TableHead className="text-[#1F2937]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.slice(0, 10).map((log) => (
                          <TableRow key={log.id} className="border-b border-[#E5E7EB]">
                            <TableCell>
                              <Badge className={`
                                ${log.type === 'tab-switch' ? 'bg-orange-100 text-orange-800' : ''}
                                ${log.type === 'screenshot' ? 'bg-blue-100 text-blue-800' : ''}
                                ${log.type === 'screen-share' ? 'bg-green-100 text-green-800' : ''}
                              `}>
                                {log.type}
                              </Badge>
                            </TableCell>
                            <TableCell>Student {log.userId}</TableCell>
                            <TableCell>{new Date(log.timestamp).toLocaleTimeString()}</TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {/* Log detail dialog */}
                    <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-serif text-[#1F2937]">
                            Activity Details - {selectedLog?.type}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium text-[#1F2937]">Student ID</h4>
                            <p className="text-[#1F2937]">{selectedLog?.userId}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-[#1F2937]">Timestamp</h4>
                            <p className="text-[#1F2937]">
                              {selectedLog?.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : ''}
                            </p>
                          </div>
                          {selectedLog?.type === 'screenshot' || selectedLog?.type === 'screen-share' ? (
                            <div>
                              <h4 className="font-medium text-[#1F2937]">Captured Image</h4>
                              <div className="p-4">
                                {(() => {
                                  try {
                                    const parsedData = JSON.parse(selectedLog.data);
                                    
                                    // Check if this is Puppeteer metadata (no actual image data)
                                    if (parsedData.method === 'puppeteer-server-side' || parsedData.captureMethod === 'puppeteer-server-side') {
                                      // This is Puppeteer metadata, display the actual screenshot
                                      return (
                                        <div className="text-center p-6 bg-blue-50 border border-blue-200 rounded-lg">
                                          <div className="text-blue-600 mb-4">
                                            <div className="text-4xl mb-2">🚀</div>
                                            <div className="text-lg font-medium">Puppeteer Screenshot Captured</div>
                                          </div>
                                          <p className="text-sm text-gray-600 mb-4">
                                            This screenshot was captured server-side using Puppeteer and saved as a file.
                                          </p>
                                          
                                          {/* Display the actual screenshot image if filename is available */}
                                          {parsedData.filename && (
                                            <div className="mb-4">
                                              <img 
                                                src={`/api/screenshots/${parsedData.filename}`}
                                                alt="Puppeteer Screenshot"
                                                className="w-full max-w-2xl mx-auto rounded-lg border shadow-md"
                                                style={{ maxHeight: '400px', objectFit: 'contain' }}
                                                onLoad={() => {
                                                  console.log(`✅ Puppeteer screenshot loaded: ${parsedData.filename}`);
                                                }}
                                                onError={(e) => {
                                                  console.error(`❌ Failed to load Puppeteer screenshot: ${parsedData.filename}`);
                                                  e.currentTarget.style.display = 'none';
                                                  // Show fallback message
                                                  const fallback = document.createElement('div');
                                                  fallback.className = 'text-center p-4 bg-yellow-50 border border-yellow-200 rounded';
                                                  fallback.innerHTML = `
                                                    <div class="text-yellow-600 mb-2">⚠️ Screenshot File Not Found</div>
                                                    <p class="text-sm text-gray-600">The screenshot file "${parsedData.filename}" could not be loaded.</p>
                                                    <p class="text-xs text-gray-500 mt-1">It may have been moved or deleted from the screenshots directory.</p>
                                                  `;
                                                  e.currentTarget.parentNode?.appendChild(fallback);
                                                }}
                                              />
                                            </div>
                                          )}
                                          
                                          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 mb-4">
                                            <div><strong>Method:</strong> {parsedData.method}</div>
                                            <div><strong>Container URL:</strong> {parsedData.containerUrl?.split('/').pop() || 'N/A'}</div>
                                            <div><strong>Subject:</strong> {parsedData.subject || 'N/A'}</div>
                                            <div><strong>Event:</strong> {parsedData.captureEvent || 'N/A'}</div>
                                            {parsedData.filename && (
                                              <div className="col-span-2"><strong>Filename:</strong> <span className="font-mono">{parsedData.filename}</span></div>
                                            )}
                                            {parsedData.imageSize && (
                                              <div><strong>File Size:</strong> {parsedData.imageSize}KB</div>
                                            )}
                                            {parsedData.timestamp && (
                                              <div><strong>Captured:</strong> {new Date(parsedData.timestamp).toLocaleTimeString()}</div>
                                            )}
                                          </div>
                                          
                                          {!parsedData.filename && (
                                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                              <strong>💡 Note:</strong> No filename found in metadata. The screenshot file may not be available.
                                            </div>
                                          )}
                                          
                                          <div className="mt-4">
                                            <div className="mb-3">
                                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                parsedData.captureType === 'desktop' 
                                                  ? 'bg-purple-100 text-purple-800' 
                                                  : 'bg-blue-100 text-blue-800'
                                              }`}>
                                                {parsedData.captureType === 'desktop' ? '🖥️ Desktop Screen' : '📸 Browser Capture'}
                                              </span>
                                            </div>
                                            <details>
                                              <summary className="cursor-pointer text-sm font-medium text-blue-600">
                                                🔧 Technical Details
                                              </summary>
                                              <pre className="mt-2 p-3 bg-white border rounded text-xs text-left overflow-auto max-h-32">
                                                {JSON.stringify(parsedData, null, 2)}
                                              </pre>
                                            </details>
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    // Handle legacy client-side screenshots with actual image data
                                    const imageData = parsedData.image || parsedData;
                                    const metadata = parsedData.metadata;
                                    
                                    // Get the exact capture timestamp from metadata
                                    const exactCaptureTime = metadata?.timestamp 
                                      ? new Date(metadata.timestamp).toLocaleString('en-US', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                          hour12: true
                                        })
                                      : 'Unknown time';
                                    
                                    // Validate image data
                                    const isValidImage = imageData && typeof imageData === 'string' && imageData.length > 0;
                                    const hasValidPrefix = isValidImage && imageData.startsWith('data:image/');
                                    
                                    if (!isValidImage) {
                                      return (
                                        <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                                          <div className="text-red-600 mb-2">❌ Invalid Screenshot Data</div>
                                          <p className="text-sm text-gray-600">Image data is missing or corrupted</p>
                                          <p className="text-xs text-gray-500 mt-1">Captured: {exactCaptureTime}</p>
                                        </div>
                                      );
                                    }
                                    
                                    // Add data URI prefix if missing (for old screenshots)  
                                    const correctedImageData = hasValidPrefix 
                                      ? imageData 
                                      : `data:image/jpeg;base64,${imageData}`;
                                    
                                    // Clean image data if needed
                                    let finalImageData = correctedImageData;
                                    const hasEscapeChars = correctedImageData.includes('\\"') || correctedImageData.includes('\\n');
                                    const hasExtraQuotes = correctedImageData.startsWith('"') && correctedImageData.endsWith('"');
                                    
                                    if (hasExtraQuotes) {
                                      finalImageData = correctedImageData.slice(1, -1);
                                    }
                                    if (hasEscapeChars) {
                                      finalImageData = finalImageData.replace(/\\"/g, '"').replace(/\\n/g, '');
                                    }
                                    
                                    return (
                                      <div>
                                        {/* Image Rendering */}
                                        {finalImageData?.startsWith("data:image") ? (
                                          <img 
                                            src={finalImageData} 
                                            alt="Screenshot" 
                                            className="w-full rounded-lg border border-[#E5E7EB]"
                                            onError={(e) => {
                                              console.error('Screenshot failed to load');
                                              e.currentTarget.style.display = 'none';
                                              // Show fallback error message
                                              const fallback = document.createElement('div');
                                              fallback.className = 'text-center p-4 bg-red-50 border border-red-200 rounded-lg';
                                              fallback.innerHTML = `
                                                <div class="text-red-600 mb-2">❌ Screenshot Failed to Load</div>
                                                <p class="text-sm text-gray-600">Invalid image format or corrupted data</p>
                                                <p class="text-xs text-gray-500 mt-1">Captured: ${exactCaptureTime}</p>
                                              `;
                                              e.currentTarget.parentNode?.appendChild(fallback);
                                            }}
                                            onLoad={() => {
                                              console.log('✅ Screenshot loaded successfully');
                                            }}
                                          />
                                        ) : (
                                          <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="text-red-600 mb-2">❌ Invalid Screenshot Data</div>
                                            <p className="text-sm text-gray-600">Image data is missing or corrupted</p>
                                            <p className="text-xs text-gray-500 mt-1">Captured: {exactCaptureTime}</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } catch (error) {
                                    console.error('Error parsing screenshot data:', error);
                                    return (
                                      <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="text-red-600 mb-2">❌ Screenshot Processing Error</div>
                                        <p className="text-sm text-gray-600 mb-2">Failed to load screenshot image. Data format error.</p>
                                        <p className="text-xs text-gray-500">Error: {error?.message || 'Unknown parsing error'}</p>
                                        <details className="mt-3 text-left">
                                          <summary className="cursor-pointer text-xs font-medium">Raw Data Preview</summary>
                                          <pre className="mt-2 p-3 bg-gray-100 text-xs overflow-auto max-h-32 rounded">
                                            {typeof selectedLog.data === 'string' 
                                              ? selectedLog.data.substring(0, 500) + (selectedLog.data.length > 500 ? '...' : '')
                                              : JSON.stringify(selectedLog.data, null, 2)
                                            }
                                          </pre>
                                        </details>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <h4 className="font-medium text-[#1F2937]">Activity Data</h4>
                              <pre className="mt-2 border border-[#E5E7EB] rounded-lg p-3 bg-[#F9F8F6] overflow-auto text-sm">
                                {JSON.stringify(selectedLog, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-[#1F2937] mb-4">Anti-Cheat Implementation Details</h3>
                    <div className="p-4 border border-[#E5E7EB] rounded-lg bg-[#F9F8F6]">
                      <h4 className="font-medium text-[#1F2937]">System Overview</h4>
                      <ul className="mt-2 space-y-2 text-[#1F2937]">
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          <span>Tab detection monitors when students leave the assessment window</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          <span>Copy/paste prevention blocks students from copying external code</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          <span>Screen captures provide visual evidence of student activities</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          <span>Docker simulation provides a secure execution environment (note: not actually using Docker, just simulating it)</span>
                        </li>
                      </ul>
                      <p className="mt-4 text-sm text-[#1F2937]">
                        <strong>Note:</strong> This system does not use WebRTC for screen sharing but instead takes periodic screenshots
                        using HTML2Canvas. These are stored in memory as base64 data and accessible through the logs section.
                        In a production environment, these would be stored in a database or secure file storage.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Submissions tab */}
            <TabsContent value="submissions">
              <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
                <CardHeader className="border-b border-[#E5E7EB] flex flex-row justify-between items-center">
                  <CardTitle className="text-xl font-serif text-[#1F2937]">Student Code Submissions</CardTitle>
                  <div>
                    <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                      <SelectTrigger className="w-[180px] border-[#E5E7EB] rounded-lg">
                        <SelectValue placeholder="Filter by subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="java">Java</SelectItem>
                        <SelectItem value="cpp">C++</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  {isLoadingSubmissions ? (
                    <div className="flex justify-center items-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#C9B88C]" />
                    </div>
                  ) : filteredSubmissions.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-[#1F2937] opacity-60">No submissions found.</p>
                      <p className="text-sm text-[#1F2937] opacity-60 mt-1">Students haven't submitted any code yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredSubmissions.map((submission) => (
                        <Card key={submission.id} className="overflow-hidden border-[#E5E7EB] hover:shadow-md transition-shadow">
                          <CardHeader className={`py-3 px-4 
                            ${submission.subject === 'javascript' ? 'bg-yellow-50' : ''}
                            ${submission.subject === 'python' ? 'bg-blue-50' : ''}
                            ${submission.subject === 'java' ? 'bg-red-50' : ''}
                            ${submission.subject === 'cpp' ? 'bg-purple-50' : ''}
                          `}>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-2">
                                <div className="h-10 w-10 rounded-full bg-[#0F172A] flex items-center justify-center text-white font-medium">
                                  {submission.user?.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <h3 className="text-sm font-medium text-[#1F2937]">
                                    {submission.user?.email || `User ${submission.userId}`}
                                  </h3>
                                  <p className="text-xs text-[#1F2937] opacity-70">
                                    {formatTime(submission.timestamp)}
                                  </p>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase
                                ${submission.subject === 'javascript' ? 'bg-yellow-100 text-yellow-800' : ''}
                                ${submission.subject === 'python' ? 'bg-blue-100 text-blue-800' : ''}
                                ${submission.subject === 'java' ? 'bg-red-100 text-red-800' : ''}
                                ${submission.subject === 'cpp' ? 'bg-purple-100 text-purple-800' : ''}
                              `}>
                                {submission.subject}
                              </span>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="p-4">
                            <div className="text-sm text-[#1F2937] opacity-80 h-20 overflow-hidden relative">
                              <pre className="font-mono text-xs whitespace-pre-wrap">
                                {submission.code.substring(0, 150)}...
                              </pre>
                              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent"></div>
                            </div>
                          </CardContent>
                          
                          <CardFooter className="flex justify-end space-x-3 p-4 border-t border-[#E5E7EB]">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  className="text-[#0F172A] hover:bg-[#F9F8F6] border-[#E5E7EB] rounded-lg text-sm"
                                  onClick={() => {
                                    setSelectedSubmission(submission);
                                    setGradeScore("90");
                                    setGradeFeedback("");
                                  }}
                                >
                                  Review
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl">
                                <DialogHeader>
                                  <DialogTitle className="text-xl font-serif text-[#1F2937]">
                                    Submission Review & Grading
                                  </DialogTitle>
                                </DialogHeader>
                                {selectedSubmission && (
                                  <div className="mt-4 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div>
                                        <h3 className="text-sm font-medium text-[#8C977A]">Student</h3>
                                        <p className="mt-1 text-sm text-[#1F2937]">
                                          {selectedSubmission.user?.email || `User ${selectedSubmission.userId}`}
                                        </p>
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-medium text-[#8C977A]">Subject</h3>
                                        <p className="mt-1 text-sm text-[#1F2937] capitalize">{selectedSubmission.subject}</p>
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-medium text-[#8C977A]">Submitted</h3>
                                        <p className="mt-1 text-sm text-[#1F2937]">{formatTime(selectedSubmission.timestamp)}</p>
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <h3 className="text-sm font-medium text-[#8C977A] mb-2">Code</h3>
                                      <pre className="p-4 bg-[#F9F8F6] rounded-lg text-sm font-mono overflow-auto max-h-80 border border-[#E5E7EB]">
                                        {selectedSubmission.code}
                                      </pre>
                                    </div>
                                    
                                    <div className="border-t border-[#E5E7EB] pt-4">
                                      <h3 className="text-sm font-medium text-[#8C977A] mb-3">Assign Grade</h3>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                          <Label htmlFor="score" className="text-[#1F2937]">Score (%)</Label>
                                          <Select 
                                            value={gradeScore} 
                                            onValueChange={setGradeScore}
                                          >
                                            <SelectTrigger className="mt-1 w-full border-[#E5E7EB] rounded-lg">
                                              <SelectValue placeholder="Select a score" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="100">100% - Perfect</SelectItem>
                                              <SelectItem value="90">90% - Excellent</SelectItem>
                                              <SelectItem value="80">80% - Very Good</SelectItem>
                                              <SelectItem value="70">70% - Good</SelectItem>
                                              <SelectItem value="60">60% - Satisfactory</SelectItem>
                                              <SelectItem value="50">50% - Needs Improvement</SelectItem>
                                              <SelectItem value="40">40% - Poor</SelectItem>
                                              <SelectItem value="30">30% - Very Poor</SelectItem>
                                              <SelectItem value="20">20% - Unsatisfactory</SelectItem>
                                              <SelectItem value="10">10% - Minimal Effort</SelectItem>
                                              <SelectItem value="0">0% - Not Submitted/Plagiarized</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      
                                      <div className="mb-4">
                                        <Label htmlFor="feedback" className="text-[#1F2937]">Feedback</Label>
                                        <Textarea 
                                          id="feedback" 
                                          placeholder="Provide feedback to the student" 
                                          className="mt-1 border-[#E5E7EB] rounded-lg"
                                          rows={4}
                                          value={gradeFeedback}
                                          onChange={(e) => setGradeFeedback(e.target.value)}
                                        />
                                      </div>
                                      
                                      <div className="flex justify-end">
                                        <Button 
                                          onClick={handleSubmitGrade}
                                          disabled={gradeMutation.isPending}
                                          className="bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-lg"
                                        >
                                          {gradeMutation.isPending ? (
                                            <>
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              Saving...
                                            </>
                                          ) : (
                                            "Submit Grade"
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Student Grades Tab */}
            <TabsContent value="grades">
              <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
                <CardHeader className="border-b border-[#E5E7EB]">
                  <CardTitle className="text-xl font-serif text-[#1F2937]">View Student Grades</CardTitle>
                </CardHeader>
                
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="studentEmail" className="text-[#1F2937]">Student Email</Label>
                      <Input 
                        id="studentEmail" 
                        ref={studentEmailRef}
                        placeholder="Enter student email" 
                        className="mt-1 border-[#E5E7EB] rounded-lg"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={handleStudentGradeSearch}
                        className="mb-px bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-lg"
                      >
                        Search
                      </Button>
                    </div>
                  </div>
                  
                  {userEmailSearch && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-[#1F2937] mb-4">Grades for: <span className="text-[#8C977A]">{userEmailSearch}</span></h3>
                      
                      {isLoadingStudentGrades ? (
                        <div className="flex justify-center items-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-[#C9B88C]" />
                        </div>
                      ) : studentGrades.length === 0 ? (
                        <div className="text-center py-12 bg-[#F9F8F6] rounded-lg border border-[#E5E7EB]">
                          <p className="text-[#1F2937] opacity-60">No grades found for this student.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableCaption>Grades for {userEmailSearch}</TableCaption>
                          <TableHeader>
                            <TableRow className="bg-[#F9F8F6]">
                              <TableHead className="text-[#1F2937]">Subject</TableHead>
                              <TableHead className="text-[#1F2937]">Score</TableHead>
                              <TableHead className="text-[#1F2937]">Feedback</TableHead>
                              <TableHead className="text-[#1F2937]">Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentGrades.map((grade) => (
                              <TableRow key={grade.id} className="border-b border-[#E5E7EB]">
                                <TableCell className="font-medium capitalize">{grade.subject}</TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <Badge className={`${getScoreColor(grade.score)} font-bold`}>
                                      {getGradeLetter(grade.score)}
                                    </Badge>
                                    <span className="text-[#1F2937] opacity-70">{grade.score}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-md">{grade.feedback || "No feedback provided"}</TableCell>
                                <TableCell className="text-[#1F2937] opacity-70">
                                  {new Date(grade.timestamp).toLocaleDateString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Monitoring tab */}
            <TabsContent value="monitoring">
              <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
                <CardHeader className="border-b border-[#E5E7EB]">
                  <CardTitle className="text-xl font-serif text-[#1F2937]">Live Student Monitoring</CardTitle>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="overflow-hidden border-[#E5E7EB]">
                      <CardHeader className="py-3 px-4 bg-[#F9F8F6]">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-medium text-[#1F2937]">student@lab.com</h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
                            Active
                          </span>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-4">
                        <div className="relative border border-[#E5E7EB] rounded-lg overflow-hidden h-48 bg-[#F9F8F6] flex items-center justify-center">
                          <p className="text-[#1F2937] opacity-40 text-sm">Latest screenshot will appear here</p>
                          <div className="absolute bottom-2 right-2 bg-[#0F172A] bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                            Awaiting activity
                          </div>
                        </div>
                        
                        <div className="mt-4 text-xs text-[#1F2937]">
                          <div className="flex justify-between">
                            <span>Subject: <span className="text-[#8C977A]">JavaScript</span></span>
                            <span>Time: <span className="font-mono">01:25:30</span></span>
                          </div>
                          <div className="mt-1 flex justify-between">
                            <span>Tab switches: <span className="text-red-600 font-medium">0</span></span>
                            <span>Code: <span className="text-[#C9B88C]">128 lines</span></span>
                          </div>
                        </div>
                      </CardContent>
                      
                      <CardFooter className="flex justify-end space-x-3 p-4 bg-white border-t border-[#E5E7EB]">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs rounded-lg border-[#8C977A] text-[#8C977A] hover:bg-[#8C977A] hover:text-white"
                        >
                          Message
                        </Button>
                        <Button 
                          size="sm" 
                          className="text-xs bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-lg"
                        >
                          Full Monitor
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Logs tab */}
            <TabsContent value="logs">
              <Card className="bg-white shadow-sm rounded-2xl border-[#E5E7EB]">
                <CardHeader className="border-b border-[#E5E7EB] flex flex-row justify-between items-center">
                  <CardTitle className="text-xl font-serif text-[#1F2937]">Event Logs</CardTitle>
                  <div>
                    <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                      <SelectTrigger className="w-[180px] border-[#E5E7EB] rounded-lg">
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        <SelectItem value="tab-switch">Tab Switch</SelectItem>
                        <SelectItem value="screenshot">Screenshot</SelectItem>
                        <SelectItem value="screen-share">Screen Share</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  {isLoadingLogs ? (
                    <div className="flex justify-center items-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#C9B88C]" />
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-[#1F2937] opacity-60">No logs found with the current filter.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableCaption>Event logs from student activities</TableCaption>
                      <TableHeader>
                        <TableRow className="bg-[#F9F8F6]">
                          <TableHead className="text-[#1F2937] w-36">Time</TableHead>
                          <TableHead className="text-[#1F2937] w-40">User</TableHead>
                          <TableHead className="text-[#1F2937] w-32">Event Type</TableHead>
                          <TableHead className="text-[#1F2937]">Details</TableHead>
                          <TableHead className="text-[#1F2937] w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map((log) => (
                          <TableRow key={log.id} className="border-b border-[#E5E7EB]">
                            <TableCell className="text-sm font-medium text-[#1F2937]">
                              {formatTime(log.timestamp)}
                            </TableCell>
                            <TableCell className="text-sm text-[#1F2937]">
                              User {log.userId}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full 
                                ${log.type === 'tab-switch' ? 'bg-yellow-100 text-yellow-800' : ''}
                                ${log.type === 'screenshot' ? 'bg-blue-100 text-blue-800' : ''}
                                ${log.type === 'screen-share' ? 'bg-green-100 text-green-800' : ''}
                              `}>
                                {log.type}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-[#1F2937] opacity-80">
                              {log.type === 'screenshot' ? (
                                (() => {
                                  try {
                                    const parsedData = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
                                    const metadata = parsedData?.metadata;
                                    const exactTime = metadata?.timestamp 
                                      ? new Date(metadata.timestamp).toLocaleString('en-US', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                          hour12: true
                                        })
                                      : 'Unknown time';
                                    return (
                                      <div>
                                        <div>Screenshot captured</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                          <strong>Exact time:</strong> {exactTime}
                                          {metadata?.captureNumber && (
                                            <span className="ml-2">• Capture #{metadata.captureNumber}</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  } catch (error) {
                                    return <span>Screenshot captured</span>;
                                  }
                                })()
                              ) : log.type === 'tab-switch' ? (
                                <span>Tab switch detected</span>
                              ) : (
                                <span>Screen sharing {JSON.parse(log.data || '{}').started ? 'started' : 'ended'}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {log.type === 'screenshot' && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      onClick={() => setSelectedLog(log)}
                                      className="rounded-lg border-[#8C977A] text-[#8C977A] hover:bg-[#8C977A] hover:text-white"
                                      size="sm"
                                    >
                                      View
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl">
                                    <DialogHeader>
                                      <DialogTitle className="font-serif text-[#1F2937]">Student Screenshot</DialogTitle>
                                    </DialogHeader>
                                    {selectedLog && (
                                      <div className="mt-4">
                                        {(() => {
                                          try {
                                            const parsedData = JSON.parse(selectedLog.data);
                                            
                                            // Check if this is Puppeteer metadata (no actual image data)
                                            if (parsedData.method === 'puppeteer-server-side' || parsedData.captureMethod === 'puppeteer-server-side') {
                                              // This is Puppeteer metadata, display the actual screenshot
                                              return (
                                                <div className="text-center p-6 bg-blue-50 border border-blue-200 rounded-lg">
                                                  <div className="text-blue-600 mb-4">
                                                    <div className="text-4xl mb-2">🚀</div>
                                                    <div className="text-lg font-medium">Puppeteer Screenshot Captured</div>
                                                  </div>
                                                  <p className="text-sm text-gray-600 mb-4">
                                                    This screenshot was captured server-side using Puppeteer and saved as a file.
                                                  </p>
                                                  
                                                  {/* Display the actual screenshot image if filename is available */}
                                                  {parsedData.filename && (
                                                    <div className="mb-4">
                                                      <img 
                                                        src={`/api/screenshots/${parsedData.filename}`}
                                                        alt="Puppeteer Screenshot"
                                                        className="w-full max-w-2xl mx-auto rounded-lg border shadow-md"
                                                        style={{ maxHeight: '400px', objectFit: 'contain' }}
                                                        onLoad={() => {
                                                          console.log(`✅ Puppeteer screenshot loaded: ${parsedData.filename}`);
                                                        }}
                                                        onError={(e) => {
                                                          console.error(`❌ Failed to load Puppeteer screenshot: ${parsedData.filename}`);
                                                          e.currentTarget.style.display = 'none';
                                                          // Show fallback message
                                                          const fallback = document.createElement('div');
                                                          fallback.className = 'text-center p-4 bg-yellow-50 border border-yellow-200 rounded';
                                                          fallback.innerHTML = `
                                                            <div class="text-yellow-600 mb-2">⚠️ Screenshot File Not Found</div>
                                                            <p class="text-sm text-gray-600">The screenshot file "${parsedData.filename}" could not be loaded.</p>
                                                            <p class="text-xs text-gray-500 mt-1">It may have been moved or deleted from the screenshots directory.</p>
                                                          `;
                                                          e.currentTarget.parentNode?.appendChild(fallback);
                                                        }}
                                                      />
                                                    </div>
                                                  )}
                                                  
                                                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 mb-4">
                                                    <div><strong>Method:</strong> {parsedData.method}</div>
                                                    <div><strong>Container URL:</strong> {parsedData.containerUrl?.split('/').pop() || 'N/A'}</div>
                                                    <div><strong>Subject:</strong> {parsedData.subject || 'N/A'}</div>
                                                    <div><strong>Event:</strong> {parsedData.captureEvent || 'N/A'}</div>
                                                    {parsedData.filename && (
                                                      <div className="col-span-2"><strong>Filename:</strong> <span className="font-mono">{parsedData.filename}</span></div>
                                                    )}
                                                    {parsedData.imageSize && (
                                                      <div><strong>File Size:</strong> {parsedData.imageSize}KB</div>
                                                    )}
                                                    {parsedData.timestamp && (
                                                      <div><strong>Captured:</strong> {new Date(parsedData.timestamp).toLocaleTimeString()}</div>
                                                    )}
                                                  </div>
                                                  
                                                  {!parsedData.filename && (
                                                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                                      <strong>💡 Note:</strong> No filename found in metadata. The screenshot file may not be available.
                                                    </div>
                                                  )}
                                                  
                                                  <div className="mt-4">
                                                    <details>
                                                      <summary className="cursor-pointer text-sm font-medium text-blue-600">
                                                        🔧 Technical Details
                                                      </summary>
                                                      <pre className="mt-2 p-3 bg-white border rounded text-xs text-left overflow-auto max-h-32">
                                                        {JSON.stringify(parsedData, null, 2)}
                                                      </pre>
                                                    </details>
                                                  </div>
                                                </div>
                                              );
                                            }
                                            
                                            // Handle legacy client-side screenshots with actual image data
                                            const imageData = parsedData.image || parsedData;
                                            const metadata = parsedData.metadata;
                                            
                                            // Get the exact capture timestamp from metadata
                                            const exactCaptureTime = metadata?.timestamp 
                                              ? new Date(metadata.timestamp).toLocaleString('en-US', {
                                                  year: 'numeric',
                                                  month: '2-digit',
                                                  day: '2-digit',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  second: '2-digit',
                                                  hour12: true
                                                })
                                              : 'Unknown time';
                                            
                                            // Validate image data
                                            const isValidImage = imageData && typeof imageData === 'string' && imageData.length > 0;
                                            const hasValidPrefix = isValidImage && imageData.startsWith('data:image/');
                                            
                                            if (!isValidImage) {
                                              return (
                                                <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                                                  <div className="text-red-600 mb-2">❌ Invalid Screenshot Data</div>
                                                  <p className="text-sm text-gray-600">Image data is missing or corrupted</p>
                                                  <p className="text-xs text-gray-500 mt-1">Captured: {exactCaptureTime}</p>
                                                </div>
                                              );
                                            }
                                            
                                            // Add data URI prefix if missing (for old screenshots)  
                                            const correctedImageData = hasValidPrefix 
                                              ? imageData 
                                              : `data:image/jpeg;base64,${imageData}`;
                                            
                                            // Clean image data if needed
                                            let finalImageData = correctedImageData;
                                            const hasEscapeChars = correctedImageData.includes('\\"') || correctedImageData.includes('\\n');
                                            const hasExtraQuotes = correctedImageData.startsWith('"') && correctedImageData.endsWith('"');
                                            
                                            if (hasExtraQuotes) {
                                              finalImageData = correctedImageData.slice(1, -1);
                                            }
                                            if (hasEscapeChars) {
                                              finalImageData = finalImageData.replace(/\\"/g, '"').replace(/\\n/g, '');
                                            }
                                            
                                            return (
                                              <div>
                                                {/* Image Rendering */}
                                                {finalImageData?.startsWith("data:image") ? (
                                                  <img 
                                                    src={finalImageData} 
                                                    alt="Screenshot" 
                                                    className="w-full rounded-lg border border-[#E5E7EB]"
                                                    onError={(e) => {
                                                      console.error('Screenshot failed to load');
                                                      e.currentTarget.style.display = 'none';
                                                      // Show fallback error message
                                                      const fallback = document.createElement('div');
                                                      fallback.className = 'text-center p-4 bg-red-50 border border-red-200 rounded-lg';
                                                      fallback.innerHTML = `
                                                        <div class="text-red-600 mb-2">❌ Screenshot Failed to Load</div>
                                                        <p class="text-sm text-gray-600">Invalid image format or corrupted data</p>
                                                        <p class="text-xs text-gray-500 mt-1">Captured: ${exactCaptureTime}</p>
                                                      `;
                                                      e.currentTarget.parentNode?.appendChild(fallback);
                                                    }}
                                                    onLoad={() => {
                                                      console.log('✅ Screenshot loaded successfully');
                                                    }}
                                                  />
                                                ) : (
                                                  <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                                                    <div className="text-red-600 mb-2">❌ Invalid Screenshot Data</div>
                                                    <p className="text-sm text-gray-600">Image data is missing or corrupted</p>
                                                    <p className="text-xs text-gray-500 mt-1">Captured: {exactCaptureTime}</p>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          } catch (error) {
                                            console.error('Error parsing screenshot data:', error);
                                            return (
                                              <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="text-red-600 mb-2">❌ Screenshot Processing Error</div>
                                                <p className="text-sm text-gray-600 mb-2">Failed to load screenshot image. Data format error.</p>
                                                <p className="text-xs text-gray-500">Error: {error?.message || 'Unknown parsing error'}</p>
                                                <details className="mt-3 text-left">
                                                  <summary className="cursor-pointer text-xs font-medium">Raw Data Preview</summary>
                                                  <pre className="mt-2 p-3 bg-gray-100 text-xs overflow-auto max-h-32 rounded">
                                                    {typeof selectedLog.data === 'string' 
                                                      ? selectedLog.data.substring(0, 500) + (selectedLog.data.length > 500 ? '...' : '')
                                                      : JSON.stringify(selectedLog.data, null, 2)
                                                    }
                                                  </pre>
                                                </details>
                                              </div>
                                            );
                                          }
                                        })()}
                                      </div>
                                    )}
                                  </DialogContent>
                                </Dialog>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Debug tab */}
            <TabsContent value="debug">
              <Card>
                <CardHeader>
                  <CardTitle>🔧 Screenshot Debug Tools</CardTitle>
                  <CardDescription>
                    Debug screenshot capture to see what content is being captured
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Debug Screenshot Capture */}
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <h3 className="font-medium mb-3">Test Screenshot Capture</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Container URL</label>
                          <input
                            type="text"
                            placeholder="http://localhost:60401"
                            className="w-full p-2 border rounded"
                            id="debug-url"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">User ID</label>
                          <input
                            type="number"
                            placeholder="1"
                            className="w-full p-2 border rounded"
                            id="debug-userid"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={async () => {
                              const urlInput = document.getElementById('debug-url') as HTMLInputElement;
                              const userIdInput = document.getElementById('debug-userid') as HTMLInputElement;
                              
                              const containerUrl = urlInput.value || 'http://localhost:60401';
                              const userId = parseInt(userIdInput.value) || 1;
                              
                              console.log('🔧 Starting debug screenshot capture...');
                              
                              try {
                                const response = await fetch('/api/debug/capture-screenshot', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    containerUrl,
                                    userId,
                                    subject: 'debug-test'
                                  })
                                });
                                
                                const result = await response.json();
                                console.log('🔧 Debug capture result:', result);
                                
                                // Show result in UI
                                const resultDiv = document.getElementById('debug-result');
                                if (resultDiv) {
                                  resultDiv.innerHTML = `
                                    <div class="p-3 border rounded ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
                                      <div class="font-medium">${result.success ? '✅ Success' : '❌ Failed'}</div>
                                      <div class="text-sm mt-1">${result.message}</div>
                                      <pre class="text-xs mt-2 overflow-auto max-h-32">${JSON.stringify(result, null, 2)}</pre>
                                    </div>
                                  `;
                                }
                                
                                // Refresh the event logs to see the new screenshot
                                if (result.success) {
                                  setTimeout(() => {
                                    window.location.reload();
                                  }, 2000);
                                }
                                
                              } catch (error) {
                                console.error('🔧 Debug capture error:', error);
                                const resultDiv = document.getElementById('debug-result');
                                if (resultDiv) {
                                  resultDiv.innerHTML = `
                                    <div class="p-3 border rounded bg-red-50 border-red-200">
                                      <div class="font-medium">❌ Error</div>
                                      <div class="text-sm mt-1">${error.message}</div>
                                    </div>
                                  `;
                                }
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            🚀 Capture Browser Screenshot
                          </button>
                          
                          <button
                            onClick={async () => {
                              const userIdInput = document.getElementById('debug-userid') as HTMLInputElement;
                              const userId = parseInt(userIdInput.value) || 1;
                              
                              console.log('🖥️ Starting desktop capture...');
                              
                              try {
                                const response = await fetch('/api/admin/capture-desktop', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    userId,
                                    subject: 'admin-desktop-test'
                                  })
                                });
                                
                                const result = await response.json();
                                console.log('🖥️ Desktop capture result:', result);
                                
                                // Show result in UI
                                const resultDiv = document.getElementById('debug-result');
                                if (resultDiv) {
                                  resultDiv.innerHTML = `
                                    <div class="p-3 border rounded ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
                                      <div class="font-medium">${result.success ? '✅ Desktop Captured' : '❌ Failed'}</div>
                                      <div class="text-sm mt-1">${result.message}</div>
                                      <pre class="text-xs mt-2 overflow-auto max-h-32">${JSON.stringify(result, null, 2)}</pre>
                                    </div>
                                  `;
                                }
                                
                                // Refresh the event logs to see the new screenshot
                                if (result.success) {
                                  setTimeout(() => {
                                    window.location.reload();
                                  }, 2000);
                                }
                                
                              } catch (error) {
                                console.error('🖥️ Desktop capture error:', error);
                                const resultDiv = document.getElementById('debug-result');
                                if (resultDiv) {
                                  resultDiv.innerHTML = `
                                    <div class="p-3 border rounded bg-red-50 border-red-200">
                                      <div class="font-medium">❌ Error</div>
                                      <div class="text-sm mt-1">${error.message}</div>
                                    </div>
                                  `;
                                }
                              }
                            }}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            🖥️ Capture Desktop Screen
                          </button>
                        </div>
                        <div id="debug-result" className="mt-3"></div>
                        
                        {/* Workspace State Check */}
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2">🔍 Check Workspace State</h4>
                          <p className="text-sm text-gray-600 mb-3">
                            Check what's currently displayed in the VS Code workspace
                          </p>
                          <button
                            onClick={async () => {
                              const urlInput = document.getElementById('debug-url') as HTMLInputElement;
                              const containerUrl = urlInput.value || 'http://localhost:60401';
                              
                              console.log('🔍 Checking workspace state...');
                              
                              try {
                                const response = await fetch('/api/debug/workspace-state', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    containerUrl
                                  })
                                });
                                
                                const result = await response.json();
                                console.log('🔍 Workspace state result:', result);
                                
                                // Show result in UI
                                const resultDiv = document.getElementById('workspace-state-result');
                                if (resultDiv) {
                                  resultDiv.innerHTML = `
                                    <div class="p-3 border rounded ${result.success ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}">
                                      <div class="font-medium">${result.success ? '🔍 Workspace State Retrieved' : '❌ Failed'}</div>
                                      ${result.success ? `
                                        <div class="text-sm mt-2 space-y-1">
                                          <div><strong>Open Tabs:</strong> ${result.workspaceState.tabs.join(', ') || 'None'}</div>
                                          <div><strong>Welcome Screen:</strong> ${result.workspaceState.welcomeScreen ? 'Yes' : 'No'}</div>
                                          <div><strong>Files in Explorer:</strong> ${result.workspaceState.explorerFiles.join(', ') || 'None'}</div>
                                          <div><strong>Editor Content (first 100 chars):</strong> ${result.workspaceState.editorContent || 'Empty'}</div>
                                          <div><strong>Has Monaco Editor:</strong> ${result.workspaceState.hasMonacoEditor ? 'Yes' : 'No'}</div>
                                          <div><strong>Notifications:</strong> ${result.workspaceState.notifications.length}</div>
                                        </div>
                                      ` : `<div class="text-sm mt-1">${result.message}</div>`}
                                    </div>
                                  `;
                                }
                                
                              } catch (error) {
                                console.error('🔍 Workspace state error:', error);
                                const resultDiv = document.getElementById('workspace-state-result');
                                if (resultDiv) {
                                  resultDiv.innerHTML = `
                                    <div class="p-3 border rounded bg-red-50 border-red-200">
                                      <div class="font-medium">❌ Error</div>
                                      <div class="text-sm mt-1">${error.message}</div>
                                    </div>
                                  `;
                                }
                              }
                            }}
                            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                          >
                            🔍 Check Workspace State
                          </button>
                          <div id="workspace-state-result" className="mt-3"></div>
                        </div>
                        
                        {/* Browser Cleanup Tool */}
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2">🧹 Cleanup Orphaned Browsers</h4>
                          <p className="text-sm text-gray-600 mb-3">
                            Kill hanging Chrome/Puppeteer processes that may be causing issues
                          </p>
                          <button
                            onClick={async () => {
                              console.log('🧹 Starting browser cleanup...');
                              
                              try {
                                const response = await fetch('/api/debug/cleanup-browsers', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  }
                                });
                                
                                const result = await response.json();
                                console.log('🧹 Cleanup result:', result);
                                
                                // Show result in UI
                                const resultDiv = document.getElementById('cleanup-result');
                                if (resultDiv) {
                                  resultDiv.innerHTML = `
                                    <div class="p-3 border rounded ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
                                      <div class="font-medium">${result.success ? '🧹 Cleanup Completed' : '❌ Cleanup Failed'}</div>
                                      <div class="text-sm mt-1">${result.message}</div>
                                      ${result.success ? `<div class="text-xs mt-1">Platform: ${result.platform}</div>` : ''}
                                    </div>
                                  `;
                                }
                                
                              } catch (error) {
                                console.error('🧹 Cleanup error:', error);
                                const resultDiv = document.getElementById('cleanup-result');
                                if (resultDiv) {
                                  resultDiv.innerHTML = `
                                    <div class="p-3 border rounded bg-red-50 border-red-200">
                                      <div class="font-medium">❌ Error</div>
                                      <div class="text-sm mt-1">${error.message}</div>
                                    </div>
                                  `;
                                }
                              }
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            🧹 Cleanup Browsers
                          </button>
                          <div id="cleanup-result" className="mt-3"></div>
                        </div>
                      </div>
                    </div>

                    {/* System Screen Info */}
                    <div className="border rounded-lg p-4 bg-green-50">
                      <h3 className="font-medium mb-3">System Screen Information</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Check your actual system screen resolution that will be used for screenshots
                      </p>
                      <button
                        onClick={async () => {
                          console.log('🖥️ Getting system screen info...');
                          
                          try {
                            const response = await fetch('/api/debug/system-info');
                            const result = await response.json();
                            
                            console.log('🖥️ System info result:', result);
                            
                            const resultDiv = document.getElementById('system-info-result');
                            if (resultDiv) {
                              if (result.success) {
                                const info = result.systemInfo;
                                resultDiv.innerHTML = `
                                  <div class="p-3 border rounded bg-green-50 border-green-200">
                                    <div class="font-medium">🖥️ System Screen Information</div>
                                    <div class="text-sm mt-2 space-y-1">
                                      <div><strong>Screen Resolution:</strong> ${info.screen.width} x ${info.screen.height}</div>
                                      <div><strong>Available Area:</strong> ${info.screen.availWidth} x ${info.screen.availHeight}</div>
                                      <div><strong>Device Pixel Ratio:</strong> ${info.window.devicePixelRatio}</div>
                                      <div><strong>Platform:</strong> ${info.platform}</div>
                                      <div><strong>Color Depth:</strong> ${info.screen.colorDepth} bit</div>
                                    </div>
                                    <div class="text-xs mt-2 p-2 bg-white rounded border">
                                      <strong>Screenshots will be captured at:</strong> ${info.screen.width} x ${info.screen.height} pixels
                                    </div>
                                  </div>
                                `;
                              } else {
                                resultDiv.innerHTML = `
                                  <div class="p-3 border rounded bg-red-50 border-red-200">
                                    <div class="font-medium">❌ Error</div>
                                    <div class="text-sm mt-1">${result.message}</div>
                                  </div>
                                `;
                              }
                            }
                          } catch (error) {
                            console.error('🖥️ System info error:', error);
                            const resultDiv = document.getElementById('system-info-result');
                            if (resultDiv) {
                              resultDiv.innerHTML = `
                                <div class="p-3 border rounded bg-red-50 border-red-200">
                                  <div class="font-medium">❌ Error</div>
                                  <div class="text-sm mt-1">${error.message}</div>
                                </div>
                              `;
                            }
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        🖥️ Get System Screen Info
                      </button>
                      <div id="system-info-result" className="mt-3"></div>
                    </div>

                    {/* Content Analysis */}
                    <div className="border rounded-lg p-4 bg-yellow-50">
                      <h3 className="font-medium mb-3">Analyze Container Content</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Check what content is visible in the container before capturing screenshots
                      </p>
                      <button
                        onClick={async () => {
                          const urlInput = document.getElementById('debug-url') as HTMLInputElement;
                          const containerUrl = urlInput.value || 'http://localhost:60401';
                          
                          console.log('🔍 Analyzing container content...');
                          
                          try {
                            // Open the container URL in a new tab for manual inspection
                            window.open(containerUrl, '_blank');
                            
                            const resultDiv = document.getElementById('content-analysis-result');
                            if (resultDiv) {
                              resultDiv.innerHTML = `
                                <div class="p-3 border rounded bg-blue-50 border-blue-200">
                                  <div class="font-medium">🔍 Container opened in new tab</div>
                                  <div class="text-sm mt-1">Check the container manually to see what content should be captured</div>
                                  <div class="text-xs mt-1">URL: ${containerUrl}</div>
                                </div>
                              `;
                            }
                          } catch (error) {
                            console.error('🔍 Content analysis error:', error);
                          }
                        }}
                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                      >
                        🔍 Open Container for Manual Check
                      </button>
                      <div id="content-analysis-result" className="mt-3"></div>
                    </div>

                    {/* Recent Debug Logs */}
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <h3 className="font-medium mb-3">Debug Instructions</h3>
                      <div className="text-sm space-y-2">
                        <p><strong>1. Check Container Content:</strong> Use "Open Container" to see what should be captured</p>
                        <p><strong>2. Capture Debug Screenshot:</strong> Use the debug capture to see what actually gets captured</p>
                        <p><strong>3. Compare Results:</strong> Check if the screenshot matches what you see manually</p>
                        <p><strong>4. Check Browser Console:</strong> Look for detailed logging about content detection</p>
                        <p><strong>5. View Screenshots:</strong> Go to Event Logs tab and click "View" on screenshot activities</p>
                      </div>

                      {/* Quick Test: Trigger Student Screenshot */}
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-2">Quick Test: Generate Screenshot Activity</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Generate a screenshot from the student side to test viewing in Event Logs
                        </p>
                        <button
                          onClick={async () => {
                            const urlInput = document.getElementById('debug-url') as HTMLInputElement;
                            const containerUrl = urlInput.value || 'http://localhost:60401';
                            
                            console.log('🧪 Triggering student screenshot capture...');
                            
                            try {
                              const response = await fetch('/api/capture-screenshot', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  containerUrl: containerUrl
                                })
                              });
                              
                              const result = await response.json();
                              console.log('🧪 Student screenshot result:', result);
                              
                              const resultDiv = document.getElementById('student-test-result');
                              if (resultDiv) {
                                resultDiv.innerHTML = `
                                  <div class="p-3 border rounded ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
                                    <div class="font-medium">${result.success ? '✅ Screenshot Generated' : '❌ Failed'}</div>
                                    <div class="text-sm mt-1">${result.message}</div>
                                    ${result.success ? '<div class="text-xs mt-1">Check Event Logs tab to view the screenshot!</div>' : ''}
                                  </div>
                                `;
                              }
                              
                              // Refresh logs if successful
                              if (result.success) {
                                setTimeout(() => {
                                  window.location.reload();
                                }, 2000);
                              }
                              
                            } catch (error) {
                              console.error('🧪 Student screenshot error:', error);
                              const resultDiv = document.getElementById('student-test-result');
                              if (resultDiv) {
                                resultDiv.innerHTML = `
                                  <div class="p-3 border rounded bg-red-50 border-red-200">
                                    <div class="font-medium">❌ Error</div>
                                    <div class="text-sm mt-1">${error.message}</div>
                                  </div>
                                `;
                              }
                            }
                          }}
                          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                          📸 Generate Test Screenshot
                        </button>
                        <div id="student-test-result" className="mt-3"></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}