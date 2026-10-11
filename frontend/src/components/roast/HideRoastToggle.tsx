import { FormControl, FormLabel, Stack, Switch, Text } from '@chakra-ui/react';

export interface HideRoastToggleProps {
  isHidden: boolean;
  onToggle: (isHidden: boolean) => void;
  isLoading?: boolean;
}

/** Instructor: hide an inappropriate/unfunny roast from the student and the Roast Wall. */
export function HideRoastToggle({ isHidden, onToggle, isLoading = false }: HideRoastToggleProps) {
  return (
    <Stack spacing={1}>
      <FormControl display="flex" alignItems="center" gap={3}>
        <Switch
          id="roast-hidden"
          colorScheme="red"
          isChecked={isHidden}
          isDisabled={isLoading}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <FormLabel htmlFor="roast-hidden" mb={0} fontWeight={600}>
          Hide roast from student
        </FormLabel>
      </FormControl>
      <Text fontSize="sm" color="text.muted">
        Hidden roasts are not shown to the student, are removed from the Roast Wall, and their public link stops
        working. The review and score are not affected.
      </Text>
    </Stack>
  );
}

export default HideRoastToggle;
