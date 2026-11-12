
import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold text-white">
        Welcome to PATRONET
      </h1>

      <p className="text-slate-400">
        Your next-generation online store.
      </p>

      <div className="flex gap-3">
        <Button>Explore Products</Button>
        <Button variant="outline">Learn More</Button>
      </div>
    </div>
  )
}

export default App
