import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Search, ExternalLink, Loader2, Bot, Copy, Check } from 'lucide-react';
import type { SearchResult } from '../types/permitAgent.types';

interface SearchTerminalProps {
  onFormFound?: (result: SearchResult) => void;
}

export const SearchTerminal: React.FC<SearchTerminalProps> = ({ onFormFound }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResult(null);

    // Simulate AI search - in production this calls a Supabase Edge Function
    // that invokes the Gemini API with Google Search grounding
    await new Promise((r) => setTimeout(r, 1500));

    const mockResult: SearchResult = {
      report: `Found memorial permit application information for "${query}". The issuing authority manages memorial applications through their official channels. Contact them directly for the most up-to-date application form and requirements.`,
      links: [
        {
          title: `${query} - Memorial Application Form`,
          url: `https://example.com/permits/${encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-'))}`,
        },
        {
          title: `${query} - Regulations & Guidelines`,
          url: `https://example.com/regulations/${encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-'))}`,
        },
      ],
      authorityName: `${query} Authority`,
      authorityContact: `permits@${query.toLowerCase().replace(/\s+/g, '')}.example.com`,
    };

    setResult(mockResult);
    setIsSearching(false);
    onFormFound?.(mockResult);
  };

  const handleCopyContact = () => {
    if (result?.authorityContact) {
      navigator.clipboard.writeText(result.authorityContact);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-600" />
          AI Form Discovery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Enter cemetery or churchyard name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
              disabled={isSearching}
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Search</span>
          </Button>
        </div>

        {isSearching && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div>
              <div className="text-sm font-medium text-blue-900">AI is searching...</div>
              <div className="text-xs text-blue-700">
                Looking for official memorial permit forms for "{query}"
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
            {/* Authority info */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{result.authorityName}</div>
                {result.authorityContact && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-600">{result.authorityContact}</span>
                    <button
                      onClick={handleCopyContact}
                      className="text-slate-400 hover:text-slate-600"
                      title="Copy contact"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              <Badge className="bg-green-100 text-green-800">Found</Badge>
            </div>

            {/* Report */}
            <p className="text-sm text-slate-600">{result.report}</p>

            {/* Links */}
            {result.links.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500 uppercase">Discovered Links</div>
                {result.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    {link.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
