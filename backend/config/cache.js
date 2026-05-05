const NodeCache = require('node-cache');

// stdTTL: standard time to live in seconds. 0 = infinity.
// checkperiod: time in seconds to check for expired keys and delete them.
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

module.exports = cache;
