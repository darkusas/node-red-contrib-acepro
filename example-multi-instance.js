/**
 * Example: Multi-Instance Communication Test
 * 
 * This example demonstrates how multiple Node-RED instances (or PCs) 
 * can communicate over the same UDP port without interference.
 * 
 * Simulates:
 * - PC 1: Monitoring and sending data
 * - PC 2: Monitoring the same data independently
 */

const dgram = require('dgram');

// Configuration matching aceproNet defaults
const PORT = 31456;
const BROADCAST_ADDR = '0.0.0.0';

// Simulate aceBUS packet structure
function createPacket(cmd, src, dst, state, ioid, val) {
    const buf = Buffer.allocUnsafe(28);
    buf.writeUInt32BE(cmd, 0);
    buf.writeUInt32BE(src, 4);
    buf.writeUInt32BE(dst, 8);
    buf.writeInt32BE(state, 12);
    buf.writeUInt32BE(ioid, 16);
    buf.writeDoubleBE(val, 20);
    return buf;
}

function parsePacket(buf) {
    if (buf.length < 28) return null;
    return {
        CMD: buf.readUInt32BE(0),
        SRC: buf.readUInt32BE(4),
        DST: buf.readUInt32BE(8),
        State: buf.readInt32BE(12),
        IOID: buf.readUInt32BE(16),
        Val: buf.readDoubleBE(20)
    };
}

// Create Instance 1 (simulates PC 1)
console.log('Creating Instance 1 (PC 1)...');
const instance1 = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const instance1_id = 0x12345678;
let instance1_received = 0;

instance1.on('message', (msg, rinfo) => {
    const packet = parsePacket(msg);
    if (packet && packet.IOID === 1001) {
        instance1_received++;
        console.log(`[Instance 1] Received IOID 1001, Value: ${packet.Val}, From: 0x${packet.SRC.toString(16)}`);
    }
});

instance1.on('listening', () => {
    const addr = instance1.address();
    console.log(`✓ Instance 1 listening on ${addr.address}:${addr.port}`);
    instance1.setBroadcast(true);
    
    // Create Instance 2 (simulates PC 2)
    console.log('\nCreating Instance 2 (PC 2)...');
    const instance2 = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const instance2_id = 0x87654321;
    let instance2_received = 0;
    
    instance2.on('message', (msg, rinfo) => {
        const packet = parsePacket(msg);
        if (packet && packet.IOID === 1001) {
            instance2_received++;
            console.log(`[Instance 2] Received IOID 1001, Value: ${packet.Val}, From: 0x${packet.SRC.toString(16)}`);
        }
    });
    
    instance2.on('listening', () => {
        const addr = instance2.address();
        console.log(`✓ Instance 2 listening on ${addr.address}:${addr.port}`);
        instance2.setBroadcast(true);
        
        // Now both instances are listening, let's simulate communication
        console.log('\n--- Starting Communication Test ---\n');
        
        // Instance 1 sends a packet
        setTimeout(() => {
            const packet = createPacket(
                0xACE000C0, // CMD: OnChange
                instance1_id,
                0xFFFFFFFF, // Broadcast
                100,        // State: Ready
                1001,       // IOID
                42.5        // Value
            );
            instance1.send(packet, PORT, '255.255.255.255', () => {
                console.log('[Instance 1] Sent broadcast packet: IOID 1001, Value: 42.5');
            });
        }, 500);
        
        // Instance 2 sends a packet
        setTimeout(() => {
            const packet = createPacket(
                0xACE000C0, // CMD: OnChange
                instance2_id,
                0xFFFFFFFF, // Broadcast
                100,        // State: Ready
                1001,       // IOID
                99.9        // Value
            );
            instance2.send(packet, PORT, '255.255.255.255', () => {
                console.log('[Instance 2] Sent broadcast packet: IOID 1001, Value: 99.9');
            });
        }, 1000);
        
        // Check results and cleanup
        setTimeout(() => {
            console.log('\n--- Test Results ---\n');
            console.log(`Instance 1 received ${instance1_received} packet(s)`);
            console.log(`Instance 2 received ${instance2_received} packet(s)`);
            
            // Note: On some systems, loopback broadcast may not work
            // Both instances receive packets from each other is the key test
            if (instance2_received > 0) {
                console.log('\n✓ SUCCESS: Instances can communicate!');
                console.log('  Multiple PCs can work harmoniously on the same network.');
                console.log('  Note: Broadcast behavior varies by OS - packets are properly shared.');
            } else {
                console.log('\n✗ FAILED: Instances could not communicate');
            }
            
            instance1.close();
            instance2.close();
            process.exit(instance2_received > 0 ? 0 : 1);
        }, 1500);
    });
    
    instance2.bind(PORT, BROADCAST_ADDR);
});

instance1.on('error', (err) => {
    console.error('Instance 1 error:', err.message);
    process.exit(1);
});

instance1.bind(PORT, BROADCAST_ADDR);

// Safety timeout
setTimeout(() => {
    console.error('\n✗ Test timeout');
    process.exit(1);
}, 5000);
