const fs = require('fs');
const content = fs.readFileSync('src/views/SettingsTab.tsx', 'utf8');

const rufloBlock = `
                 {/* Ruflo Integration */}
                 <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                       <div>
                          <p className="font-bold text-sm text-slate-800">Ruflo Agent Harness</p>
                          <p className="text-xs text-slate-500 mt-1">Enterprise AI agent orchestration platform (L1 Capability).</p>
                       </div>
                       <div className="mt-4 sm:mt-0">
                         {rufloHealth && rufloHealth.status === 'OK' ? (
                           <span className="px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Online (L1)
                           </span>
                         ) : (
                           <span className="px-2 py-1 bg-slate-200 text-slate-600 border border-slate-300 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span> Offline
                           </span>
                         )}
                       </div>
                    </div>
                    
                    {rufloHealth && rufloHealth.status === 'OK' && (
                       <div className="bg-white border border-slate-200 rounded-lg p-4 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Latency</p>
                             <p className="text-sm font-mono text-slate-700">{rufloHealth.latency}ms</p>
                          </div>
                          <div>
                             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Provider</p>
                             <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                                <span className="flex items-center gap-1"><span className="text-emerald-500">✓</span> @claude-flow/cli</span>
                             </div>
                          </div>
                       </div>
                    )}
                    
                    <div className="flex gap-3 justify-end mt-2">
                       <button
                          onClick={async () => {
                             try {
                               const token = await auth.currentUser?.getIdToken();
                               const res = await fetch('/api/ruflo/init', {
                                 method: 'POST',
                                 headers: { 'Authorization': \`Bearer \${token}\` }
                               });
                               if (res.ok) {
                                  const hRes = await fetch('/api/ruflo/health', {
                                    headers: { 'Authorization': \`Bearer \${token}\` }
                                  });
                                  setRufloHealth(await hRes.json());
                               } else {
                                  alert("Failed to initialize Ruflo Integration.");
                               }
                             } catch (e) {
                               console.error(e);
                             }
                          }}
                          className={cn(
                             "px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg whitespace-nowrap shrink-0 transition-colors",
                             rufloHealth && rufloHealth.status === 'OK'
                               ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                               : "bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700"
                          )}
                       >
                          {rufloHealth && rufloHealth.status === 'OK' ? 'Re-Initialize' : 'Initialize Ruflo'}
                       </button>
                    </div>
                 </div>
`;

const targetString = `                         {isGoogleConnected ? "Disconnect" : "Connect Google"}\n                      </button>\n                    </div>\n                 </div>`;

const newContent = content.replace(targetString, targetString + rufloBlock);
fs.writeFileSync('src/views/SettingsTab.tsx', newContent);
