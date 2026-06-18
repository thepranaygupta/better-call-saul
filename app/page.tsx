import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">Saul — Lead Prioritization Console</h1>
      <p className="text-muted-foreground">Better call your hottest lead first.</p>
      <Button>Get Started</Button>
    </main>
  );
}
