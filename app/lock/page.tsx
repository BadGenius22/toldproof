import { PredictionForm } from '../../components/PredictionForm';
import { SealAuthBanner } from '../../components/SealAuthBanner';

// Accepts ?text= and ?unlock= from the landing-page LiveLockHero so the
// full form opens prefilled with whatever the visitor typed in the hero.
export default async function SealPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string; unlock?: string }>;
}) {
  const sp = await searchParams;
  return (
    <>
      <SealAuthBanner />
      <PredictionForm initialText={sp.text} initialUnlock={sp.unlock} />
    </>
  );
}
