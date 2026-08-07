import React from 'react';

export const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover text-popover-foreground border border-border px-3 py-2 rounded-lg shadow-xl text-xs space-y-1 z-50">
        {label && <div className="font-semibold text-foreground border-b border-border/50 pb-1 mb-1">{label}</div>}
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className="capitalize text-muted-foreground">{entry.name || entry.dataKey}:</span>
            </div>
            <span className="font-bold text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default CustomTooltip;
