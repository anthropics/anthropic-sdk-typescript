fix(tools): stop the session tool runner on terminal history events

Avoid executing unanswered tool calls after a session has already terminated or been deleted, even when the terminal event appears only during history reconciliation.
