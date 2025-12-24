const basePayload = "Lazy data loaded successfully";
const absPayload = "Absolute+QH OK";

// When the module is imported with a query/hash (absolute path in tests), emit
// a distinct payload so we can assert query+hash resolution works end-to-end.
const isAbsVariant = (
    typeof import.meta !== 'undefined' &&
    import.meta.url &&
    import.meta.url.includes('?x=1') &&
    import.meta.url.includes('#frag')
);

const payload = isAbsVariant ? absPayload : basePayload;

export const detail = payload;
export default payload;
