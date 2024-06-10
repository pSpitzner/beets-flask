import { JSONPretty } from '@/components/json'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/library/browse/')({
  component: () => <AllArtists/>
})

function AllArtists(){

  //TODO: load data
  // const data =

  return <JSONPretty foo={"foo"}/>
}
