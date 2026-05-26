/**
 * Generic Web BLE Client for ESP32 with Quantifier Integration
 */
class BLEClient {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null; // Primary characteristic (optional)
        this.connected = false;

        // Event listeners (simple callback array for now)
        this.onDisconnectCallbacks = [];

        console.log("🔵 BLEClient Initialized");
    }

    /**
     * Connect to a specific BLE device and service
     * @param {string} serviceUUID 
     * @param {string|null} characteristicUUID - Optional primary characteristic
     * @param {string} namePrefix - Filter by name (default 'esp32')
     */
    async connect(serviceUUID, characteristicUUID = null, namePrefix = 'esp32') {
        // Log attempt
        window.quantifier?.logEvent('CONNECTION', { status: 'attempt', device: namePrefix });

        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: namePrefix }],
                optionalServices: [serviceUUID]
            });

            this.device.addEventListener('gattserverdisconnected', this._handleDisconnect.bind(this));

            this.server = await this.device.gatt.connect();
            this.service = await this.server.getPrimaryService(serviceUUID);

            if (characteristicUUID) {
                this.characteristic = await this.service.getCharacteristic(characteristicUUID);
            }

            this.connected = true;

            // Log success
            window.quantifier?.logEvent('CONNECTION', { status: 'connected', device: this.device.name });

            return this.device;

        } catch (error) {
            console.error("BLE Connection Error:", error);
            window.quantifier?.logEvent('CONNECTION', { status: 'error', error: error.message });
            throw error;
        }
    }

    /**
     * Disconnect from device
     */
    disconnect() {
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
    }

    _handleDisconnect(event) {
        this.connected = false;
        console.log("Device disconnected");

        // Log disconnect
        window.quantifier?.logEvent('CONNECTION', { status: 'disconnected' });

        // Trigger callbacks
        this.onDisconnectCallbacks.forEach(cb => cb());
    }

    /**
     * Write data to the primary characteristic
     * @param {BufferSource} data 
     */
    async write(data) {
        if (!this.characteristic) throw new Error("Primary characteristic not found");

        try {
            await this.characteristic.writeValue(data);

            // Log command sent (generic)
            window.quantifier?.logEvent('COMMAND', { size: data.byteLength });

        } catch (error) {
            console.error("BLE Write Error:", error);
            throw error;
        }
    }

    /**
     * Read data from the primary characteristic
     */
    async read() {
        if (!this.characteristic) throw new Error("Primary characteristic not found");
        return await this.characteristic.readValue();
    }

    /**
     * Get a specific characteristic (cached lookup not implemented yet, just fetches)
     * @param {string} uuid 
     */
    async getCharacteristic(uuid) {
        if (!this.service) throw new Error("Service not connected");
        return await this.service.getCharacteristic(uuid);
    }

    /**
     * Write data to a specific characteristic
     * @param {string} uuid 
     * @param {BufferSource} data 
     */
    async writeTo(uuid, data) {
        try {
            const char = await this.getCharacteristic(uuid);
            await char.writeValue(data);

            window.quantifier?.logEvent('COMMAND', { type: 'specific_write', uuid: uuid, size: data.byteLength });
        } catch (error) {
            console.error(`BLE WriteTo ${uuid} Error:`, error);
            throw error;
        }
    }
}

// Export global instance
window.bleClient = new BLEClient();
