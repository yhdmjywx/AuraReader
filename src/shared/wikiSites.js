/** @param {unknown} site @returns {site is string} */
function validWikiSite(site) { return typeof site === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(site); }
/** @param {unknown} value @param {string} [site] */
function wikipediaUrl(value, site) {
    if (typeof value !== 'string') throw new Error('Invalid Wikipedia link.');
    const url = new URL(value);
    const edition = url.hostname.slice(0, -'.wikipedia.org'.length);
    if (url.protocol !== 'https:' || url.port || url.username || url.password
        || !url.hostname.endsWith('.wikipedia.org') || !validWikiSite(edition)
        || (site && edition !== site) || !(url.pathname.startsWith('/wiki/') || url.pathname === '/w/index.php')) {
        throw new Error('Invalid Wikipedia link.');
    }
    return url;
}
/** @param {unknown} value */
function licenseUrl(value) {
    if (typeof value !== 'string') throw new Error('Invalid Wikipedia license.');
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'creativecommons.org' || url.port || url.username || url.password
        || !/^\/licenses\/by-sa\/[0-9.]+\/(?:deed\.[a-zA-Z-]+)?$/.test(url.pathname) || url.search || url.hash) {
        throw new Error('Invalid Wikipedia license.');
    }
    return url;
}
/** @param {unknown} value */
function wikiExternalUrl(value) {
    try { return wikipediaUrl(value).href; } catch { return licenseUrl(value).href; }
}
module.exports = { validWikiSite, wikipediaUrl, licenseUrl, wikiExternalUrl };
