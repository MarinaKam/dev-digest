import { ConventionsView } from "./_components/ConventionsView";

/* Route: /conventions (Conventions Extractor, spec 004). Thin
   route entry — the view, its cards and the create-skill modal are colocated
   under _components. */
export default function ConventionsPage() {
  return <ConventionsView />;
}
