/**
 * Test to verify that multiple instances can bind to the same UDP port
 * This demonstrates multi-PC network compatibility
 */

const dgram = require('dgram');

console.log('Testing multi-instance UDP socket binding with SO_REUSEADDR...\n');

// Test port and address
const TEST_PORT = 31456;
const TEST_ADDR = '0.0.0.0';

// Create first socket (simulating first PC/instance)
const socket1 = dgram.createSocket({ type: 'udp4', reuseAddr: true });

socket1.on('error', (err) => {
    console.error('Socket 1 error:', err.message);
    process.exit(1);
});

socket1.on('listening', () => {
    const addr = socket1.address();
    console.log(`✓ Socket 1 bound successfully to ${addr.address}:${addr.port}`);
    
    // Create second socket (simulating second PC/instance)
    const socket2 = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    
    socket2.on('error', (err) => {
        console.error('✗ Socket 2 error:', err.message);
        console.error('  Multiple instances CANNOT coexist on the same network');
        socket1.close();
        process.exit(1);
    });
    
    socket2.on('listening', () => {
        const addr2 = socket2.address();
        console.log(`✓ Socket 2 bound successfully to ${addr2.address}:${addr2.port}`);
        console.log('\n✓ SUCCESS: Multiple instances CAN coexist on the same network!');
        console.log('  Both sockets are bound to the same port without conflicts.\n');
        
        // Cleanup
        socket1.close();
        socket2.close();
        process.exit(0);
    });
    
    // Bind second socket to same port
    socket2.bind(TEST_PORT, TEST_ADDR, () => {
        socket2.setBroadcast(true);
    });
});

// Bind first socket
socket1.bind(TEST_PORT, TEST_ADDR, () => {
    socket1.setBroadcast(true);
});

// Timeout safety
setTimeout(() => {
    console.error('✗ Test timeout');
    process.exit(1);
}, 5000);
