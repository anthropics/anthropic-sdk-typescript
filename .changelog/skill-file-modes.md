fix(tools): normalize file modes of extracted skill files

Extracted files now get `0644`, or `0755` if any execute bit is set, in `0700` directories, whatever the archive recorded. The system `tar` must accept `--no-same-owner` and `--no-same-permissions`.
