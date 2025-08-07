/**
 * Basic test for aceprolib.js
 * 
 * This provides minimal test coverage for the library functions
 * to ensure they work as expected.
 */

const aceprolib = require('./aceprolib');

// Simple test framework
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (error) {
        console.error(`✗ ${name}: ${error.message}`);
        process.exit(1);
    }
}

// Test library structure
test('Library exports expected structure', () => {
    if (!aceprolib.version) throw new Error('Missing version');
    if (!aceprolib.constants) throw new Error('Missing constants');
    if (!aceprolib.utils) throw new Error('Missing utils');
});

// Test version
test('Version is correct', () => {
    if (aceprolib.version !== "1.3.7") {
        throw new Error(`Expected version 1.3.7, got ${aceprolib.version}`);
    }
});

// Test constants
test('Constants are defined', () => {
    const { constants } = aceprolib;
    if (constants.CMD_GetVal !== 0xACE00040) {
        throw new Error('CMD_GetVal constant incorrect');
    }
    if (constants.CMD_SetVal !== 0xACE00080) {
        throw new Error('CMD_SetVal constant incorrect');
    }
    if (constants.CMD_OnChange !== 0xACE000C0) {
        throw new Error('CMD_OnChange constant incorrect');
    }
});

// Test utility functions
test('isEmptyObject works correctly', () => {
    const { utils } = aceprolib;
    
    if (!utils.isEmptyObject({})) {
        throw new Error('Empty object should return true');
    }
    
    if (utils.isEmptyObject({a: 1})) {
        throw new Error('Non-empty object should return false');
    }
});

test('isValidPacket works correctly', () => {
    const { utils } = aceprolib;
    
    // Test with null/undefined
    if (utils.isValidPacket(null)) {
        throw new Error('Null should return false');
    }
    
    if (utils.isValidPacket(undefined)) {
        throw new Error('Undefined should return false');
    }
    
    // Test with too short buffer
    const shortBuffer = Buffer.alloc(20);
    if (utils.isValidPacket(shortBuffer)) {
        throw new Error('Short buffer should return false');
    }
    
    // Test with valid buffer
    const validBuffer = Buffer.alloc(28);
    if (!utils.isValidPacket(validBuffer)) {
        throw new Error('Valid buffer should return true');
    }
});

console.log('\nAll tests passed! ✅');