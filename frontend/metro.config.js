const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration for RallyRing
 * We explicitly set projectRoot to this directory to prevent Metro from
 * accidentally traversing up into the monorepo root and using wrong node_modules.
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
    // Explicitly set the project root to the frontend directory
    projectRoot: __dirname,
    // Watch only the frontend folder (ignore root monorepo node_modules)
    watchFolders: [__dirname],
    resolver: {
        // Ensure our own node_modules is always first
        nodeModulesPaths: [
            path.resolve(__dirname, 'node_modules'),
        ],
        // Block packages from being resolved from monorepo root
        blockList: [
            // Prevent traversal into backend
            new RegExp(`${path.resolve(__dirname, '..', 'backend').replace(/\\/g, '\\\\')}.*`),
        ],
    },
};

module.exports = mergeConfig(defaultConfig, config);
