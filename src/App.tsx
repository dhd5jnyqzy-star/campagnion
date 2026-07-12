import { useEffect } from 'react';
import { useAppSelector } from './app/hooks';
import { CampaignScreen } from './components/CampaignScreen';
import { CampaignSelector } from './components/CampaignSelector';
import { requestPersistentStorage } from './persistence/db';

export default function App() {
  // §2: navigator.storage.persist() beim Start anfordern (Edge Case 3).
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const screen = useAppSelector((s) => s.nav.screen);
  return screen === 'selector' ? <CampaignSelector /> : <CampaignScreen />;
}
