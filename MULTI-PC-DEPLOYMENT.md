# Multi-PC Network Deployment Guide

## Overview

This Node-RED contrib package supports running multiple instances on different PCs within the same network without interference. This is achieved through proper UDP socket configuration using the `SO_REUSEADDR` option.

## How It Works

### Unique Instance Identification
Each instance of the aceproNet node generates a unique identifier (nameCrc) by combining:
- The configured name
- A random number (0-10000)
- CRC32 hash algorithm

This ensures that even if two instances have the same name, they will have different identifiers.

### Port Sharing
The UDP socket is configured with `reuseAddr: true`, which allows multiple processes to bind to the same UDP port. This is essential for:
- Multiple Node-RED instances on different PCs
- Multiple aceproNet configurations on the same PC
- Development and production environments running simultaneously

### Packet Filtering
Each instance only processes packets that match its registered IOIDs:
1. All instances receive broadcast packets on the configured port
2. Packets are filtered by Source CRC (SRC) and IOID
3. Only packets matching registered IOIDs are processed
4. Other packets are silently ignored

## Deployment Scenarios

### Scenario 1: Multiple PCs, Same Configuration
```
PC 1: Node-RED with aceproNet (Port 31456, Broadcast 192.168.1.255)
PC 2: Node-RED with aceproNet (Port 31456, Broadcast 192.168.1.255)
PC 3: Node-RED with aceproNet (Port 31456, Broadcast 192.168.1.255)
```
✅ **Result**: All instances can coexist. Each processes its own IOIDs.

### Scenario 2: Multiple Instances on Same PC
```
Flow 1: aceproNet "Controller 1" - monitoring IOIDs 1-100
Flow 2: aceproNet "Controller 2" - monitoring IOIDs 101-200
```
✅ **Result**: Both instances share the same port without conflicts.

### Scenario 3: Overlapping IOIDs
```
PC 1: Monitoring Device A, IOID 1001
PC 2: Monitoring Device A, IOID 1001 (same device)
```
✅ **Result**: Both instances receive and process the same packets. This is useful for:
- Redundant monitoring
- Data logging on multiple systems
- Backup/failover configurations

## Best Practices

### 1. Use Descriptive Names
Give each aceproNet instance a unique, descriptive name:
```javascript
{
    "name": "Production-Floor-1",
    "BrAddress": "192.168.1.255",
    "port": 31456
}
```

### 2. Document Your IOID Allocation
Maintain a spreadsheet or document showing which IOIDs are monitored by which instance:
```
IOID 1001-1100: PC-1 (Floor Controller)
IOID 2001-2100: PC-2 (Quality Monitor)
IOID 3001-3100: PC-3 (Data Logger)
```

### 3. Use Consistent Port Configuration
All instances on the same network should use the same port number:
- Default: 31456
- Custom: Choose a port number and use it consistently

### 4. Network Bandwidth Considerations
While multiple instances work harmoniously, be aware of:
- Each instance receives ALL broadcast packets
- Network bandwidth is shared among all instances
- Consider VLAN segregation for high-traffic deployments

## Testing Multi-Instance Setup

Run the included test to verify multi-instance compatibility:
```bash
node test-multi-instance.js
```

Expected output:
```
✓ Socket 1 bound successfully to 0.0.0.0:31456
✓ Socket 2 bound successfully to 0.0.0.0:31456
✓ SUCCESS: Multiple instances CAN coexist on the same network!
```

## Troubleshooting

### Error: EADDRINUSE
If you see this error, it means you're running an older version without SO_REUSEADDR support.
- **Solution**: Update to version 2.0.1 or later

### Packets Not Being Received
Check:
1. All instances use the same port number
2. Broadcast address matches your network configuration
3. Firewall allows UDP traffic on the configured port
4. IOIDs are correctly registered

### Duplicate Processing
If the same packet is processed multiple times:
- This is expected when multiple instances monitor the same IOID
- Design your flows to handle potential duplicates
- Use message deduplication if needed

## Technical Details

### Socket Configuration
```javascript
// Socket creation with reuseAddr enabled
var srv = udp.createSocket({ type: 'udp4', reuseAddr: true });

// Binding to port and broadcast address
srv.bind(port, BrCastAddr, function() {
    srv.setBroadcast(true);
});
```

### Packet Structure
Each packet contains:
- CMD: Command type (0xACE00040, 0xACE00080, 0xACE000C0)
- SRC: Source device CRC32
- DST: Destination CRC32
- State: Current state
- IOID: I/O Identifier
- Val: Double-precision value

### Filtering Logic
```javascript
let key = RxPak.SRC.toString(16).toUpperCase() + "_" + RxPak.IOID;
if(IOIDobj_list[key] !== undefined) {
    // Process packet
}
```

## Version History

- **v2.0.1**: Added SO_REUSEADDR support for multi-instance compatibility
- **v2.0.0**: Initial stable release

## Support

For issues or questions about multi-PC deployments:
- GitHub Issues: https://github.com/darkusas/node-red-contrib-acepro/issues
- Include your network topology diagram
- Specify which instances are having issues
