import { useExperience } from '../store/useExperience'
import { DevicePicker } from './DevicePicker'

/** Device switcher bound straight to the store, for hosts with nothing to add. */
export function DeviceToggle() {
  const device = useExperience((s) => s.device)
  const setDevice = useExperience((s) => s.setDevice)
  return <DevicePicker value={device} onChange={setDevice} />
}
