import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/library/track')({
  component: () => <div>
    <h1>

   Artist info
    </h1>
    <Link to="/library/track">Test</Link>
    <div>
      Album
    </div>
    <div>
      Album
    </div>
    <Outlet/>

  </div>
})
