const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration for RallyRing
 * We explicitly set projectRoot to this directory to prevent Metro from
 * accidentally traversing up into the monorepo root and using wrong node_modules.
 */
const defaultConfig = getDefaultConfig(__dirname);

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = {
    // Explicitly set the project root to the frontend directory
    projectRoot: projectRoot,
    // Watch both frontend and monorepo root node_modules
    watchFolders: [workspaceRoot],
    resolver: {
        // Ensure we check both local and monorepo node_modules
        nodeModulesPaths: [
            path.resolve(projectRoot, 'node_modules'),
            path.resolve(workspaceRoot, 'node_modules'),
        ],
    },
};

module.exports = mergeConfig(defaultConfig, config);
