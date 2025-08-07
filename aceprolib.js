/**
 * Copyright ACEPRO-NET by Darius Aleškaitis @ MB ALDARNA
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * AcePro library - Common utilities for AcePro Node-RED nodes
 * 
 * This library provides common functionality that can be shared
 * across different AcePro node implementations.
 */

module.exports = {
    // Library version
    version: "1.3.7",
    
    // Common constants for AcePro protocol
    constants: {
        // Command constants
        CMD_GetVal: 0xACE00040,
        CMD_SetVal: 0xACE00080,
        CMD_OnChange: 0xACE000C0,
        
        // Timeout constants (in seconds)
        INIT_RETRY_DELAY: 10,
        INIT_RETRY_TILL_TO: 18,
        TX_RETRY_DELAY: 2,
        TX_RETRY_TILL_TO: 30,
        RX_WARN_DELAY: 60,
        RX_RETRY_TILL_TO: 3,
        
        // Timer periods
        MAIN_TIMER_PERIOD: 100, // ms
        
        // Value renewal time
        VAL_REN_TIME: 60 // s
    },
    
    // Utility functions
    utils: {
        /**
         * Check if object is empty
         * @param {Object} obj - Object to check
         * @returns {boolean} - True if object is empty
         */
        isEmptyObject: function(obj) {
            return !Object.keys(obj).length;
        },
        
        /**
         * Validate UDP packet structure
         * @param {Buffer} message - UDP message buffer
         * @returns {boolean} - True if packet is valid
         */
        isValidPacket: function(message) {
            return message && message.length >= 28;
        }
    }
};