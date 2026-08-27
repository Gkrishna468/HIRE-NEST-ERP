import React, { useEffect, useState } from 'react';
import { Mail, RefreshCw, AlertCircle, FileText, Database, GitMerge, FileQuestion, Users, Search, Paperclip, ChevronRight, Play, CheckCircle2, XCircle, ArrowRight, Clock, Plus } from 'lucide-react';
import { auth } from '../lib/firebase';
import { Badge } from '../lib/Badge';
import { Button } from '../lib/Button';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../lib/utils';
import DOMPurify from 'dompurify';

export default function InboxTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [connectionStatus, setConnectionStatus] = useState<string>('CONNECTING');

  const fetchInbox = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const [metricsRes, messagesRes, statusRes] = await Promise.all([
        fetch('/api/workspace/intake/metrics', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/google/gmail/messages', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/workspace/status', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      ]);

      let metricsData: any = {};
      let messagesData: any = {};
      let statusData: any = {};

      if (metricsRes && metricsRes.ok) {
        try {
          metricsData = await metricsRes.json();
        } catch {
          metricsData = {};
        }
      }

      if (statusRes && statusRes.ok) {
        try {
          statusData = await statusRes.json();
          setConnectionStatus(statusData.status || (statusData.connected ? 'CONNECTED' : 'NOT_CONNECTED'));
        } catch {
          setConnectionStatus('ERROR');
        }
      } else {
        setConnectionStatus('NOT_CONNECTED');
      }

      if (messagesRes) {
        try {
          messagesData = await messagesRes.json();
        } catch {
          messagesData = { messages: [] };
        }

        if (!messagesRes.ok) {
          if (messagesData.error && typeof messagesData.error === 'string' && messagesData.error.includes("No Google workspace connection found")) {
            // Managed via connectionStatus state banner
          } else if (messagesData.error) {
            setError(typeof messagesData.error === 'string' ? messagesData.error : 'Failed to fetch messages');
          }
        }
      }

      setMetrics(metricsData?.metrics || {});
      setMessages(messagesData?.messages || []);
    } catch (e: any) {
      console.warn("[InboxTab] Fetch error:", e);
      setError(e?.message || 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
      setSyncing(true);
      setError('');
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/workspace/mailos/sync', { 
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` } 
        });
        
        const data = await res.json();
        if (!res.ok) {
            if (data.error && data.error.includes("No Google workspace connection found")) {
                throw new Error("No Google Workspace connection found. Please connect your account in Settings > Integrations.");
            }
            throw new Error(data.error || 'Failed to sync emails');
        }
        await fetchInbox();
      } catch (e: any) {
        setError(e.message);
      } finally {
        setSyncing(false);
      }
  };

  const reprocess = async (messageId: string, forceIntent?: string) => {
      setLoading(true);
      setError('');
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/workspace/mailos/message/${messageId}/analyze`, { 
            method: 'POST',
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: forceIntent ? JSON.stringify({ forceIntent }) : undefined
        });
        
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to reprocess message');
        }
        
        if (selectedMessage && selectedMessage.id === messageId) {
            // Update selected message classification
            setSelectedMessage({
                ...selectedMessage,
                classification: data.result?.classification,
                status: data.result?.status || 'PROCESSED'
            });
        }
        
        await fetchInbox();
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#F8FAFC]">
      <header className="p-4 bg-white border-b border-slate-200 shrink-0">
         <div className="flex items-center justify-between">
             <div className="flex items-center gap-4">
                 <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Mail size={20} />
                 </div>
                 <div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">Business Inbox</h1>
                    <p className="text-xs text-slate-500 font-medium">Requirement & Candidate Processing Pipeline</p>
                 </div>
             </div>
             <div className="flex items-center gap-6">
                <Button 
                    onClick={handleSync} 
                    disabled={syncing || connectionStatus !== 'CONNECTED'}
                    variant="outline" 
                    className="font-bold gap-2"
                >
                    <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                    {syncing ? 'Syncing...' : connectionStatus === 'CONNECTED' ? 'Sync Gmail' : 'Not Connected'}
                </Button>
                <div className="flex gap-4 items-center mr-4">
                  <div className="text-center">
                    <span className="block text-xl font-black text-slate-800">{metrics.source_gmail || 0}</span>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Emails</span>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div className="text-center">
                    <span className="block text-xl font-black text-emerald-600">{metrics.type_requirement || 0}</span>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Reqs</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-xl font-black text-blue-600">{metrics.type_candidate || metrics.type_resume || 0}</span>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Cands</span>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div className="text-center">
                    <span className="block text-xl font-black text-orange-500">{metrics.status_manual_review || 0}</span>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Review</span>
                  </div>
                </div>
             </div>
         </div>
      </header>

      {connectionStatus === 'NOT_CONFIGURED' && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 p-3 flex items-center gap-3 shrink-0">
              <AlertCircle size={18} className="text-amber-600" />
              <span className="font-semibold text-sm">Google Workspace Integration is not configured in this environment (needs client credentials in Settings).</span>
          </div>
      )}
      {connectionStatus === 'NOT_CONNECTED' && (
          <div className="bg-indigo-50 border-b border-indigo-200 text-indigo-800 p-3 flex items-center gap-3 shrink-0">
              <AlertCircle size={18} className="text-indigo-600" />
              <span className="font-semibold text-sm">Google account is not connected. Please connect your Google account in Settings &gt; Integrations.</span>
          </div>
      )}
      {connectionStatus === 'TOKEN_EXPIRED' && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 p-3 flex items-center gap-3 shrink-0">
              <AlertCircle size={18} className="text-rose-600" />
              <span className="font-semibold text-sm">Google connection has expired or been revoked. Please reconnect in Settings &gt; Integrations.</span>
          </div>
      )}
      {connectionStatus === 'ERROR' && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 p-3 flex items-center gap-3 shrink-0">
              <AlertCircle size={18} className="text-rose-600" />
              <span className="font-semibold text-sm">Error communicating with Google integration services.</span>
          </div>
      )}

      {error && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 p-3 flex items-center gap-3 shrink-0">
              <AlertCircle size={18} />
              <span className="font-semibold text-sm">{error}</span>
          </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* INBOX LIST */}
        <div className="w-1/3 border-r border-slate-200 bg-white flex flex-col">
            <div className="p-3 border-b border-slate-100">
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search messages..." 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setActiveTab('inbox')}
                        className={cn(
                            "flex-1 text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                            activeTab === 'inbox' ? "bg-indigo-100 text-indigo-700" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        Inbox
                    </button>
                    <button 
                        onClick={() => setActiveTab('sent')}
                        className={cn(
                            "flex-1 text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                            activeTab === 'sent' ? "bg-indigo-100 text-indigo-700" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        Sent
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {messages.length === 0 && !loading ? (
                    <EmptyState icon={Mail} title="Inbox Zero" description="No messages to process." />
                ) : (
                    <div className="divide-y divide-slate-100">
                        {messages.filter(msg => 
                            activeTab === 'inbox' 
                                ? !msg.rawPayload?.labels?.includes('SENT') 
                                : msg.rawPayload?.labels?.includes('SENT')
                        ).map((msg) => (
                            <div 
                                key={msg.id} 
                                onClick={() => setSelectedMessage(msg)}
                                className={cn(
                                    "p-4 cursor-pointer hover:bg-slate-50 transition-colors group",
                                    selectedMessage?.id === msg.id ? "bg-indigo-50/50 border-l-4 border-l-indigo-500" : "border-l-4 border-l-transparent"
                                )}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={cn("font-bold text-sm truncate pr-2 flex items-center gap-2", selectedMessage?.id === msg.id ? "text-indigo-900" : "text-slate-800")}>
                                        {msg.rawPayload?.labels?.includes('SENT') ? (
                                            <>
                                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                                To: {msg.rawPayload?.to?.split('<')[0].trim() || 'Unknown'}
                                            </>
                                        ) : (
                                            msg.from.split('<')[0].trim()
                                        )}
                                    </h3>
                                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                <h4 className="text-sm font-semibold text-slate-700 truncate mb-1">{msg.subject}</h4>
                                <p className="text-xs text-slate-500 line-clamp-2">{msg.snippet || msg.body?.substring(0, 100)}</p>
                                
                                <div className="mt-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge className={cn(
                                            "text-[9px] uppercase font-black tracking-wider border-none px-1.5 py-0.5",
                                            msg.classification?.type === 'Requirement' ? "bg-emerald-100 text-emerald-700" :
                                            msg.classification?.type === 'Candidate' || msg.classification?.type === 'Candidate Submission' ? "bg-blue-100 text-blue-700" :
                                            "bg-slate-100 text-slate-600"
                                        )}>
                                            {msg.classification?.type || 'Unknown'}
                                        </Badge>
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="flex items-center text-slate-400">
                                                <Paperclip size={12} />
                                                <span className="text-[10px] font-bold ml-1">{msg.attachments.length}</span>
                                            </div>
                                        )}
                                    </div>
                                    <Badge className={cn(
                                        "text-[9px] uppercase font-bold border-none px-1.5 py-0.5",
                                        msg.status === 'PROCESSED' || msg.status === 'PROCESSED_BY_INTAKE' ? "bg-green-100 text-green-700" :
                                        msg.status === 'FAILED' ? "bg-red-100 text-red-700" :
                                        "bg-orange-100 text-orange-700"
                                    )}>
                                        {msg.status === 'PROCESSED_BY_INTAKE' ? 'INTAKE' : msg.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* THREAD VIEW */}
        <div className="w-2/3 bg-[#F8FAFC] flex flex-col">
            {selectedMessage ? (
                <>
                    <div className="p-6 bg-white border-b border-slate-200 shrink-0">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 mb-2">{selectedMessage.subject}</h2>
                                <div className="flex flex-col gap-1 text-sm text-slate-600 font-medium mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 w-10">From:</span> 
                                        <span className="font-bold text-slate-800">{selectedMessage.from}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 w-10">To:</span> 
                                        <span className="font-bold text-slate-800">{selectedMessage.rawPayload?.to || 'Unknown'}</span>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 mt-2">
                                    {new Date(selectedMessage.createdAt).toLocaleString()}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => reprocess(selectedMessage.id)} disabled={loading} variant="outline" size="sm" className="font-bold">
                                    <Play size={14} className="mr-2" /> {loading ? "Processing..." : "Re-Process"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex gap-6">
                        {/* EMAIL BODY & ATTACHMENTS */}
                        <div className="flex-1 space-y-6">
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Original Message</h3>
                                <div 
                                    className="text-sm text-slate-700 whitespace-pre-wrap font-medium font-sans leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedMessage.body || "No body content available.") }}
                                />
                            </div>

                            {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Attachments ({selectedMessage.attachments.length})</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedMessage.attachments.map((att: any, idx: number) => (
                                            <div key={idx} className="flex items-center p-3 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50 cursor-pointer group">
                                                <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mr-3">
                                                    <FileText size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700">{att.filename || 'Document'}</p>
                                                    <p className="text-xs text-slate-500 truncate">{att.mimeType}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* AI CLASSIFICATION & TIMELINE PANEL */}
                        <div className="w-80 space-y-6 shrink-0">
                            {/* Classification Panel */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                                    <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                                        <Database size={14} /> AI Classification
                                    </h3>
                                    <Badge className="bg-indigo-200 text-indigo-800 border-none font-bold">
                                        {selectedMessage.classification?.confidence || 0}% Conf
                                    </Badge>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold mb-1">Intent</p>
                                        <p className="text-sm font-black text-slate-800">{selectedMessage.classification?.type || 'Unknown'}</p>
                                    </div>
                                    {selectedMessage.classification?.summary && (
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold mb-1">AI Summary</p>
                                            <p className="text-sm text-slate-700 font-medium leading-snug">{selectedMessage.classification?.summary}</p>
                                        </div>
                                    )}
                                    <div className="pt-4 border-t border-slate-100">
                                        <h4 className="text-xs font-bold text-slate-800 mb-2">Suggested Actions</h4>
                                        <div className="space-y-2">
                                            {selectedMessage.classification?.suggestedActions ? (
                                                selectedMessage.classification.suggestedActions.map((action: string, i: number) => (
                                                    <Button key={i} variant="outline" size="sm" className="w-full justify-start text-xs font-bold">
                                                        <Plus size={14} className="mr-2 text-indigo-600" /> {action}
                                                    </Button>
                                                ))
                                            ) : (
                                                <>
                                                    <Button onClick={() => reprocess(selectedMessage.id, 'Requirement')} disabled={loading} variant="outline" size="sm" className="w-full justify-start text-xs font-bold">
                                                        <Plus size={14} className="mr-2 text-emerald-600" /> Create Requirement
                                                    </Button>
                                                    <Button onClick={() => reprocess(selectedMessage.id, 'Candidate')} disabled={loading} variant="outline" size="sm" className="w-full justify-start text-xs font-bold">
                                                        <Plus size={14} className="mr-2 text-blue-600" /> Create Candidate
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Processing Timeline */}
                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Clock size={14} /> Business Flow
                                </h3>
                                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-indigo-600 text-slate-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                            <CheckCircle2 size={12} />
                                        </div>
                                        <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-3 rounded-lg border border-slate-100 bg-slate-50 shadow-sm">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="font-bold text-slate-800 text-xs">AI Parsed</div>
                                                <time className="font-medium text-[10px] text-slate-400">{new Date(selectedMessage.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
                                            </div>
                                            <div className="text-[10px] font-medium text-slate-500">{selectedMessage.classification?.type || 'Ingested'}</div>
                                        </div>
                                    </div>
                                    
                                    <div className={cn("relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group", selectedMessage.classification?.type === 'Requirement' ? "is-active" : "")}>
                                        <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-emerald-500 text-slate-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                            {selectedMessage.classification?.type === 'Requirement' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                        </div>
                                        <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-3 rounded-lg border border-slate-100 bg-slate-50 shadow-sm">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="font-bold text-slate-800 text-xs">Candidates Found</div>
                                            </div>
                                            <div className="text-[10px] font-medium text-slate-500">{selectedMessage.classification?.type === 'Requirement' ? 'Matched with Global Pool' : 'Waiting for Req'}</div>
                                        </div>
                                    </div>
                                    
                                    <div className={cn("relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group", selectedMessage.classification?.type === 'Requirement' ? "is-active" : "")}>
                                        <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-blue-500 text-slate-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                            {selectedMessage.classification?.type === 'Requirement' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                        </div>
                                        <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-3 rounded-lg border border-slate-100 bg-slate-50 shadow-sm">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="font-bold text-slate-800 text-xs">Vendor Broadcast</div>
                                            </div>
                                            <div className="text-[10px] font-medium text-slate-500">{selectedMessage.classification?.type === 'Requirement' ? 'Published to Vendor Hub' : 'Pending'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <EmptyState icon={Mail} title="Select a Message" description="Choose a message from the list to view details and process it." />
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
