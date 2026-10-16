// Native node:test events; only the completed, whole-run summary is evidence.
// An interrupted runner produces no valid report. This does not alter test exits.
export default async function* report(events) {
  for await (const event of events) {
    if (event.type === 'test:summary' && event.data.file === undefined) {
      yield JSON.stringify(event) + '\n';
    }
  }
}
