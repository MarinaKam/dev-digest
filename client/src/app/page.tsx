import { HomeView } from "./_components/HomeView";

/* Route: / (start). Thin route entry — sends the user to the first repo's PR
   list, or offers to add a repository when there is none. */
export default function HomePage() {
  return <HomeView />;
}
