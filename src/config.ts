export const config = {
  destinationSelectionEnabled: import.meta.env.VITE_DESTINATION_SELECTION_ENABLED !== 'false',
  name: 'Message Studio', owner: 'Sriram Advisory', publicUrl: import.meta.env.VITE_PUBLIC_URL || '',
  schemaVersion: 1, advisoryLimit: 3000, cautionRatio: .9, sourceLimit: 50000, draftLimit: 50,
  snippetLimit: 100, snippetUnits: 10000, importBytes: 10 * 1024 * 1024, autosaveMs: 500, checksMs: 150,
  recoveryLimit: 20, historyDepth: 100, emphasisRatio: .2, previewMobile: 360, previewDesktop: 600,
  emojiVersion: '16.0.0', mobileBreakpoint: 768, maxWidth: 1200,
} as const;
