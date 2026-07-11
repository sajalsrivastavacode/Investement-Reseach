'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip
} from 'recharts';

interface PriceChartProps {
  data: { date: string; price: number }[];
}

export default function PriceChart({ data }: PriceChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
        <defs>
          <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--rose)" stopOpacity={0.25}/>
            <stop offset="95%" stopColor="var(--rose)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="date" 
          stroke="var(--text-muted)" 
          fontSize={9} 
          tickLine={false} 
          axisLine={false}
          dy={8}
        />
        <YAxis 
          stroke="var(--text-muted)" 
          fontSize={9} 
          tickLine={false} 
          axisLine={false}
          domain={['auto', 'auto']}
          dx={-8}
        />
        <ChartTooltip 
          contentStyle={{ 
            backgroundColor: 'var(--surface)', 
            borderColor: 'var(--navy-accent)', 
            borderRadius: '8px',
            fontSize: '11px',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text)'
          }}
          labelStyle={{ fontWeight: 600, color: 'var(--rose)' }}
        />
        <Area 
          type="monotone" 
          dataKey="price" 
          stroke="var(--rose)" 
          strokeWidth={2}
          fillOpacity={1} 
          fill="url(#chartGlow)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
