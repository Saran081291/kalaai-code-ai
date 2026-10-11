import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { FileDropzone } from '@/components/submissions/FileDropzone';
import { MAX_UPLOAD_BYTES, validateUploadFiles } from '@/components/submissions/uploadRules';

import { renderWithProviders } from '../test-utils';

function makeFile(name: string, size = 100): File {
  const file = new File(['x'], name, { type: 'text/plain' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function Harness({ initial = [] }: { initial?: File[] }) {
  const [files, setFiles] = useState<File[]>(initial);
  return <FileDropzone files={files} onFilesChange={setFiles} />;
}

function drop(files: File[]) {
  fireEvent.drop(screen.getByTestId('file-dropzone'), { dataTransfer: { files } });
}

describe('validateUploadFiles', () => {
  it('accepts allowed code files', () => {
    expect(validateUploadFiles([makeFile('main.py'), makeFile('App.tsx'), makeFile('README.md')])).toEqual([]);
  });

  it('accepts exactly one zip', () => {
    expect(validateUploadFiles([makeFile('project.zip')])).toEqual([]);
  });

  it('rejects two zips', () => {
    expect(validateUploadFiles([makeFile('a.zip'), makeFile('b.zip')])[0]).toMatch(/Only one \.zip/);
  });
});

describe('FileDropzone', { timeout: 15_000 }, () => {
  it('lists dropped files with sizes and lets you remove them', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    drop([makeFile('main.py', 2048), makeFile('utils.js', 512)]);

    expect(screen.getByText('main.py')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('512 B')).toBeInTheDocument();
    expect(screen.getByText('2 files selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove main.py' }));
    expect(screen.queryByText('main.py')).not.toBeInTheDocument();
    expect(screen.getByText('1 file selected')).toBeInTheDocument();
  });

  it('adds files picked through the hidden file input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.upload(screen.getByTestId('file-input'), makeFile('Solution.java'));
    expect(screen.getByText('Solution.java')).toBeInTheDocument();
  });

  it('shows an error when the total size is over 5 MB', () => {
    renderWithProviders(<Harness />);
    drop([makeFile('big.py', MAX_UPLOAD_BYTES), makeFile('more.py', 1024 * 1024)]);

    expect(screen.getByRole('alert')).toHaveTextContent('Total size is 6.00 MB — the limit is 5 MB.');
  });

  it('shows an error when more than 50 files are selected', () => {
    renderWithProviders(<Harness />);
    drop(Array.from({ length: 51 }, (_, i) => makeFile(`file${i}.py`)));

    expect(screen.getByRole('alert')).toHaveTextContent('Too many files: 51 selected — the limit is 50.');
  });

  it('shows an error for an unsupported extension', () => {
    renderWithProviders(<Harness />);
    drop([makeFile('main.py'), makeFile('virus.exe')]);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Unsupported file type: virus.exe.');
    expect(alert).not.toHaveTextContent('main.py');
  });

  it('shows an error when a zip is mixed with code files', () => {
    renderWithProviders(<Harness />);
    drop([makeFile('project.zip'), makeFile('main.py')]);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Upload either one .zip file or individual code files — not both together.',
    );
  });

  it('has no errors for a valid selection', () => {
    renderWithProviders(<Harness />);
    drop([makeFile('main.py'), makeFile('styles.css')]);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
