# summary

Resume a bulk delete job that you previously started. Uses Bulk API 2.0.

# description

The command uses the job ID returned by the "<%= config.bin %> data delete bulk" command or the most recently-run bulk delete job.

# examples

- Resume a bulk delete job from your default org using an ID:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA

- Resume the most recently run bulk delete job for an org with alias my-scratch:

  <%= config.bin %> <%= command.id %> --use-most-recent --target-org my-scratch
