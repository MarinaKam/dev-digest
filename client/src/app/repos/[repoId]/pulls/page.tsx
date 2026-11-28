import { PullsView } from "./_components/PullsView";

/* Route: /repos/:repoId/pulls (PR list). Thin route entry — the view, its
   filter bar and rows are colocated under _components. */
export default function PullsPage() {
  return <PullsView />;
}
