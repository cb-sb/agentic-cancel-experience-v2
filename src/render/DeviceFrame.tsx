import type { ReactNode } from 'react'
import type { DeviceKind } from '../store/useExperience'

export const DEVICE_WIDTHS: Record<DeviceKind, number> = {
  desktop: 680,
  tablet: 560,
  mobile: 380,
}

export function DeviceFrame({
  device,
  children,
}: {
  device: DeviceKind
  children: ReactNode
}) {
  return (
    <div className="flex w-full justify-center">
      <div
        className="w-full transition-[max-width] duration-300 ease-out"
        style={{ maxWidth: DEVICE_WIDTHS[device] }}
      >
        {children}
      </div>
    </div>
  )
}
