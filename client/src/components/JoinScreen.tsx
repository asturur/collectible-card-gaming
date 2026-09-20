import { useState } from 'react';
import { navLinkProps } from '../router';
import Button from './ui/Button';
import CenteredPanel from './ui/Panel';
import { TextField } from './ui/Field';

const REPO_URL = 'https://github.com/asturur/collectible-card-gaming';
const RELEASES_URL = `${REPO_URL}/releases`;

interface JoinScreenProps {
  onJoin: (address: string, playerName: string) => void;
  /** Torna alla home dell'app, il registro partite. */
  onOpenMtgLog?: () => void;
}

/** GitHub icon (Octicons mark) */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function JoinScreen({ onJoin, onOpenMtgLog }: JoinScreenProps) {
  const [address, setAddress] = useState('localhost:8080');
  const [playerName, setPlayerName] = useState('');
  const [addressError, setAddressError] = useState('');
  const [nameError, setNameError] = useState('');

  function handleSubmit() {
    const trimmedAddress = address.trim();
    const trimmedName = playerName.trim();

    let hasError = false;
    if (!trimmedAddress) {
      setAddressError('Server address is required');
      hasError = true;
    } else {
      setAddressError('');
    }
    if (!trimmedName) {
      setNameError('Player name is required');
      hasError = true;
    } else {
      setNameError('');
    }

    if (hasError) return;
    onJoin(trimmedAddress, trimmedName);
  }

  return (
    <CenteredPanel
      onSubmit={handleSubmit}
      title={<span className="font-sans text-4xl font-bold tracking-tight text-zaff-primary">ZAFF</span>}
      subtitle="Collectible Card Gaming Platform"
    >
      {/* Angolo "Fork me on GitHub": triangolo + octocat che saluta al passaggio del mouse */}
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="github-corner fixed right-0 top-0 z-50 text-white"
        aria-label="Fork me on GitHub"
        title="Fork me on GitHub"
      >
        <svg width="80" height="80" viewBox="0 0 250 250" className="h-16 w-16 sm:h-20 sm:w-20" aria-hidden="true">
          <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" className="fill-zaff-primary" />
          <path
            d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"
            fill="currentColor"
            className="octo-arm"
          />
          <path
            d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"
            fill="currentColor"
          />
        </svg>
      </a>

      <p className="mb-8 text-center text-zaff-text">CIAO</p>

      <TextField
        id="server-address"
        label="Server Address"
        value={address}
        onChange={(e) => {
          setAddress(e.target.value);
          if (addressError) setAddressError('');
        }}
        placeholder="localhost:8080"
        autoComplete="off"
        error={addressError}
      />

      <TextField
        id="player-name"
        label="Player Name"
        value={playerName}
        onChange={(e) => {
          setPlayerName(e.target.value);
          if (nameError) setNameError('');
        }}
        placeholder="Enter your name"
        autoComplete="off"
        error={nameError}
      />

      <Button type="submit" size="lg" fullWidth>
        Join Server
      </Button>

      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-2 text-sm text-zaff-muted transition-colors hover:text-zaff-primary"
      >
        <GitHubIcon className="h-4 w-4" />
        Download server from here
      </a>

      <a
        {...navLinkProps('home', () => onOpenMtgLog?.())}
        className="mt-2 block w-full text-center text-sm text-zaff-muted transition-colors hover:text-zaff-primary"
      >
        ← Registro Partite MTG
      </a>
    </CenteredPanel>
  );
}
