with open("src/views/MatchIntelligenceTab.tsx", "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '            <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm relative overflow-hidden">' in line:
        print("Found bad div at", i)
