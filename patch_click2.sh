cat > replace.txt << 'INNER_EOF'
              onClick={async () => {
                setLoading(true);
                try {
                  const response = await fetch("/api/admin", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "rescan-matches" }),
                  });
                  const data = await response.json();
                  if (data.success) {
                    setScanProgress(`${data.matchUpdatesCount} Matches Updated... reloading.`);
                    setTimeout(() => window.location.reload(), 1500);
                  } else {
                    setScanProgress(`Error: ${data.error || 'Failed'}`);
                    setLoading(false);
                  }
                } catch (err) {
                  console.error(err);
                  setScanProgress("Failed to run match scan.");
                  setLoading(false);
                }
              }}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors uppercase tracking-wider"
INNER_EOF
