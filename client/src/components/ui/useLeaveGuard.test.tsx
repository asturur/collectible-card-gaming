import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLeaveGuard } from './useLeaveGuard';

// Router finto: una navigazione vera con il router di dati nel test usa il fetch di Node,
// che su Node 24 rifiuta l'AbortSignal di jsdom. Qui basta la regola del blocco e la navigazione.
const navigate = vi.fn();
let shouldBlock: (args: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) => boolean;

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useBeforeUnload: () => {},
  useBlocker: (fn: typeof shouldBlock) => {
    shouldBlock = fn;
    return { state: 'unblocked', reset: vi.fn(), proceed: vi.fn() };
  },
}));

const leavingForm = { currentLocation: { pathname: '/games/new' }, nextLocation: { pathname: '/games' } };

describe('useLeaveGuard', () => {
  beforeEach(() => navigate.mockClear());

  it('blocks an ordinary navigation away, so the user is asked first', () => {
    renderHook(() => useLeaveGuard('Uscire?'));
    expect(shouldBlock(leavingForm)).toBe(true);
  });

  it('leaves without a second question once the user already confirmed', () => {
    const { result } = renderHook(() => useLeaveGuard('Uscire?'));
    result.current.leave('/games');
    expect(navigate).toHaveBeenCalledWith('/games');
    expect(shouldBlock(leavingForm)).toBe(false);
  });
});
