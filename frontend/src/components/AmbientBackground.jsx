export function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-950">
      {/* Subtle radial indigo/slate gradient blob */}
      <div 
        className="absolute -top-[40%] -left-[20%] w-[70vw] h-[70vw] rounded-full blur-[140px] opacity-15"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)' }}
      />
      {/* Critical warning warm amber/red ambient bleed when high risk */}
      <div 
        className="absolute top-[30%] -right-[15%] w-[50vw] h-[50vw] rounded-full blur-[160px] opacity-10 transition-all duration-1000"
        style={{ background: 'radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, transparent 70%)' }}
      />
      {/* Tactical engineering grid lines overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />
    </div>
  );
}