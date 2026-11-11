export default {
  app: {
    eyebrow: 'List console',
    title: 'List Management',
    totalRecords: 'Total records: {total}',
    languageSwitch: 'Switch language'
  },
  type: {
    all: 'All types',
    black: 'Blacklist',
    white: 'Whitelist',
    filterLabel: 'Filter by list type'
  },
  toolbar: {
    aria: 'Search and actions',
    searchName: 'Search name',
    searchMap: 'Search map',
    search: 'Search',
    reset: 'Reset',
    imageScan: 'Scan screenshot',
    add: 'Add entry'
  },
  table: {
    id: 'ID',
    name: 'Name',
    type: 'Type',
    map: 'Map',
    reason: 'Reason for adding',
    addTime: 'Added at',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    empty: 'No list entries',
    emptyFiltered: 'No matching entries. Try adjusting the filters.',
    emptyHint: 'Click “Add entry” to create the first one.',
    footer: 'Active entries only · Newest first',
    deleteTitle: 'Delete entry',
    deleteConfirm:
      'Delete “{name}”? The entry will be hidden from the list.',
    cancel: 'Cancel',
    confirmDelete: 'Delete',
    deleteSuccess: 'Entry deleted'
  },
  form: {
    createTitle: 'Add List Entry',
    editTitle: 'Edit List Entry',
    createSubtitle:
      'Choose a list type and fill in the details. The ID and added time are generated automatically.',
    editSubtitle: 'Update the list type, name, map, or reason.',
    listTypeLabel: 'List type',
    blacklistHint: 'Players to avoid or review.',
    whitelistHint: 'Trusted players, useful for reducing false positives.',
    nameLabel: 'Name',
    nameField: 'Name',
    namePlaceholder: 'Enter a name',
    mapLabel: 'Map',
    mapField: 'Map',
    mapPlaceholder: 'Enter the map manually',
    reasonLabel: 'Reason for adding to the list',
    reasonField: 'Reason for adding to the list',
    reasonPlaceholder: 'Explain why this player is being added',
    requiredHint: 'Required fields',
    cancel: 'Cancel',
    create: 'Add entry',
    save: 'Save changes',
    createSuccess: 'Entry added',
    updateSuccess: 'Entry updated',
    validation: {
      nameRequired: 'Please enter a name',
      mapRequired: 'Please enter a map',
      reasonRequired: 'Please enter a reason',
      maxLength: '{label} must be at most {max} characters'
    }
  },
  scan: {
    title: 'WC3 Lobby Screenshot Check',
    subtitle:
      'Upload a WC3 lobby screenshot to recognize every player row and match both lists. Single-row screenshots are also supported.',
    uploadPrefix: 'Drag a WC3 lobby screenshot here, or',
    chooseFile: 'click to choose',
    uploadHint:
      'Full lobby or single player row · PNG / JPG / WebP, up to 8MB',
    imageAlt: 'WC3 lobby screenshot preview',
    chooseAnother: 'Choose another',
    scanningTitle: 'Recognizing lobby players…',
    scanningHint:
      'The OCR model may take a few seconds to load on first use.',
    scanError:
      'Screenshot recognition failed. Please try a clearer WC3 lobby screenshot.',
    close: 'Close',
    scanAndMatch: 'Scan & match',
    anotherImage: 'Choose another image',
    privacy:
      'The screenshot is used only for this check and is never written to disk.',
    noHits: 'No list match',
    blacklistHits: 'Blacklist hits: {count}',
    whitelistHits: 'Whitelist hits: {count}',
    mixedHits: 'Blacklist: {black} · Whitelist: {white}',
    recognizedText:
      'Recognized names: {count}. Correct them below and search again if needed.',
    recognizedTitle: 'Recognized names',
    host: 'Host',
    emptyNames:
      'No player names recognized. Add names below and search again.',
    hitsTitle: 'List matches',
    blacklistHitsTitle: 'Blacklist matches',
    whitelistHitsTitle: 'Whitelist matches',
    recognizedAs: 'Recognized as {name}',
    map: 'Map: {map}',
    addedAt: 'Added: {time}',
    manualTitle: 'Correct recognized names',
    manualHint:
      'One player name per line. Fix any OCR mistakes and search again.',
    rematch: 'Search again',
    manualPlaceholder: 'Enter one player name per line',
    invalidType: 'Only PNG, JPG, and WebP images are supported.',
    imageTooLarge: 'Image size must not exceed 8MB.',
    noNamesError: 'Enter at least one player name.',
    tooManyNames: 'You can check at most 32 player names at a time.',
    nameTooLong: 'Each player name must be at most 50 characters.',
    hitsFound: 'Blacklist: {black} · Whitelist: {white}',
    recognizedNoHits: 'Recognized names: {count}. No list match.',
    noNamesTitle:
      'No player names recognized. Please try a clearer lobby screenshot.',
    rematchHits: 'Search completed. Blacklist: {black} · Whitelist: {white}',
    rematchNoHits: 'Search completed. No list match.',
    matchType: {
      exact: 'Exact match',
      normalized: 'Ignoring punctuation',
      fuzzy: 'Fuzzy match',
      fallback: 'Matched'
    }
  },
  request: {
    invalidResponse: 'Invalid response format.',
    failed: 'Request failed. Please try again.',
    timeout: 'Request timed out. Please try again.',
    network: 'Network error. Please make sure the backend service is running.',
    http: 'Request failed (HTTP {status})',
    invalid: 'Invalid request. Please check the form.',
    notFound: 'Entry not found or already deleted.',
    methodNotAllowed: 'Request method not allowed.',
    tooLarge:
      'The request is too large. Images must be 8MB or smaller.',
    ocrFailed:
      'Unable to recognize the screenshot. Please try a clearer image.',
    serverError: 'Server error. Please try again later.'
  },
  language: {
    label: 'Language',
    english: 'English',
    chinese: '中文',
    englishShort: 'EN',
    chineseShort: '中文'
  }
}
