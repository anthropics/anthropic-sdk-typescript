fix(tools): stop the session tool runner from running the tool calls of a terminated session thread

The runner also stops waiting for a confirmation of these calls and no longer yields them, including a denied call (`confirmation: 'deny'`) and a call to a tool that it does not own. A call that the runner starts before it reads the session thread's `session.thread_status_terminated` event still runs to the end, and the runner yields it with `posted: false` when the API refuses the result.
