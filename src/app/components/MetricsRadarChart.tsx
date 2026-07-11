'use client';

import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { FinancialData } from '@/lib/agent/types';

interface MetricsRadarChartProps {
  financials: FinancialData;
}

export default function MetricsRadarChart({ financials }: MetricsRadarChartProps) {
  // Helper to parse numbers safely
  const parseVal = (str: string | undefined): number => {
    if (!str) return 0;
    const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // 1. Valuation Score (Lower P/E is better / higher score)
  const pe = parseVal(financials.peRatio);
  let valuationScore = 50; // default
  if (pe > 0) {
    if (pe < 15) valuationScore = 90;
    else if (pe < 25) valuationScore = 75;
    else if (pe < 40) valuationScore = 55;
    else if (pe < 60) valuationScore = 35;
    else valuationScore = 15;
  }

  // 2. Profitability Score (Higher profit margin is better)
  const margin = parseVal(financials.profitMargin);
  let profitabilityScore = 50;
  if (margin > 0) {
    if (margin > 40) profitabilityScore = 95;
    else if (margin > 25) profitabilityScore = 80;
    else if (margin > 15) profitabilityScore = 65;
    else if (margin > 5) profitabilityScore = 40;
    else profitabilityScore = 20;
  }

  // 3. Solvency Score (Lower Debt/Equity is better)
  const de = parseVal(financials.debtToEquity);
  let solvencyScore = 50;
  if (de > 0) {
    if (de < 0.3) solvencyScore = 90;
    else if (de < 0.8) solvencyScore = 75;
    else if (de < 1.5) solvencyScore = 55;
    else if (de < 2.5) solvencyScore = 35;
    else solvencyScore = 15;
  }

  // 4. Dividend Score (Higher dividend yield is better)
  const div = parseVal(financials.dividendYield);
  let dividendScore = 10; // default low
  if (div > 0) {
    if (div > 4) dividendScore = 90;
    else if (div > 2) dividendScore = 70;
    else if (div > 1) dividendScore = 50;
    else if (div > 0.1) dividendScore = 30;
  }

  // 5. Growth Score (Derived or estimated based on margins/market cap)
  const marketCapVal = parseVal(financials.marketCap);
  let growthScore = 60; // baseline
  if (marketCapVal > 0 && margin > 15) {
    growthScore = 80; // strong large-cap
  } else if (pe > 40) {
    growthScore = 85; // high valuation growth stock
  }

  const data = [
    { subject: 'VALUATION', score: valuationScore },
    { subject: 'PROFITABILITY', score: profitabilityScore },
    { subject: 'SOLVENCY', score: solvencyScore },
    { subject: 'DIVIDENDS', score: dividendScore },
    { subject: 'GROWTH', score: growthScore },
  ];

  return (
    <div className="w-full h-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#1C2740" />
          <PolarAngleAxis 
            dataKey="subject" 
            stroke="var(--sky)" 
            fontSize={9}
            tickLine={false}
            fontFamily="Space Grotesk"
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            stroke="#1C2740" 
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="var(--rose)" 
            fill="var(--rose)" 
            fillOpacity={0.15}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
