"use client";

import React, { useState, useMemo } from "react";

export interface ASTNode {
  id: string;
  name: string;
  kind: "class" | "function" | "method" | "variable" | "import" | "interface" | "decorator";
  filePath: string;
  lineStart: number;
  lineEnd: number;
  docstring?: string;
  signature?: string;
  children?: ASTNode[];
}

interface SymbolSearchASTProps {
  astData?: ASTNode[];
  onSelectSymbol?: (symbol: ASTNode) => void;
}

export default function SymbolSearchAST({
  astData = [],
  onSelectSymbol,
}: SymbolSearchASTProps) {
  const [query, setQuery] = useState("");
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [selectedSymbol, setSelectedSymbol] = useState<ASTNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Flatten tree for flat search view
  const flattenedSymbols = useMemo(() => {
    const list: ASTNode[] = [];
    const traverse = (nodes: ASTNode[]) => {
      for (const node of nodes) {
        list.push(node);
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(astData);
    return list;
  }, [astData]);

  // Filter symbols based on search query and kind pill
  const filteredSymbols = useMemo(() => {
    return flattenedSymbols.filter((sym) => {
      const matchesQuery =
        query === "" ||
        sym.name.toLowerCase().includes(query.toLowerCase()) ||
        sym.filePath.toLowerCase().includes(query.toLowerCase()) ||
        (sym.signature && sym.signature.toLowerCase().includes(query.toLowerCase()));

      const matchesKind =
        selectedKind === "all" || sym.kind.toLowerCase() === selectedKind.toLowerCase();

      return matchesQuery && matchesKind;
    });
  }, [flattenedSymbols, query, selectedKind]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (sym: ASTNode) => {
    setSelectedSymbol(sym);
    if (onSelectSymbol) onSelectSymbol(sym);
  };

  const getKindBadge = (kind: ASTNode["kind"]) => {
    const colors: Record<string, string> = {
      class: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      function: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
      method: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      interface: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      import: "bg-slate-700/50 text-slate-300 border-slate-600",
      variable: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      decorator: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    };
    return (
      <span
        className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
          colors[kind] || "bg-slate-800 text-slate-300 border-slate-700"
        }`}
      >
        {kind}
      </span>
    );
  };

  const renderTree = (nodes: ASTNode[], depth = 0) => {
    return (
      <div className="space-y-1">
        {nodes.map((node) => {
          const hasChildren = node.children && node.children.length > 0;
          const isExpanded = !!expandedNodes[node.id];
          const isSelected = selectedSymbol?.id === node.id;

          return (
            <div key={node.id} className="text-xs">
              <div
                onClick={() => handleSelect(node)}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                className={`flex items-center justify-between py-1.5 pr-3 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-600/30 border border-blue-500/60 text-slate-100 font-medium"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  {hasChildren ? (
                    <button
                      onClick={(e) => toggleExpand(node.id, e)}
                      className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-100 text-[10px]"
                    >
                      {isExpanded ? "▼" : "►"}
                    </button>
                  ) : (
                    <span className="w-4 h-4 text-center text-slate-600">•</span>
                  )}
                  <span className="font-mono font-semibold text-slate-200 truncate">
                    {node.name}
                  </span>
                  {getKindBadge(node.kind)}
                </div>

                <span className="font-mono text-[11px] text-slate-500 shrink-0">
                  :{node.lineStart}
                </span>
              </div>

              {hasChildren && isExpanded && (
                <div className="mt-0.5">{renderTree(node.children!, depth + 1)}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <span>🔍</span> Deep Symbol Search & AST Hierarchy
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect scope hierarchies, methods, classes, and AST trees across indexed code files.
          </p>
        </div>
        <span className="text-xs font-mono bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-md text-slate-400">
          {filteredSymbols.length} / {flattenedSymbols.length} symbols
        </span>
      </div>

      {/* Search Bar & Kind Filters */}
      <div className="space-y-2.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type to search symbols, signatures, or files..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
        />

        <div className="flex flex-wrap gap-1.5">
          {["all", "class", "function", "method", "interface", "variable", "import"].map(
            (k) => (
              <button
                key={k}
                onClick={() => setSelectedKind(k)}
                className={`text-[11px] px-2.5 py-1 rounded-md border capitalize font-mono transition-colors ${
                  selectedKind === k
                    ? "bg-blue-600/20 border-blue-500 text-blue-300 font-semibold"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {k}
              </button>
            )
          )}
        </div>
      </div>

      {/* Split Inspector Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
        {/* Left Panel: AST Hierarchy / Search Results */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800/80 rounded-lg p-3 h-[420px] overflow-y-auto">
          {query.trim() === "" && selectedKind === "all" ? (
            astData.length > 0 ? (
              renderTree(astData)
            ) : (
              <div className="text-xs text-slate-500 text-center py-12">
                No AST nodes indexed yet. Run repository indexing to populate symbol tree.
              </div>
            )
          ) : filteredSymbols.length > 0 ? (
            <div className="space-y-1">
              {filteredSymbols.map((sym) => {
                const isSelected = selectedSymbol?.id === sym.id;
                return (
                  <div
                    key={sym.id}
                    onClick={() => handleSelect(sym)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors space-y-1 ${
                      isSelected
                        ? "bg-blue-600/20 border-blue-500/80 text-slate-100"
                        : "bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-100">{sym.name}</span>
                      {getKindBadge(sym.kind)}
                    </div>
                    {sym.signature && (
                      <div className="font-mono text-[11px] text-blue-400 truncate">
                        {sym.signature}
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span className="truncate max-w-[240px]">{sym.filePath}</span>
                      <span>
                        L{sym.lineStart}-L{sym.lineEnd}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-500 text-center py-12">
              No matching symbols found.
            </div>
          )}
        </div>

        {/* Right Panel: Selected Symbol Detail Inspector */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800/80 rounded-lg p-4 h-[420px] overflow-y-auto flex flex-col justify-between">
          {selectedSymbol ? (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="border-b border-slate-800 pb-2">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-mono font-bold text-slate-100 text-sm break-all">
                    {selectedSymbol.name}
                  </h4>
                  {getKindBadge(selectedSymbol.kind)}
                </div>
                <p className="font-mono text-[11px] text-slate-400 mt-1 break-all">
                  {selectedSymbol.filePath}:{selectedSymbol.lineStart}
                </p>
              </div>

              {selectedSymbol.signature && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    Signature
                  </span>
                  <pre className="mt-1 p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    {selectedSymbol.signature}
                  </pre>
                </div>
              )}

              {selectedSymbol.docstring && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    Docstring / Metadata
                  </span>
                  <div className="mt-1 p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-slate-400 whitespace-pre-wrap">
                    {selectedSymbol.docstring}
                  </div>
                </div>
              )}

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Source Location
                </span>
                <div className="mt-1 font-mono text-[11px] text-slate-300">
                  Lines {selectedSymbol.lineStart} to {selectedSymbol.lineEnd}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 text-center my-auto">
              Select a symbol from the left panel to inspect its signature, location, and AST details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
