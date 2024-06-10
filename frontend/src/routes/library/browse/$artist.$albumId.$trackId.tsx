import { JSONPretty } from '@/components/json'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/library/browse/$artist/$albumId/$trackId')({
  component: () => <div>Hello /library/$artist/$albumId/$trackId!</div>
})

function TracksView(){

   return <JSONPretty foo={"foo"}/>
}
