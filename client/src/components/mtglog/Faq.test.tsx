import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Faq from './Faq';
import { FAQ_SECTIONS } from './faqContent';

describe('FAQ Statistiche', () => {
  it('has one topic for every view of Statistiche Carte, so its link always lands on the right one', () => {
    const cards = FAQ_SECTIONS.find((s) => s.id === 'cards');
    expect(cards?.topics.map((t) => t.id)).toEqual(['played', 'winners', 'losers', 'staples', 'signature', 'colors', 'cursed']);
    const ids = FAQ_SECTIONS.flatMap((s) => s.topics.map((t) => `${s.id}/${t.id}`));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('falls back to the first section and topic for an unknown address', () => {
    render(<MemoryRouter><Faq sectionId="nope" topicId="nope" /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Regole comuni', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /Argomenti/ })).not.toBeInTheDocument();
  });

  it('shows the thresholds used by the calculations', () => {
    render(<MemoryRouter><Faq sectionId="cards" topicId="winners" /></MemoryRouter>);
    const topics = within(screen.getByRole('navigation', { name: 'Argomenti di Carte' }));
    expect(topics.getByRole('link', { name: 'Più vincenti' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByText(/5 presenze/).length).toBeGreaterThan(0);
  });
});
