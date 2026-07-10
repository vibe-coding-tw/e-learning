# Revisions

## [v1.1.0] - 2026-07-11

### Changed
- **GATT Cache Bypass Alignment**: Updated characteristic UUIDs in `wifi-config.html` and `motor-config.html` to align with the new byte-replacement scheme for `protocomm_ble` characteristics (endpoint ID is loaded into bytes[12:13] in little-endian order, shifting the 16-bit UUID to the first group, e.g. `6e40ff51-b5a3-...`).
- **Status Endpoint Read Protocol**: Adjusted `wifi-config.html` to perform a write-then-read pattern when calling the `"status"` endpoint, solving the issue where direct reads returned empty values due to protocomm session cache behavior.
- **Motor Config Page Protocol Refactor**: Rewrote the BLE connection configuration in `motor-config.html` to use the unified protocomm BLE service and switched the transmission protocol from a binary 28-byte array to JSON matching the firmware's `motor_config_t` schema.
