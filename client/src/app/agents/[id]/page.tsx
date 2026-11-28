import { AgentEditorView } from "./_components/AgentEditorView";

/* Route: /agents/:id (Agent Editor). Thin route entry — the view, the agent
   list beside it and the editor tabs are colocated under _components. */
export default function AgentEditorPage() {
  return <AgentEditorView />;
}
