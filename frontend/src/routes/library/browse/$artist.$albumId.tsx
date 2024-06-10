import { JSONPretty } from '@/components/json'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/library/browse/$artist/$albumId')({
  component: () => <div>Hello /library/$artist/$albumId!</div>
})

/** Shows all tracks
 * of an album
 */
function AlbumOverview(){

  return <JSONPretty foo={"foo"}/>
}
