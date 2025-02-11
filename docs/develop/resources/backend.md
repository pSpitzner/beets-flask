
Important entrypoints:
- invoker
- importer/session



## State Hierarchy

- SessionState: Reflects the state of the import session.
  We aim for sessions to be stateless, and everything is stored in the database via the ImportState.
- TaskState: Reflects a beetstask, but they dont have such a precise real-life meaning.
  For us, the TaskState mainly holds a list of CandidateStates and the users current choice.
- CandidateState: Reflects a beets match (i.e. a candidate the user might choose)

