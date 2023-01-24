# summary

Resume the resolution of a bulk delete that had been previously started.

# description

Resume the resolution of a bulk delete that had been previously started.
The command uses the job ID and batch ID returned from the "data bulk delete" command or the most recent bulk delete job from the cache.

# examples

- View the status of a bulk load job:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA

- View the status of a bulk load job and a specific batches:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA --batch-id 751xx000000005nAAA

- View the status of a bulk load job using the most recent job ID from cache:

  <%= config.bin %> <%= command.id %> --use-most-recent

