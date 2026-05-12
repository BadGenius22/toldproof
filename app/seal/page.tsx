import { PredictionForm } from '../../components/PredictionForm';

export default function SealPage() {
  return (
    <section className="flex flex-1 w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Seal a prediction</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          AES-encrypted in your browser → Walrus → Seal time-lock → Sui. Until
          unlock, the ciphertext is verifiable but unreadable.
        </p>
      </div>
      <PredictionForm />
    </section>
  );
}
