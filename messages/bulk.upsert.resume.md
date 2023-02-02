# summary

Resume a bulk upsert job that you previously started. Uses Bulk API 2.0.

# description

The command uses the job ID returned from the "<%= config.bin %> data upsert bulk" command or the most recently-run bulk upsert job.

# examples

- Resume a bulk upsert job from your default org using an ID:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA

- Resume the most recently run bulk upsert job for an org with alias my-scratch:

  <%= config.bin %> <%= command.id %> --use-most-recent --target-org my-scratch
