import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JoinScreen from './JoinScreen';

describe('JoinScreen', () => {
  it('renders the ZAFF title', () => {
    render(<JoinScreen onJoin={() => {}} />);
    expect(screen.getByText('ZAFF')).toBeInTheDocument();
  });

  it('renders the server address input and join button', () => {
    render(<JoinScreen onJoin={() => {}} />);
    expect(screen.getByLabelText('Server Address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join server/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting empty input', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={() => {}} />);

    await user.click(screen.getByRole('button', { name: /join server/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Server address is required');
  });

  it('calls onJoin with the entered address on valid submit', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<JoinScreen onJoin={onJoin} />);

    const input = screen.getByLabelText('Server Address');
    await user.type(input, 'ws://192.168.1.5:8080');
    await user.click(screen.getByRole('button', { name: /join server/i }));

    expect(onJoin).toHaveBeenCalledWith('ws://192.168.1.5:8080');
  });

  it('trims whitespace from the address before calling onJoin', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<JoinScreen onJoin={onJoin} />);

    const input = screen.getByLabelText('Server Address');
    await user.type(input, '  ws://localhost:8080  ');
    await user.click(screen.getByRole('button', { name: /join server/i }));

    expect(onJoin).toHaveBeenCalledWith('ws://localhost:8080');
  });

  it('clears validation error when user starts typing', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={() => {}} />);

    // Submit empty to trigger error
    await user.click(screen.getByRole('button', { name: /join server/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Type something -- error should clear
    await user.type(screen.getByLabelText('Server Address'), 'a');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
