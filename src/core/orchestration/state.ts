type NodeState = 'waiting' | 'started' | 'ready' | 'failed' | 'skipped'

type GraphNode = {
  name: string
  dependsOn: string[]
  state: NodeState
}

export type OrchestrationState = {
  nodes: Map<string, GraphNode>
  stopping: boolean
}
