import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AURA // Quantitative Case File',
  description: 'Hedge Fund State Graph Dossier Compiler.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="h-full bg-inkNavy text-paper antialiased flex flex-col relative font-sans">
        {/* Dynamic Rosy & Navy Ambient Background Orbs */}
        <div className="ambient-glow-rose" />
        <div className="ambient-glow-navy" />
        
        {children}
      </body>
    </html>
  );
}
