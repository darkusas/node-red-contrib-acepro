node-red-contrib-acepro
=====================

<a href="http://nodered.org" target="_new">Node-RED</a> nodes to talk to aceBUS devices (proprietary of company ACEPRO).

## Description

This package provides Node-RED nodes for communicating with ACEPRO devices via the aceBUS protocol. It includes nodes for both reading from and writing to ACEPRO devices over UDP.

## Installation
-------

Run the following command in your Node-RED user directory - typically `~/.node-red`

        npm install node-red-contrib-acepro

## Usage
-----

The package provides several nodes for different use cases:

### aceproNet (Configuration Node)

The main configuration node that handles UDP communication with aceBUS devices.

**Configuration:**
- **Name**: Unique identifier for this connection
- **Broadcast Address**: IP address for UDP broadcast
- **Port**: UDP port number for communication

### aceproIOID in/out

Basic input/output nodes for single IOID communication.

**Input Node** - Receives values from aceBUS devices:
- Outputs received value in `msg.payload`
- Topic format: `{host}_{IOID}`

**Output Node** - Sends values to aceBUS devices:
- Input value from `msg.payload`
- Must be numeric value

### aceproMultiIOID in/out

Advanced nodes for handling multiple IOIDs simultaneously.

**Configuration:**
- Multiple IOID definitions in JSON format
- Supports grouping and statistical analysis
- Optional live status display

## Example Flow

```json
[
    {
        "id": "network1",
        "type": "aceproNet",
        "name": "ACEPRO Network",
        "BrAddress": "192.168.1.255",
        "port": "12345"
    },
    {
        "id": "input1", 
        "type": "aceproIOID in",
        "network": "network1",
        "host": "192.168.1.100",
        "IOID": "1001",
        "LiveStatus": true
    }
]
```

## API

### aceprolib

The package includes a library module with common utilities:

```javascript
const aceprolib = require('node-red-contrib-acepro');

// Access constants
const cmdGetVal = aceprolib.constants.CMD_GetVal;

// Use utilities
const isEmpty = aceprolib.utils.isEmptyObject({});
```

## Testing

Run the test suite with:

        npm test

## Requirements

- Node.js 10.0 or higher
- Node-RED 1.0 or higher

## License

Apache License 2.0 - See LICENSE file for details.

## Support

For issues and questions, please use the GitHub issue tracker.


