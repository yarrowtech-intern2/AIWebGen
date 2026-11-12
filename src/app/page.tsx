export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">AgentWebBuilder · M1</p>
      <h1 className="text-4xl font-semibold tracking-tight">Build websites by chatting with Claude.</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        The AI core is ready. The builder UI (chat, live preview, code view) arrives in M2. Until then, try the
        agent from the terminal:
      </p>
      <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
        <code>npm run agent:try -- &quot;a landing page for a bakery&quot;</code>
      </pre>
    </main>
  );
}
