export const cleanBase64 = (input: string) => {
  if (!input) {
    return '';
  }

  if (input.startsWith('data:')) {
    return input.substring(input.indexOf(',') + 1);
  }

  return input;
};

export function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.');

  if (lastDotIndex > 0 && lastDotIndex < fileName.length - 1) {
    return fileName.slice(lastDotIndex + 1).toLowerCase();
  }

  return '';
}
