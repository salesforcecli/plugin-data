# summary

Resume a bulk export job that you previously started

# description

This command uses the job ID returned by the `sf data export bulk` command or the most recently-run bulk export job.

# flags.job-id.summary

Job ID of the bulk export.

# flags.use-most-recent.summary

Use the most recent bulk export ID from cache.

# examples

- Resume a bulk export job from your default org using an ID:

  sf <%= command.id %> --job-id 750xx000000005sAAA

- Resume the most recently run bulk export job for an org with alias my-scratch:

  sf data export resume --use-most-recent --target-org my-scratch
