import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/library/')({
  component: () => <div>Hello /library/!</div>
})