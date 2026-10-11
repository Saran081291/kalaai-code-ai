import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SpiceChip } from '@/components/ui/SpiceChip';
import { theme } from '@/theme';

describe('SpiceChip', () => {
  it('renders the Madurai Mass label with three chilies', () => {
    render(
      <ChakraProvider theme={theme}>
        <SpiceChip level="mass" />
      </ChakraProvider>,
    );

    expect(screen.getByText('Madurai Mass')).toBeInTheDocument();
    expect(screen.getByText('🌶️🌶️🌶️')).toBeInTheDocument();
    expect(screen.getByLabelText('Spice level: Madurai Mass')).toBeInTheDocument();
  });

  it('can hide the label for compact display', () => {
    render(
      <ChakraProvider theme={theme}>
        <SpiceChip level="mild" chiliesOnly />
      </ChakraProvider>,
    );

    expect(screen.queryByText('Mild')).not.toBeInTheDocument();
    expect(screen.getByText('🌶️')).toBeInTheDocument();
  });
});
