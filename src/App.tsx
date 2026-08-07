import React from 'react';

export default function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto', lineHeight: '1.6', color: '#202124' }}>
      <header style={{ borderBottom: '1px solid #dadce0', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 500, color: '#1a73e8' }}>
          HireNest OS Runtime v1.0 — Enterprise Platform Foundation
        </h1>
        <p style={{ color: '#5f6368', fontSize: '1rem', marginTop: '0.5rem' }}>
          The architecture is formally <strong>Frozen</strong>. Shifting focus to <strong>Phase 4: Product Engineering & Business Outcomes</strong>.
        </p>
      </header>

      {/* Section 1: Platform Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Status', value: 'Platform Foundation', color: '#1e8e3e' },
          { label: 'Architecture', value: 'Frozen', color: '#1a73e8' },
          { label: 'AI Runtime', value: 'Operational', color: '#1a73e8' },
          { label: 'Governance', value: 'Enabled', color: '#1a73e8' }
        ].map((item, idx) => (
          <div key={idx} style={{ padding: '1rem', background: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Section 2: Business Capabilities */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '1rem' }}>Business Capability Portfolio</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <CapabilityCard 
            title="Recruiter AI" 
            items={['Candidate Search', 'Match Intelligence', 'Candidate 360', 'Submission Assistance']} 
            icon="🎯"
          />
          <CapabilityCard 
            title="Vendor Intelligence" 
            items={['Bench Search', 'Trust Scoring', 'SLA Monitoring', 'Performance Analytics']} 
            icon="🤝"
          />
          <CapabilityCard 
            title="Executive AI" 
            items={['KPI Briefings', 'Revenue Forecasting', 'Pipeline Health', 'Risk Detection']} 
            icon="📊"
          />
          <CapabilityCard 
            title="Platform Services" 
            items={['Human Approval', 'Event Workflows', 'Audit Trails', 'Multi-model AI']} 
            icon="⚙️"
          />
        </div>
      </div>

      {/* Section 3: Runtime Health Dashboard */}
      <div style={{ padding: '1.5rem', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #dadce0', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginTop: 0, marginBottom: '1rem' }}>Operational Control Plane</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <Metric label="Active Agents" value="12" color="#1a73e8" />
          <Metric label="Running Workflows" value="41" color="#1a73e8" />
          <Metric label="Pending Approvals" value="3" color="#f9ab00" />
          <Metric label="Avg Response" value="1.2 s" color="#1a73e8" />
          <Metric label="SLA Status" value="99.9%" color="#1e8e3e" />
        </div>
      </div>

      {/* Section 4: Architecture Flow */}
      <div style={{ padding: '1.5rem', background: '#202124', borderRadius: '12px', color: '#e8eaed' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 500, marginTop: 0, marginBottom: '1rem', color: '#fff' }}>Enterprise Execution Flow</h2>
        <div style={{ fontSize: '0.9rem', fontFamily: 'monospace', whiteSpace: 'pre', overflowX: 'auto', opacity: 0.9 }}>
{`Agent (Google ADK) → Workflow Engine → Approval Platform → Capability Broker → MCP Platform → Core Services`}
        </div>
      </div>

      <footer style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #dadce0', textAlign: 'center', color: '#5f6368', fontSize: '0.9rem' }}>
        Next Milestone: <strong>First Recruiter End-to-End Workflow Validation</strong>
      </footer>
    </div>
  );
}

function CapabilityCard({ title, items, icon }: { title: string, items: string[], icon: string }) {
  return (
    <div style={{ padding: '1.25rem', border: '1px solid #dadce0', borderRadius: '8px', background: '#fff' }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: '#5f6368', fontSize: '0.9rem' }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#1e8e3e' }}>✓</span> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.75rem', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px' }}>
      <div style={{ fontSize: '0.7rem', color: '#5f6368', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

