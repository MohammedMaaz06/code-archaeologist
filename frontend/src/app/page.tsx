import ArcheologySearch from "@/components/ArcheologySearch";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import RepoIndexer from "@/components/RepoIndexer";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Code Archaeologist
          </h1>
          <p className="text-slate-600">
            Investigate repository ASTs, symbol graphs, and vector indices in real-time.
          </p>
        </header>

        <RepoIndexer />
        <KnowledgeGraph />
        <ArcheologySearch />
      </div>
    </main>
  );
}
