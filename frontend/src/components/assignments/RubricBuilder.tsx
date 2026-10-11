import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  IconButton,
  Input,
  Text,
  Textarea,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { FiArrowDown, FiArrowUp, FiPlus, FiSliders, FiTrash2 } from 'react-icons/fi';

import { EmptyState } from '@/components/ui/EmptyState';

import { autoBalance, CRITERION_NAME_MAX, emptyCriterion, rubricTotal, type RubricCriterionDraft } from './rubric';
import { RubricTotalIndicator } from './RubricTotalIndicator';

export interface RubricBuilderProps {
  criteria: RubricCriterionDraft[];
  onChange: (next: RubricCriterionDraft[]) => void;
  /** Target total; the indicator compares the rubric sum against it. */
  maxScore: number;
  isDisabled?: boolean;
}

/** Add / remove / reorder rubric criteria with a live total-vs-max indicator. */
export function RubricBuilder({ criteria, onChange, maxScore, isDisabled = false }: RubricBuilderProps) {
  const total = rubricTotal(criteria);

  const updateRow = (index: number, patch: Partial<RubricCriterionDraft>) => {
    onChange(criteria.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeRow = (index: number) => {
    onChange(criteria.filter((_, i) => i !== index));
  };

  const moveRow = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= criteria.length) return;
    const next = [...criteria];
    const [row] = next.splice(index, 1);
    if (row) next.splice(target, 0, row);
    onChange(next);
  };

  const addRow = () => onChange([...criteria, emptyCriterion()]);

  const canAutoBalance = criteria.length > 0 && maxScore >= criteria.length && !isDisabled;

  return (
    <VStack align="stretch" spacing={4}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
        <RubricTotalIndicator total={total} maxScore={maxScore} />
        <HStack spacing={2}>
          <Tooltip label={`Split ${maxScore} points evenly across criteria`} hasArrow>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<FiSliders />}
              onClick={() => onChange(autoBalance(criteria, maxScore))}
              isDisabled={!canAutoBalance}
            >
              Auto-balance
            </Button>
          </Tooltip>
          <Button size="sm" leftIcon={<FiPlus />} onClick={addRow} isDisabled={isDisabled}>
            Add criterion
          </Button>
        </HStack>
      </Flex>

      {criteria.length === 0 ? (
        <EmptyState
          emoji="📏"
          title="No criteria yet"
          description="Rubric illama review panna mudiyadhu! Add at least one criterion before publishing."
        />
      ) : (
        <VStack as="ol" align="stretch" spacing={3} listStyleType="none" aria-label="Rubric criteria">
          {criteria.map((criterion, index) => {
            const n = index + 1;
            return (
              <Box
                as="li"
                key={criterion.key}
                p={4}
                borderWidth="1px"
                borderColor="border.subtle"
                borderRadius="xl"
                bg="bg.surface"
                data-testid="rubric-row"
              >
                <Grid templateColumns={{ base: '1fr', md: '1fr 120px auto' }} gap={3} alignItems="end">
                  <FormControl isRequired>
                    <FormLabel fontSize="sm" mb={1}>
                      Criterion {n} name
                    </FormLabel>
                    <Input
                      aria-label={`Criterion ${n} name`}
                      value={criterion.name}
                      onChange={(e) => updateRow(index, { name: e.target.value })}
                      placeholder="e.g. Correctness"
                      maxLength={CRITERION_NAME_MAX}
                      isDisabled={isDisabled}
                      borderRadius="lg"
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm" mb={1}>
                      Points
                    </FormLabel>
                    <Input
                      aria-label={`Criterion ${n} points`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={criterion.maxPoints}
                      onChange={(e) => updateRow(index, { maxPoints: e.target.value })}
                      placeholder="25"
                      isDisabled={isDisabled}
                      borderRadius="lg"
                    />
                  </FormControl>
                  <HStack spacing={1} justify={{ base: 'flex-end', md: 'flex-start' }}>
                    <IconButton
                      aria-label={`Move criterion ${n} up`}
                      icon={<FiArrowUp />}
                      size="sm"
                      variant="ghost"
                      onClick={() => moveRow(index, -1)}
                      isDisabled={isDisabled || index === 0}
                    />
                    <IconButton
                      aria-label={`Move criterion ${n} down`}
                      icon={<FiArrowDown />}
                      size="sm"
                      variant="ghost"
                      onClick={() => moveRow(index, 1)}
                      isDisabled={isDisabled || index === criteria.length - 1}
                    />
                    <IconButton
                      aria-label={`Remove criterion ${n}`}
                      icon={<FiTrash2 />}
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => removeRow(index)}
                      isDisabled={isDisabled}
                    />
                  </HStack>
                </Grid>
                <FormControl mt={3}>
                  <FormLabel fontSize="sm" mb={1}>
                    Description
                  </FormLabel>
                  <Textarea
                    aria-label={`Criterion ${n} description`}
                    value={criterion.description}
                    onChange={(e) => updateRow(index, { description: e.target.value })}
                    placeholder="What does full marks look like?"
                    rows={2}
                    isDisabled={isDisabled}
                    borderRadius="lg"
                  />
                </FormControl>
              </Box>
            );
          })}
        </VStack>
      )}
      <Text fontSize="xs" color="text.muted">
        The AI scores each submission against these criteria, so be specific. Total must equal the max score to
        publish.
      </Text>
    </VStack>
  );
}

export default RubricBuilder;
