# Python-to-TypeScript porting matrix

Source of truth: `Xerolux/violet-poolController-api` 0.0.35 at
`1a1617f235af74a31a3c358ab2f31fcfd749e0a1`.

The TypeScript surface uses camelCase and explicit units. Controller endpoint names and wire
formats remain unchanged.

| Python                        | TypeScript                                | Status                                       |
| ----------------------------- | ----------------------------------------- | -------------------------------------------- |
| `VioletPoolAPI`               | `VioletPoolClient`                        | Implemented and integration-tested           |
| `get_readings`                | `getReadings`                             | Implemented and tested                       |
| `get_hardware_profile`        | `getHardwareProfile`                      | Implemented and tested                       |
| `get_specific_readings`       | `getSpecificReadings`                     | Implemented                                  |
| `get_history`                 | `getHistory`                              | Implemented                                  |
| `get_weather_data`            | `getWeatherData`                          | Implemented                                  |
| `get_overall_dosing`          | `getOverallDosing`                        | Implemented                                  |
| `get_output_states`           | `getOutputStates`                         | Implemented                                  |
| `get_config`                  | `getConfig`                               | Implemented and tested through dosage config |
| `set_config`                  | `setConfig`                               | Implemented and tested                       |
| `get_calibration_raw_values`  | `getCalibrationRawValues`                 | Implemented                                  |
| `get_calibration_history`     | `getCalibrationHistory`                   | Implemented                                  |
| `restore_calibration`         | `restoreCalibration`                      | Implemented                                  |
| `set_output_test_mode`        | `setOutputTestMode`                       | Implemented                                  |
| `set_switch_state`            | `setSwitchState`                          | Implemented and tested                       |
| `manual_dosing`               | `manualDosing`                            | Implemented and tested                       |
| `set_pv_surplus`              | `setPvSurplus`                            | Implemented                                  |
| `set_all_dmx_scenes`          | `setAllDmxScenes`                         | Implemented                                  |
| `set_cover_command`           | `setCoverCommand`                         | Implemented and safety-tested                |
| `set_light_color_pulse`       | `setLightColorPulse`                      | Implemented                                  |
| `trigger_digital_input_rule`  | `triggerDigitalInputRule`                 | Implemented                                  |
| `set_digital_input_rule_lock` | `setDigitalInputRuleLock`                 | Implemented                                  |
| `set_device_temperature`      | `setDeviceTemperature`                    | Implemented                                  |
| `set_ph_target`               | `setPhTarget`                             | Implemented and tested                       |
| `set_orp_target`              | `setOrpTarget`                            | Implemented                                  |
| `set_min_chlorine_level`      | `setMinimumChlorineLevel`                 | Implemented                                  |
| `set_target_value`            | `setTargetValue`                          | Implemented                                  |
| `set_dosing_parameters`       | `setDosingParameters`                     | Implemented                                  |
| `set_dosage_enabled`          | `setDosageEnabled`                        | Implemented                                  |
| `is_dosage_enabled`           | `isDosageEnabled`                         | Implemented                                  |
| `set_pump_speed`              | `setPumpSpeed`                            | Implemented and tested                       |
| `control_pump`                | `controlPump`                             | Implemented                                  |
| `parse_error_notification`    | `VioletPoolClient.parseErrorNotification` | Implemented                                  |
| `parse_multiple_errors`       | `VioletPoolClient.parseMultipleErrors`    | Implemented                                  |
| `get_log`                     | `getLog`                                  | Implemented                                  |
| `get_notifications`           | `getNotifications`                        | Implemented                                  |
| `reset_blocking`              | `resetBlocking`                           | Implemented                                  |
| `set_can_amount`              | `setCanAmount`                            | Implemented                                  |
| `set_system_service`          | `setSystemService`                        | Implemented                                  |
| `get_system_services`         | `getSystemServices`                       | Implemented and tested                       |
| `set_omni_position`           | `setOmniPosition`                         | Implemented                                  |
| `get_rs485_pump_data`         | `getRs485PumpData`                        | Implemented and tested                       |
| `set_rs485_live`              | `setRs485Live`                            | Implemented                                  |
| `end_rs485_live`              | `endRs485Live`                            | Implemented and tested                       |
| `get_live_trace`              | `getLiveTrace`                            | Implemented and tested                       |
| `init_update`                 | `initUpdate`                              | Implemented and tested                       |
| `get_update_state`            | `getUpdateState`                          | Implemented and tested                       |
| `get_update_history`          | `getUpdateHistory`                        | Implemented                                  |
| `get_output_runtimes`         | `getOutputRuntimes`                       | Implemented                                  |

## Supporting API

| Python                        | TypeScript                                          | Status                 |
| ----------------------------- | --------------------------------------------------- | ---------------------- |
| `VioletReadings`              | `VioletReadings`                                    | Implemented and tested |
| `VioletState`                 | `VioletState`                                       | Implemented            |
| state translation helpers     | camelCase state translation helpers                 | Implemented            |
| `CircuitBreaker`              | `CircuitBreaker`                                    | Implemented and tested |
| `RateLimiter`                 | `RateLimiter`                                       | Implemented and tested |
| `InputSanitizer`              | `InputSanitizer`                                    | Implemented            |
| parser functions              | explicit `*Milliseconds` and epoch parser functions | Implemented and tested |
| exception hierarchy           | `Violet*Error` hierarchy                            | Implemented            |
| action/device/error constants | typed constants and enums                           | Implemented            |
| controller error catalog      | `ERROR_CODES`                                       | Ported in full         |

## Intentional TypeScript differences

- `aiohttp.ClientSession` is replaced by an internally owned Undici dispatcher. Call `close()` when
  the client is no longer needed.
- Durations exposed by `VioletReadings` and parser helpers carry `Milliseconds` in their names.
- Optional values use `undefined` instead of Python `None`.
- Public configuration uses one options object instead of a long constructor parameter list.
- Cover movement requires `{ acknowledgeUnsafe: true }`, matching the Python safety guard.
- ESM and CommonJS entry points share one typed public export surface.

## Continuous parity verification

- `npm run parity:check` compares a clean Python checkout with the reviewed manifest and compiled
  package.
- GitHub Actions runs that comparison against the current Python `main` branch on every push and
  daily. Any upstream contract or version change fails CI until this port is updated.
- Integration tests verify controller wire formats with a stateful mock server, while unit tests
  cover readings, states, parsers, sanitization, rate limiting, and circuit breaking.
- Coverage thresholds prevent the suite from silently dropping below 80% statements and lines,
  90% functions, or 60% branches.
- Real controller firmware should still be smoke-tested before safety-critical deployment.
