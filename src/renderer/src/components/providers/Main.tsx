import React from 'react'

import Alert from '@renderer/components/providers/Alert'

export default function Providers({ children }: { children: React.ReactNode }): JSX.Element {
  return <Alert>{children}</Alert>
}
