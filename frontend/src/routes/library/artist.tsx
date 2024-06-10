import { createFileRoute } from '@tanstack/react-router';
import z from "zod";

export const Route = createFileRoute('/library/artist')({
  parseParams: (params) => ({
    artist: z.string().parse(params.artist),
}),
loader: (opts) =>
  opts.context.queryClient.ensureQueryData(
      trackQueryOptions(opts.params.trackId)
  ),
  component: () => <div>Hello /library/$artist!</div>
})


/** Shows all 
 * albums of an artist
 */
function ArtistOverview(){

}