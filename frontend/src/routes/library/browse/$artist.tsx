import { JSONPretty } from '@/components/json';
import { artistQueryOptions } from '@/lib/library';
import { createFileRoute } from '@tanstack/react-router';
import z from "zod";


export const Route = createFileRoute('/library/browse/$artist')({
  parseParams: (params) => ({
    artist: z.string().parse(params.artist),
}),
  loader:(opts) => opts.context.queryClient.ensureQueryData(
    artistQueryOptions(opts.params.artist)
  ),
  component: ArtistOverview
})


/** Shows all
 * albums of an artist
 */
function ArtistOverview(){
  const artist = Route.useLoaderData()
  return <JSONPretty artist={artist}/>
}
