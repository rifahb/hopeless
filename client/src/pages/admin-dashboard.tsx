import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Submission, Log } from "@shared/schema";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import ScreenshotViewer from "@/components/admin/screenshot-viewer";

export default function AdminDashboard() {
  const { user, logoutMutation } = useAuth();
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [logTypeFilter, setLogTypeFilter] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  
  // Fetch submissions
  const { data: submissions = [], isLoading: isLoadingSubmissions } = useQuery<Submission[]>({
    queryKey: ["/api/submissions"],
  });
  
  // Fetch logs
  const { data: logs = [], isLoading: isLoadingLogs } = useQuery<Log[]>({
    queryKey: ["/api/logs"],
  });

  // Fetch MongoDB monitoring stats
  const { data: mongoStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/mongodb/stats"],
    refetchInterval: 10000,
  });

  // Fetch active screen shares
  const { data: activeShares = [], isLoading: isLoadingShares } = useQuery({
    queryKey: ["/api/mongodb/active-screen-shares"],
    refetchInterval: 5000,
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
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">{user?.email}</span>
              <Button 
                variant="ghost" 
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
              >
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Admin content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="submissions" className="space-y-6">
            <TabsList className="mb-4">
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
              <TabsTrigger value="monitoring">Live Monitoring</TabsTrigger>
              <TabsTrigger value="logs">Event Logs</TabsTrigger>
            </TabsList>
            
            {/* ===== FORCED EMERGENCY CONTROLS - VISIBLE ON ALL TABS ===== */}
            <div className="bg-red-200 border-4 border-red-600 rounded-lg p-6 mb-6">
              <div className="text-center">
                <h1 className="text-red-800 text-3xl font-black mb-4">
                  🚨 EMERGENCY ADMIN CONTROLS 🚨
                </h1>
                <p className="text-red-700 text-lg mb-4 font-semibold">
                  BUTTONS TO FIX DATA FORMAT ERRORS AND TEST SCREENSHOTS
                </p>
                <div className="flex justify-center gap-6">
                  <button
                    className="bg-blue-600 hover:bg-blue-800 text-white font-bold py-4 px-8 rounded-xl text-xl shadow-2xl border-2 border-blue-800 transform hover:scale-105 transition-all"
                    onClick={async () => {
                      alert('TEST BUTTON CLICKED! Now calling API...');
                      try {
                        const response = await fetch('/api/admin/test-screenshot', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const result = await response.json();
                        alert(result.success ? '✅ SUCCESS!' : '❌ FAILED: ' + result.message);
                        if (result.success) window.location.reload();
                      } catch (error) {
                        alert('❌ ERROR: ' + error.message);
                      }
                    }}
                  >
                    🧪 CAPTURE TEST SCREENSHOT
                  </button>
                  <button
                    className="bg-red-600 hover:bg-red-800 text-white font-bold py-4 px-8 rounded-xl text-xl shadow-2xl border-2 border-red-800 transform hover:scale-105 transition-all"
                    onClick={async () => {
                      if (confirm('🗑️ Clear ALL corrupted logs from both databases?')) {
                        alert('CLEAR BUTTON CLICKED! Now clearing...');
                        try {
                          const response = await fetch('/api/admin/clear-all-logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                          });
                          const result = await response.json();
                          if (result.success) {
                            alert(`✅ SUCCESS! Cleared ${result.sqliteCount} SQLite + ${result.mongoCount} MongoDB logs!`);
                            window.location.reload();
                          } else {
                            alert('❌ FAILED: ' + result.message);
                          }
                        } catch (error) {
                          alert('❌ ERROR: ' + error.message);
                        }
                      }
                    }}
                  >
                    🗑️ CLEAR ALL CORRUPTED LOGS
                  </button>
                </div>
              </div>
            </div>
            
            {/* Submissions tab */}
            <TabsContent value="submissions">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Code Submissions</h2>
                  <div className="flex space-x-4">
                    <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                      <SelectTrigger className="w-[180px]">
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
                </div>
                
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {isLoadingSubmissions ? (
                      <li className="px-4 py-4 sm:px-6 text-center text-gray-500">Loading submissions...</li>
                    ) : filteredSubmissions.length === 0 ? (
                      <li className="px-4 py-4 sm:px-6 text-center text-gray-500">No submissions found</li>
                    ) : (
                      filteredSubmissions.map((submission) => (
                        <li key={submission.id}>
                          <div className="px-4 py-4 sm:px-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <div className="h-10 w-10 rounded-full bg-primary-50 flex items-center justify-center text-primary">
                                    👤
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    User ID: {submission.userId}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Submitted {formatTime(submission.timestamp)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${submission.subject === 'javascript' ? 'bg-yellow-100 text-yellow-800' : ''}
                                  ${submission.subject === 'python' ? 'bg-blue-100 text-blue-800' : ''}
                                  ${submission.subject === 'java' ? 'bg-red-100 text-red-800' : ''}
                                  ${submission.subject === 'cpp' ? 'bg-purple-100 text-purple-800' : ''}
                                `}>
                                  {submission.subject.charAt(0).toUpperCase() + submission.subject.slice(1)}
                                </span>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      className="text-primary-dark bg-primary-50 hover:bg-primary-100 text-xs"
                                      onClick={() => setSelectedSubmission(submission)}
                                    >
                                      View
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl">
                                    <DialogHeader>
                                      <DialogTitle>Submission Details</DialogTitle>
                                    </DialogHeader>
                                    {selectedSubmission && (
                                      <div className="mt-4 space-y-4">
                                        <div>
                                          <h3 className="text-sm font-medium text-gray-700">User</h3>
                                          <p className="mt-1 text-sm text-gray-900">ID: {selectedSubmission.userId}</p>
                                        </div>
                                        <div>
                                          <h3 className="text-sm font-medium text-gray-700">Subject</h3>
                                          <p className="mt-1 text-sm text-gray-900">{selectedSubmission.subject}</p>
                                        </div>
                                        <div>
                                          <h3 className="text-sm font-medium text-gray-700">Submitted</h3>
                                          <p className="mt-1 text-sm text-gray-900">{formatTime(selectedSubmission.timestamp)}</p>
                                        </div>
                                        <div>
                                          <h3 className="text-sm font-medium text-gray-700">Code</h3>
                                          <pre className="mt-1 p-3 bg-gray-100 rounded-md text-sm font-mono overflow-auto max-h-80">
                                            {selectedSubmission.code}
                                          </pre>
                                        </div>
                                      </div>
                                    )}
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </div>
                            <div className="mt-2 sm:flex sm:justify-between">
                              <div className="sm:flex">
                                <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                  <span className="truncate max-w-md">{submission.code.substring(0, 100)}...</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </TabsContent>
            
            {/* Monitoring tab */}
            <TabsContent value="monitoring">
              {/* ========== EMERGENCY BUTTON BOX - ALWAYS SHOWS ========== */}
              <div style={{
                backgroundColor: '#fee2e2',
                border: '3px solid #dc2626',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                <h2 style={{
                  color: '#dc2626',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  marginBottom: '16px'
                }}>
                  🚨 ADMIN CONTROLS - DATA FORMAT ERROR FIX
                </h2>
                <p style={{
                  color: '#991b1b',
                  marginBottom: '20px',
                  fontSize: '16px'
                }}>
                  Seeing "Data Format Error" in screenshots? These buttons will fix it permanently.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button
                    onClick={async () => {
                      try {
                        console.log('🧪 Capturing test screenshot...');
                        const response = await fetch('/api/admin/test-screenshot', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const result = await response.json();
                        if (result.success) {
                          alert('✅ SUCCESS! Test screenshot captured and stored in MongoDB!');
                          window.location.reload();
                        } else {
                          alert('❌ Test failed: ' + result.message);
                        }
                      } catch (error) {
                        alert('❌ Error: ' + error.message);
                      }
                    }}
                    style={{
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '16px 24px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    🧪 CAPTURE TEST SCREENSHOT
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('⚠️ This will clear ALL corrupted logs from both SQLite and MongoDB. Continue?')) {
                        try {
                          console.log('🗑️ Starting cleanup...');
                          const response = await fetch('/api/admin/clear-all-logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                          });
                          const result = await response.json();
                          if (result.success) {
                            alert(`✅ SUCCESS! Cleared ${result.sqliteCount} SQLite + ${result.mongoCount} MongoDB logs!`);
                            window.location.reload();
                          } else {
                            alert('❌ Clear failed: ' + result.message);
                          }
                        } catch (error) {
                          alert('❌ Error: ' + error.message);
                        }
                      }
                    }}
                    style={{
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '16px 24px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    🗑️ FIX ALL DATA ERRORS NOW
                  </button>
                </div>
              </div>
              {/* ========== END EMERGENCY BUTTON BOX ========== */}
              
              <div className="space-y-6">
                
                {/* PROMINENT FIX BUTTON - ALWAYS VISIBLE */}
                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-6 text-center">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="text-red-800 text-lg font-bold">
                      🚨 SEEING DATA FORMAT ERRORS IN SCREENSHOTS? 
                    </div>
                    <div className="text-red-700 text-sm max-w-2xl">
                      This is caused by corrupted legacy screenshot data. Click the button below to clear ALL corrupted data and fix the errors permanently.
                    </div>
                                         <div className="flex space-x-4">
                       <Button 
                         onClick={async () => {
                           try {
                             console.log('🧪 Capturing test screenshot...');
                             const response = await fetch('/api/admin/test-screenshot', {
                               method: 'POST',
                               headers: { 'Content-Type': 'application/json' }
                             });
                             const result = await response.json();
                             if (result.success) {
                               alert('✅ SUCCESS! Test screenshot captured and stored in MongoDB! You should see it below in Recent Student Activities.');
                               window.location.reload();
                             } else {
                               alert('❌ Test screenshot failed: ' + result.message);
                             }
                           } catch (error) {
                             console.error('Test screenshot error:', error);
                             alert('❌ Error: ' + error.message);
                           }
                         }}
                         variant="outline"
                         size="lg"
                         className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-6 py-4 shadow-lg"
                       >
                         🧪 CAPTURE TEST SCREENSHOT
                       </Button>
                       <Button 
                         onClick={async () => {
                           if (confirm('⚠️ This will clear ALL corrupted logs from both SQLite and MongoDB. This will permanently fix the data format errors. Continue?')) {
                             try {
                               console.log('🗑️ Starting comprehensive database cleanup...');
                               const response = await fetch('/api/admin/clear-all-logs', {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' }
                               });
                               const result = await response.json();
                               if (result.success) {
                                 alert(`✅ SUCCESS! Cleared ${result.sqliteCount} SQLite logs + ${result.mongoCount} MongoDB logs. Data format errors are now FIXED!`);
                                 window.location.reload();
                               } else {
                                 alert('❌ Clear failed: ' + result.message);
                               }
                             } catch (error) {
                               console.error('Clear error:', error);
                               alert('❌ Error: ' + error.message);
                             }
                           }
                         }}
                         variant="destructive"
                         size="lg"
                         className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-8 py-4 shadow-lg"
                       >
                         🗑️ FIX ALL DATA FORMAT ERRORS NOW
                       </Button>
                     </div>
                  </div>
                </div>
                {/* Data Format Error Notice for Live Monitoring */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <span className="text-red-400 text-lg">⚠️</span>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-red-800">
                        Seeing "Data Format Error" in screenshots?
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>This is caused by corrupted legacy screenshot data mixed with new Puppeteer screenshots.</p>
                        <p className="mt-1">
                          <strong>Quick Fix:</strong> Click the button below to remove ALL corrupted data from both databases.
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <Button 
                        onClick={async () => {
                          if (confirm('⚠️ This will clear ALL logs from both SQLite and MongoDB (including corrupted screenshot data). This will fix the data format errors. Continue?')) {
                            try {
                              const response = await fetch('/api/admin/clear-all-logs', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                              });
                              const result = await response.json();
                              if (result.success) {
                                alert(`✅ All logs cleared! Deleted ${result.sqliteCount} SQLite logs and ${result.mongoCount} MongoDB logs. Data format errors should be fixed.`);
                                window.location.reload();
                              } else {
                                alert('❌ Clear failed: ' + result.message);
                              }
                            } catch (error) {
                              alert('❌ Error: ' + error.message);
                            }
                          }
                        }}
                        variant="destructive"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                      >
                        🗑️ FIX ERRORS NOW
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Live Student Monitoring</h2>
                  <div className="flex items-center space-x-4">
                    <Button 
                      onClick={async () => {
                        if (confirm('⚠️ This will clear ALL logs from both SQLite and MongoDB (including corrupted screenshot data). This will fix the data format errors. Continue?')) {
                          try {
                            const response = await fetch('/api/admin/clear-all-logs', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
                            });
                            const result = await response.json();
                            if (result.success) {
                              alert(`✅ All logs cleared! Deleted ${result.sqliteCount} SQLite logs and ${result.mongoCount} MongoDB logs. Data format errors should be fixed.`);
                              window.location.reload();
                            } else {
                              alert('❌ Clear failed: ' + result.message);
                            }
                          } catch (error) {
                            alert('❌ Error: ' + error.message);
                          }
                        }
                      }}
                      variant="destructive"
                      size="sm"
                    >
                      🗑️ Clear All Logs (Fix Errors)
                    </Button>
                    {isLoadingStats ? (
                      <span className="text-sm text-gray-500">Loading stats...</span>
                    ) : mongoStats ? (
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-600">
                          📸 {mongoStats.totalScreenshots} Screenshots
                        </span>
                        <span className="text-gray-600">
                          🎥 {mongoStats.activeScreenShares} Active Shares
                        </span>
                        <span className="text-gray-600">
                          📊 {mongoStats.totalLogs} Total Logs
                        </span>
                      </div>
                    ) : null}
                        </div>
                      </div>
                      
                {/* Active Screen Shares */}
                {activeShares.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-green-800 mb-2">🔴 Active Screen Shares</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {activeShares.map((share: any) => (
                        <div key={share._id} className="bg-white rounded p-3 border border-green-300">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Student {share.userId}</span>
                            <span className="text-xs text-green-600">
                              Started {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Video: {share.streamInfo?.videoTracks || 0} tracks, 
                            Audio: {share.streamInfo?.audioTracks || 0} tracks
                        </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Screenshot Viewer */}
                <ScreenshotViewer />
              </div>
            </TabsContent>
            
            {/* Logs tab */}
            <TabsContent value="logs">
              <div className="space-y-6">
                {/* Data Format Error Notice */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <span className="text-red-400 text-lg">⚠️</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Seeing "Data Format Error" in screenshots?
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>This is caused by corrupted legacy screenshot data in the logs.</p>
                        <p className="mt-1">
                          <strong>Quick Fix:</strong> Click the "🗑️ Clear All Logs (Fix Errors)" button below to remove all corrupted data.
                          This will clear both SQLite and MongoDB logs, fixing the data format errors.
                        </p>
                        <p className="mt-1 text-red-600">
                          <strong>Note:</strong> This won't affect actual MongoDB screenshots visible in Live Monitoring tab.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Event Logs</h2>
                  <div className="flex space-x-4">
                    <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                      ⚠️ Old screenshot data may show errors. Use "Clear Old Logs" to fix.
                    </div>
                                         <Button 
                       onClick={async () => {
                         try {
                           const response = await fetch('/api/admin/test-screenshot', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' }
                           });
                           const result = await response.json();
                           if (result.success) {
                             alert('✅ Test screenshot captured! Switch to Live Monitoring tab to see it.');
                             window.location.reload();
                           } else {
                             alert('❌ Test failed: ' + result.message);
                           }
                         } catch (error) {
                           alert('❌ Error: ' + error.message);
                         }
                       }}
                       variant="outline"
                       size="sm"
                     >
                       🧪 Capture Test Screenshot
                     </Button>
                     <Button 
                       onClick={async () => {
                         if (confirm('⚠️ This will clear ALL logs from both SQLite and MongoDB (including corrupted screenshot data). This will fix the data format errors. Continue?')) {
                           try {
                             const response = await fetch('/api/admin/clear-all-logs', {
                               method: 'POST',
                               headers: { 'Content-Type': 'application/json' }
                             });
                             const result = await response.json();
                             if (result.success) {
                               alert(`✅ All logs cleared! Deleted ${result.sqliteCount} SQLite logs and ${result.mongoCount} MongoDB logs. Data format errors should be fixed.`);
                               window.location.reload();
                             } else {
                               alert('❌ Clear failed: ' + result.message);
                             }
                           } catch (error) {
                             alert('❌ Error: ' + error.message);
                           }
                         }
                       }}
                       variant="destructive"
                       size="sm"
                     >
                       🗑️ Clear All Logs (Fix Errors)
                     </Button>
                    <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                      <SelectTrigger className="w-[180px]">
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
                </div>
                
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th scope="col" className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th scope="col" className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th scope="col" className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Event Type
                        </th>
                        <th scope="col" className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                        <th scope="col" className="px-6 py-3 bg-gray-50"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {isLoadingLogs ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading logs...</td>
                        </tr>
                      ) : filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No logs found</td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatTime(log.timestamp)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              User ID: {log.userId}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${log.type === 'tab-switch' ? 'bg-red-100 text-red-800' : ''}
                                ${log.type === 'screenshot' ? 'bg-blue-100 text-blue-800' : ''}
                                ${log.type === 'screen-share' ? 'bg-green-100 text-green-800' : ''}
                              `}>
                                {log.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                                        <div className="text-xs text-gray-400 mt-1">
                                          <strong>Exact time:</strong> {exactTime}
                                          {metadata?.captureNumber && (
                                            <span className="ml-2">• Capture #{metadata.captureNumber}</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  } catch (error) {
                                    return 'Screenshot captured';
                                  }
                                })()
                              ) : log.type === 'screen-share'
                                  ? 'Screen sharing event'
                                  : 'Tab switch detected'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="link" 
                                    className="text-primary hover:text-primary-dark"
                                    onClick={() => setSelectedLog(log)}
                                  >
                                    View
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl">
                                  <DialogHeader>
                                    <DialogTitle>Log Details</DialogTitle>
                                  </DialogHeader>
                                  {selectedLog && (
                                    <div className="mt-4 space-y-4">
                                      <div>
                                        <h3 className="text-sm font-medium text-gray-700">User</h3>
                                        <p className="mt-1 text-sm text-gray-900">ID: {selectedLog.userId}</p>
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-medium text-gray-700">Type</h3>
                                        <p className="mt-1 text-sm text-gray-900">
                                          {selectedLog.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                        </p>
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-medium text-gray-700">Time</h3>
                                        <p className="mt-1 text-sm text-gray-900">{formatTime(selectedLog.timestamp)}</p>
                                      </div>
                                      {selectedLog.type === 'screenshot' && selectedLog.data && (
                                        <div>
                                          <h3 className="text-sm font-medium text-gray-700">Screenshot</h3>
                                          <div className="mt-1 border border-gray-200 rounded-md overflow-hidden">
                                            {(() => {
                                              try {
                                                // Parse the JSON data to get the image and metadata
                                                const parsedData = typeof selectedLog.data === 'string' 
                                                  ? JSON.parse(selectedLog.data) 
                                                  : selectedLog.data;
                                                
                                                console.log('📸 Parsing screenshot data:', {
                                                  hasImage: !!parsedData.image,
                                                  hasMethod: !!parsedData.method,
                                                  method: parsedData.method || parsedData.metadata?.captureMethod,
                                                  dataKeys: Object.keys(parsedData),
                                                  dataType: typeof parsedData,
                                                  rawDataPreview: JSON.stringify(parsedData).substring(0, 200)
                                                });

                                                // Handle different screenshot formats
                                                let imageData, metadata, isPuppeteer = false;
                                                
                                                if (parsedData.method === 'puppeteer-server-side') {
                                                  // New Puppeteer format (Event Logs)
                                                  isPuppeteer = true;
                                                  metadata = parsedData;
                                                  // For Puppeteer screenshots in Event Logs, we don't store the image data
                                                  // They're stored in MongoDB and viewable in Live Monitoring tab
                                                  imageData = null;
                                                } else if (parsedData.image) {
                                                  // Legacy format with actual image data
                                                  imageData = parsedData.image;
                                                  metadata = parsedData.metadata || {};
                                                } else {
                                                  // Very old format
                                                  imageData = selectedLog.data;
                                                  metadata = {};
                                                }
                                                
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
                                                  : formatTime(selectedLog.timestamp);
                                                
                                                if (isPuppeteer) {
                                                  // Puppeteer screenshot - show the actual image
                                                  return (
                                                    <div className="p-4 bg-green-50 border border-green-200 rounded">
                                                      <div className="flex items-center mb-3">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                                                          🚀 Puppeteer
                                                        </span>
                                                        <span className="text-sm font-medium text-green-700">High-Quality Server-Side Capture</span>
                                                      </div>
                                                      
                                                      {/* Display the actual screenshot image if filename is available */}
                                                      {metadata.filename && (
                                                        <div className="mb-4">
                                                          <img 
                                                            src={`/api/screenshots/${metadata.filename}`}
                                                            alt="Puppeteer Screenshot"
                                                            className="w-full max-w-2xl mx-auto rounded-lg border shadow-md"
                                                            style={{ maxHeight: '400px', objectFit: 'contain' }}
                                                            onLoad={() => {
                                                              console.log(`✅ Puppeteer screenshot loaded: ${metadata.filename}`);
                                                            }}
                                                            onError={(e) => {
                                                              console.error(`❌ Failed to load Puppeteer screenshot: ${metadata.filename}`);
                                                              e.currentTarget.style.display = 'none';
                                                              // Show fallback message
                                                              const fallback = document.createElement('div');
                                                              fallback.className = 'text-center p-4 bg-yellow-50 border border-yellow-200 rounded';
                                                              fallback.innerHTML = `
                                                                <div class="text-yellow-600 mb-2">⚠️ Screenshot File Not Found</div>
                                                                <p class="text-sm text-gray-600">The screenshot file "${metadata.filename}" could not be loaded.</p>
                                                                <p class="text-xs text-gray-500 mt-1">It may have been moved or deleted from the screenshots directory.</p>
                                                              `;
                                                              e.currentTarget.parentNode?.appendChild(fallback);
                                                            }}
                                                          />
                                                        </div>
                                                      )}
                                                      
                                                      <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 mb-3">
                                                        <div><strong>Container URL:</strong> {metadata.containerUrl}</div>
                                                        <div><strong>Subject:</strong> {metadata.subject}</div>
                                                        <div><strong>Event:</strong> {metadata.captureEvent}</div>
                                                        <div><strong>File:</strong> {metadata.filename}</div>
                                                        <div><strong>Size:</strong> {metadata.imageSize}KB</div>
                                                        <div><strong>Resolution:</strong> 1920×1080</div>
                                                      </div>
                                                      
                                                      {!metadata.filename && (
                                                        <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded">
                                                          <p className="text-sm text-yellow-700 mb-2">
                                                            <strong>⚠️ Screenshot File Not Available</strong>
                                                          </p>
                                                          <p className="text-xs text-yellow-600">
                                                            No filename found in metadata. The screenshot file may not be available.
                                                          </p>
                                                        </div>
                                                      )}
                                                      
                                                      <p className="mt-3 text-sm font-medium text-center text-gray-700">
                                                        <strong>Capture Time:</strong> {exactCaptureTime}
                                                      </p>
                                                    </div>
                                                  );
                                                } else if (imageData) {
                                                  // Legacy screenshot with image data - validate format
                                                  const isValidImage = imageData && typeof imageData === 'string' && imageData.length > 0;
                                                  const hasValidPrefix = isValidImage && imageData.startsWith('data:image/');
                                                  
                                                  if (!isValidImage) {
                                                    return (
                                                      <div className="text-center p-4 bg-red-50 border border-red-200 rounded">
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
                                                  
                                                  console.log('📸 Image validation:', {
                                                    hasValidPrefix,
                                                    imageLength: imageData.length,
                                                    prefix: imageData.substring(0, 30)
                                                  });
                                                  
                                                  // 🔎 FINAL DEBUG CHECKLIST - Step 2: Console Debug Log
                                                  console.log("Screenshot image string:", correctedImageData);
                                                  console.log("Image string length:", correctedImageData.length);
                                                  console.log("First 100 chars:", correctedImageData.substring(0, 100));
                                                  console.log("Last 50 chars:", correctedImageData.substring(correctedImageData.length - 50));
                                                  
                                                  // 🔎 Check for escape characters or extra quotes
                                                  const hasEscapeChars = correctedImageData.includes('\\"') || correctedImageData.includes('\\n');
                                                  const hasExtraQuotes = correctedImageData.startsWith('"') && correctedImageData.endsWith('"');
                                                  
                                                  if (hasEscapeChars) {
                                                    console.warn('⚠️ Found escape characters in image data');
                                                  }
                                                  if (hasExtraQuotes) {
                                                    console.warn('⚠️ Found extra quotes in image data');
                                                  }
                                                  
                                                  // Clean image data if needed
                                                  let finalImageData = correctedImageData;
                                                  if (hasExtraQuotes) {
                                                    finalImageData = correctedImageData.slice(1, -1); // Remove surrounding quotes
                                                    console.log('🧹 Cleaned image data by removing extra quotes');
                                                  }
                                                  if (hasEscapeChars) {
                                                    finalImageData = finalImageData.replace(/\\"/g, '"').replace(/\\n/g, '');
                                                    console.log('🧹 Cleaned image data by removing escape characters');
                                                  }
                                                  
                                                  // 🔎 FINAL DEBUG CHECKLIST - Step 3: Manual Load Test
                                                  const testManualLoad = () => {
                                                    console.log('🧪 Testing manual image load...');
                                                    const testImg = new Image();
                                                    testImg.onload = () => {
                                                      console.log('✅ Manual load test: SUCCESS - Image loads correctly');
                                                    };
                                                    testImg.onerror = (e) => {
                                                      console.error('❌ Manual load test: FAILED - Image cannot be loaded', e);
                                                    };
                                                    testImg.src = finalImageData;
                                                  };
                                                  
                                                  // Run manual test
                                                  testManualLoad();
                                                  
                                                  return (
                                                    <div>
                                                      {/* 🔎 FINAL DEBUG CHECKLIST - Step 5: Hard Test with Known-Good Image */}
                                                      <div style={{ marginBottom: '10px' }}>
                                                        <details>
                                                          <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#666' }}>
                                                            🔧 Debug Tools (Click to expand)
                                                          </summary>
                                                          <div style={{ padding: '10px', background: '#f5f5f5', margin: '5px 0', borderRadius: '4px' }}>
                                                            <button 
                                                              onClick={() => testManualLoad()}
                                                              style={{ 
                                                                padding: '5px 10px', 
                                                                margin: '2px', 
                                                                fontSize: '11px',
                                                                background: '#007cba',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '3px',
                                                                cursor: 'pointer'
                                                              }}
                                                            >
                                                              🧪 Test Manual Load
                                                            </button>
                                                            <button 
                                                              onClick={() => {
                                                                const knownGoodImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4/8/AzAEKgPBBgggAAAABJRU5ErkJggg==";
                                                                const testImg = new Image();
                                                                testImg.onload = () => console.log('✅ Known-good image test: SUCCESS');
                                                                testImg.onerror = () => console.error('❌ Known-good image test: FAILED');
                                                                testImg.src = knownGoodImage;
                                                                document.body.appendChild(testImg);
                                                              }}
                                                              style={{ 
                                                                padding: '5px 10px', 
                                                                margin: '2px', 
                                                                fontSize: '11px',
                                                                background: '#28a745',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '3px',
                                                                cursor: 'pointer'
                                                              }}
                                                            >
                                                              🔎 Test Known-Good Image
                                                            </button>
                                                            <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                                                              <div>Valid prefix: {hasValidPrefix ? '✅' : '❌'}</div>
                                                              <div>Has escape chars: {hasEscapeChars ? '⚠️' : '✅'}</div>
                                                              <div>Has extra quotes: {hasExtraQuotes ? '⚠️' : '✅'}</div>
                                                              <div>Image length: {finalImageData.length} chars</div>
                                                            </div>
                                                          </div>
                                                        </details>
                                                      </div>
                                                      
                                                      {/* 🔎 FINAL DEBUG CHECKLIST - Step 1: Proper Image Rendering */}
                                                      {finalImageData?.startsWith("data:image") ? (
                                                        <img 
                                                          src={finalImageData} 
                                                          alt="Screenshot" 
                                                          className="w-full h-auto"
                                                          onError={(e) => {
                                                            console.error('Legacy screenshot failed to load:', {
                                                              hasValidPrefix,
                                                              imageLength: imageData?.length,
                                                              imagePrefix: imageData?.substring(0, 50)
                                                            });
                                                            e.currentTarget.style.display = 'none';
                                                            // Show fallback error message
                                                            const fallback = document.createElement('div');
                                                            fallback.className = 'text-center p-4 bg-red-50 border border-red-200 rounded';
                                                            fallback.innerHTML = `
                                                              <div class="text-red-600 mb-2">❌ Screenshot Failed to Load</div>
                                                              <p class="text-sm text-gray-600">Invalid image format or corrupted data</p>
                                                              <p class="text-xs text-gray-500 mt-1">Captured: ${exactCaptureTime}</p>
                                                              <details class="mt-2 text-left">
                                                                <summary class="cursor-pointer text-xs">Debug Info</summary>
                                                                <pre class="mt-1 p-2 bg-white text-xs overflow-auto max-h-20">
Data prefix: ${hasValidPrefix ? 'Valid' : 'Missing'}
Length: ${imageData?.length || 0} chars
Preview: ${imageData?.substring(0, 100) || 'N/A'}...
                                                                </pre>
                                                              </details>
                                                            `;
                                                            e.currentTarget.parentNode?.appendChild(fallback);
                                                          }}
                                                          onLoad={() => {
                                                            console.log('✅ Screenshot loaded successfully');
                                                          }}
                                                        />
                                                      )}
                                                      {metadata && Object.keys(metadata).length > 0 && (
                                                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                                          {metadata.captureNumber && <div><strong>Capture #:</strong> {metadata.captureNumber}</div>}
                                                          {metadata.screenResolution && <div><strong>Resolution:</strong> {metadata.screenResolution.width}×{metadata.screenResolution.height}</div>}
                                                          {metadata.url && <div><strong>URL:</strong> {metadata.url.split('/').pop()}</div>}
                                                          {metadata.codespaceActive !== undefined && <div><strong>Codespace:</strong> {metadata.codespaceActive ? 'Active' : 'Inactive'}</div>}
                                                        </div>
                                                      )}
                                                      <p className="mt-2 text-sm font-medium text-center text-gray-700">
                                                        <strong>Exact Capture Time:</strong> {exactCaptureTime}
                                                      </p>
                                                    </div>
                                                  );
                                                } else {
                                                  // No image data available or corrupted legacy data
                                                  return (
                                                    <div className="text-center p-4 bg-orange-50 border border-orange-200 rounded">
                                                      <div className="text-orange-600 mb-2">⚠️ Legacy Screenshot Data</div>
                                                      <p className="text-sm text-gray-600">This appears to be old HTML2Canvas screenshot data</p>
                                                      <p className="text-xs text-gray-500 mt-1">No image data available in Event Logs</p>
                                                      <p className="text-xs text-blue-600 mt-2">
                                                        For current screenshots, check <strong>Live Monitoring</strong> tab
                                                      </p>
                                                      <div className="mt-3 p-2 bg-white border rounded text-xs text-left">
                                                        <strong>💡 Tip:</strong> Use the "🗑️ Clear Old Logs" button above to remove corrupted legacy screenshot logs
                                                      </div>
                                                    </div>
                                                  );
                                                }
                                              } catch (error) {
                                                console.error('Error parsing screenshot data:', error);
                                                return (
                                                  <div className="text-red-500 text-sm p-4 text-center bg-red-50 border border-red-200 rounded">
                                                    <p className="font-medium">⚠️ Data Format Error</p>
                                                    <p className="text-xs mt-1">Unable to parse screenshot data</p>
                                                    <p className="text-xs text-gray-500 mt-2">Event logged at: {formatTime(selectedLog.timestamp)}</p>
                                                    <details className="mt-2 text-left">
                                                      <summary className="cursor-pointer text-xs">Show raw data</summary>
                                                      <pre className="mt-1 p-2 bg-white text-xs overflow-auto max-h-20">
                                                        {JSON.stringify(selectedLog.data, null, 2).substring(0, 500)}...
                                                      </pre>
                                                    </details>
                                                  </div>
                                                );
                                              }
                                            })()}
                                          </div>
                                        </div>
                                      )}
                                      {selectedLog.type !== 'screenshot' && selectedLog.data && (
                                        <div>
                                          <h3 className="text-sm font-medium text-gray-700">Data</h3>
                                          <pre className="mt-1 p-3 bg-gray-100 rounded-md text-sm font-mono overflow-auto max-h-60">
                                            {selectedLog.data}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
