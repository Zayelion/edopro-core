/**
 * Retrieves the processor stub implementation for a given type name.
 * @param {string|undefined} type Processor type identifier.
 * @returns {(field: import('./field').Field, unit: import('./processor').ProcessDescriptor) => boolean|undefined} Matching stub f
unction.
 */
function getProcessorStub(type) {
  return processorStubMap.get(type);
}

