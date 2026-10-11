import { AnimatedInput } from '@/components/ui/AnimatedInput';

export interface GitHubUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Validation message to show (parent decides when, e.g. after blur/submit). */
  error?: string;
  isDisabled?: boolean;
}

export const GITHUB_URL_ERROR = 'Enter a public GitHub repository URL like https://github.com/owner/repo';

/** Labelled URL input for a public GitHub repo. */
export function GitHubUrlInput({ value, onChange, onBlur, error, isDisabled = false }: GitHubUrlInputProps) {
  return (
    <AnimatedInput
      name="githubUrl"
      type="url"
      inputMode="url"
      autoComplete="url"
      label="GitHub repository URL"
      placeholder="https://github.com/your-name/your-repo"
      helperText="Public repo mattum dhaan, thambi"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      error={error}
      isDisabled={isDisabled}
      isRequired
    />
  );
}

export default GitHubUrlInput;
