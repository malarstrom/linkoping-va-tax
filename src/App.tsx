import { Button } from '@/components/ui/button';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            VA taxemotor
          </p>
          <h1 className="mt-3 text-3xl font-semibold">React + Vite är igång</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            Nästa steg är att bygga regelmotor, profilmodell och beräkningar ovanpå den här
            scaffolden.
          </p>
          <div className="mt-6">
            <Button>Shadcn-bas klar</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
