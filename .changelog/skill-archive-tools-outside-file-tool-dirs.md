fix(tools): pass over a tar or unzip inside the directories the agent toolset's file tools can write

`setupSkills` takes `tar`, `unzip` and a helper that `tar` starts, such as `gzip`, only from the `PATH` entries outside `workdir` and `allowedRoots`, and passes over a link that leads inside them. A host whose only `tar` or `unzip` is inside those directories can no longer download skills until one is installed outside. Only when no `PATH` entry is outside them, as with a `workdir` of `/`, is all of `PATH` still searched. A `tar` or `unzip` that fails now rejects with an `AnthropicError`.
