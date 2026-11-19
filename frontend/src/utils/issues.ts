import type { AnalysisResult } from '../api/analyze'

export function getOpenIssues(result: AnalysisResult) {
  return (result.issues ?? []).filter(issue => !issue.pull_request && issue.state === 'open')
}

export function getIssueLoadError(result: AnalysisResult) {
  const failure = result.steps?.find(step => step.step === 'issues' && step.status === 'error')
  if (failure) return typeof failure.data?.error === 'string' ? failure.data.error : 'GitHub issues could not be fetched. Run a new analysis to try again.'
  return result.issues ? null : 'This analysis did not include issue data. Run a new analysis to load open issues.'
}
