import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JoinScreen from './JoinScreen';

describe('JoinScreen', () => {
  it('renders the ZAFF title', () => {
    render(<JoinScreen onJoin={() => {}} />);
    expect(screen.getByText('ZAFF')).toBeInTheDocument();
  });

  it('renders the server address input, player name input, and join button', () => {
    render(<JoinScreen onJoin={() => {}} />);
    expect(screen.getByLabelText('Indirizzo del server')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome del giocatore')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entra nel server/i })).toBeInTheDocument();
  });

  it('defaults server address to localhost:8080', () => {
    render(<JoinScreen onJoin={() => {}} />);
    expect(screen.getByLabelText('Indirizzo del server')).toHaveValue('localhost:8080');
  });

  it('shows validation error for empty address', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={() => {}} />);

    // Clear the default address
    const addressInput = screen.getByLabelText('Indirizzo del server');
    await user.clear(addressInput);

    await user.click(screen.getByRole('button', { name: /entra nel server/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((a) => a.textContent === 'L\'indirizzo del server è obbligatorio')).toBe(true);
    expect(addressInput).toHaveAttribute('aria-invalid', 'true');
    expect(addressInput).toHaveAccessibleDescription('L\'indirizzo del server è obbligatorio');
  });

  it('shows validation error for empty player name', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={() => {}} />);

    await user.click(screen.getByRole('button', { name: /entra nel server/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((a) => a.textContent === 'Il nome del giocatore è obbligatorio')).toBe(true);
  });

  it('shows both validation errors when both fields are empty', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={() => {}} />);

    // Clear the default address
    const addressInput = screen.getByLabelText('Indirizzo del server');
    await user.clear(addressInput);

    await user.click(screen.getByRole('button', { name: /entra nel server/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
  });

  it('calls onJoin with address and player name on valid submit', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<JoinScreen onJoin={onJoin} />);

    const addressInput = screen.getByLabelText('Indirizzo del server');
    await user.clear(addressInput);
    await user.type(addressInput, '192.168.1.5:8080');
    await user.type(screen.getByLabelText('Nome del giocatore'), 'Alice');
    await user.click(screen.getByRole('button', { name: /entra nel server/i }));

    expect(onJoin).toHaveBeenCalledWith('192.168.1.5:8080', 'Alice');
  });

  it('trims whitespace from both fields before calling onJoin', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<JoinScreen onJoin={onJoin} />);

    const addressInput = screen.getByLabelText('Indirizzo del server');
    await user.clear(addressInput);
    await user.type(addressInput, '  localhost:8080  ');
    await user.type(screen.getByLabelText('Nome del giocatore'), '  Bob  ');
    await user.click(screen.getByRole('button', { name: /entra nel server/i }));

    expect(onJoin).toHaveBeenCalledWith('localhost:8080', 'Bob');
  });

  it('clears address error when user starts typing in address field', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={() => {}} />);

    // Clear the default address and submit to trigger errors
    const addressInput = screen.getByLabelText('Indirizzo del server');
    await user.clear(addressInput);
    await user.click(screen.getByRole('button', { name: /entra nel server/i }));
    expect(screen.getAllByRole('alert').some((a) => a.textContent === 'L\'indirizzo del server è obbligatorio')).toBe(true);

    // Type in address field -- address error should clear
    await user.type(addressInput, 'a');
    const remaining = screen.queryAllByRole('alert');
    expect(remaining.every((a) => a.textContent !== 'L\'indirizzo del server è obbligatorio')).toBe(true);
    expect(addressInput).not.toHaveAttribute('aria-invalid');
    expect(addressInput).not.toHaveAttribute('aria-describedby');
  });

  it('clears name error when user starts typing in name field', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={() => {}} />);

    // Submit to trigger name error
    await user.click(screen.getByRole('button', { name: /entra nel server/i }));
    expect(screen.getAllByRole('alert').some((a) => a.textContent === 'Il nome del giocatore è obbligatorio')).toBe(true);

    // Type in name field -- name error should clear
    await user.type(screen.getByLabelText('Nome del giocatore'), 'x');
    const remaining = screen.queryAllByRole('alert');
    expect(remaining.every((a) => a.textContent !== 'Il nome del giocatore è obbligatorio')).toBe(true);
  });

  it('offers MTG Tracker as a real link styled as a button', () => {
    render(<JoinScreen onJoin={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'MTG Tracker' })).toHaveAttribute('href');
    expect(screen.getByText('Oppure passa a')).toBeInTheDocument();
  });
});
