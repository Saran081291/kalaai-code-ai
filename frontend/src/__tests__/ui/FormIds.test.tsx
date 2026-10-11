import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PasswordField } from '@/components/auth/PasswordField';
import { AnimatedInput } from '@/components/ui/AnimatedInput';

import { renderWithProviders } from '../test-utils';

describe('label association with a custom id', () => {
  it('AnimatedInput keeps label -> input association', () => {
    renderWithProviders(<AnimatedInput id="custom-email" label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('id', 'custom-email');
    expect(screen.getByText('Email').closest('label')).toHaveAttribute('for', 'custom-email');
  });

  it('PasswordField keeps label -> input association', () => {
    renderWithProviders(<PasswordField id="custom-pw" label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('id', 'custom-pw');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('still associates without an explicit id', () => {
    renderWithProviders(<AnimatedInput label="Name" />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });
});
