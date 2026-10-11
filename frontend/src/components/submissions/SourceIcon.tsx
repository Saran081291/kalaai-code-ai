import { Icon, Tooltip, type IconProps } from '@chakra-ui/react';
import { FiGithub, FiUploadCloud } from 'react-icons/fi';

import type { SourceType } from '@/types';

export interface SourceIconProps {
  sourceType: SourceType;
  boxSize?: IconProps['boxSize'];
}

const SOURCE_LABEL: Record<SourceType, string> = {
  github: 'GitHub repository',
  upload: 'File upload',
};

/** GitHub / upload glyph with an accessible label + tooltip. */
export function SourceIcon({ sourceType, boxSize = 4 }: SourceIconProps) {
  const label = SOURCE_LABEL[sourceType];
  return (
    <Tooltip label={label} hasArrow openDelay={300}>
      <span>
        <Icon
          as={sourceType === 'github' ? FiGithub : FiUploadCloud}
          boxSize={boxSize}
          color="text.muted"
          role="img"
          aria-label={label}
          data-source={sourceType}
        />
      </span>
    </Tooltip>
  );
}

export default SourceIcon;
