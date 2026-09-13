import { useState, type FormEvent } from 'react';

interface JoinScreenProps {
  onJoin: (address: string) => void;
}

export default function JoinScreen({ onJoin }: JoinScreenProps) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) {
      setError('Server address is required');
      return;
    }
    setError('');
    onJoin(trimmed);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl"
      >
        <h1 className="mb-2 text-center text-4xl font-bold tracking-tight text-zaff-primary">
          ZAFF
        </h1>
        <p className="mb-8 text-center text-zaff-muted">
          Collectible Card Gaming Platform
        </p>

        <label
          htmlFor="server-address"
          className="mb-2 block text-sm font-medium text-zaff-text"
        >
          Server Address
        </label>
        <input
          id="server-address"
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            if (error) setError('');
          }}
          placeholder="ws://192.168.1.5:8080"
          className="mb-1 w-full rounded-lg border border-zaff-border bg-zaff-bg px-4 py-3 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
          autoComplete="off"
        />
        {error && (
          <p className="mb-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {!error && <div className="mb-3" />}

        <button
          type="submit"
          className="w-full rounded-lg bg-zaff-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-zaff-primary-hover focus:outline-none focus:ring-2 focus:ring-zaff-primary focus:ring-offset-2 focus:ring-offset-zaff-surface"
        >
          Join Server
        </button>
      </form>
    </div>
  );
}
