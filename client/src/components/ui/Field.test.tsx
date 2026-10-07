import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SelectField, TextAreaField, TextField } from './Field';

describe('shared field descriptions', () => {
  it('associates hints and errors without losing a caller-provided description', () => {
    render(
      <>
        <p id="external-help">Names are shared with the group.</p>
        <TextField label="Name" hint="Use your usual name." error="Name is required."
          aria-describedby="external-help" />
      </>
    );

    const field = screen.getByLabelText('Name');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Names are shared with the group. Use your usual name. Name is required.');
  });

  it('keeps automatically generated labels and descriptions distinct', () => {
    render(
      <>
        <TextField label="First player" hint="First hint" />
        <TextField label="Second player" hint="Second hint" />
      </>
    );

    const first = screen.getByLabelText('First player');
    const second = screen.getByLabelText('Second player');
    expect(first.id).not.toBe(second.id);
    expect(first).toHaveAccessibleDescription('First hint');
    expect(second).toHaveAccessibleDescription('Second hint');
  });

  it('associates select and textarea feedback and removes errors when resolved', () => {
    const { rerender } = render(
      <>
        <SelectField label="Format" error="Choose a format."><option value="">Choose</option></SelectField>
        <TextAreaField label="Notes" hint="Optional notes." error="Notes are too long." />
      </>
    );

    expect(screen.getByLabelText('Format')).toHaveAccessibleDescription('Choose a format.');
    expect(screen.getByLabelText('Format')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('Optional notes. Notes are too long.');
    expect(screen.getByLabelText('Notes')).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <>
        <SelectField label="Format"><option value="">Choose</option></SelectField>
        <TextAreaField label="Notes" hint="Optional notes." />
      </>
    );

    expect(screen.getByLabelText('Format')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('Optional notes.');
    expect(screen.getByLabelText('Notes')).not.toHaveAttribute('aria-invalid');
  });
});
