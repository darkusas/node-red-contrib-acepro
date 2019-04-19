node-red-contrib-acepro
=====================

<a href="http://nodered.org" target="_new">Node-RED</a> nodes to talk to aceBUS devices (proprietary of company ACEPRO).


Install
-------

Run the following command in your Node-RED user directory - typically `~/.node-red`

        npm install node-red-contrib-acepro

Usage
-----

Provides two nodes - one to receive messages, and one to send.

### Input

To set value to aceBUS connected device by IOID address.

value = `msg.payload`.

### Output

To get value out of aceBUS conneced device by IOID address.

value = `msg.payload`.

