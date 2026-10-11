import { MotionBox, type MotionBoxProps } from './motion';

export type PageWrapperProps = MotionBoxProps;

/** Every page is wrapped in this: centered container + fade/slide-in on enter. */
export function PageWrapper({ children, maxW = '6xl', ...rest }: PageWrapperProps) {
  return (
    <MotionBox
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
      w="full"
      maxW={maxW}
      mx="auto"
      px={{ base: 4, md: 6 }}
      py={{ base: 6, md: 8 }}
      {...rest}
    >
      {children}
    </MotionBox>
  );
}

export default PageWrapper;
