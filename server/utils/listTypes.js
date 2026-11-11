'use strict'

const LIST_TYPES = ['black', 'white']
const DEFAULT_LIST_TYPE = 'black'

function normalizeListType(value) {
  return String(value ?? '').trim().toLowerCase() === 'white'
    ? 'white'
    : DEFAULT_LIST_TYPE
}

function isListType(value) {
  return LIST_TYPES.includes(String(value ?? '').trim().toLowerCase())
}

module.exports = {
  LIST_TYPES,
  DEFAULT_LIST_TYPE,
  normalizeListType,
  isListType
}
