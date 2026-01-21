export enum CartMergeStrategy {
  REPLACE_GUEST = 'replace_guest', // Keep user cart, discard guest cart
  REPLACE_USER = 'replace_user', // Keep guest cart, discard user cart
  MERGE_COMBINE = 'merge_combine', // Combine quantities for duplicates
  MERGE_PROMPT = 'merge_prompt', // Let user choose (for future UI implementation)
}
