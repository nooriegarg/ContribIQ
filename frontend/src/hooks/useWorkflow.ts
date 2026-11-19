import { useOutletContext } from 'react-router-dom'
import type { WorkflowContext } from '../components/WorkflowLayout'

export function useWorkflow() {
  return useOutletContext<WorkflowContext>()
}
