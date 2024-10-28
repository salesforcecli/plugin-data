# summary

Resume a bulk export job that you previously started. Uses Bulk API 2.0.

# description

When the original "data export bulk" command either times out or is run with the --async flag, it displays a job ID. To see the status and get the results of the bulk export, run this command by either passing it the job ID or using the --use-most-recent flag to specify the most recent bulk export job.

# flags.job-id.summary

Job ID of the bulk export.

# flags.use-most-recent.summary

Use the job ID of the bulk export job that was most recently run.

# examples

- Resume a bulk export job run on your default org by specifying a job ID:

  sf <%= command.id %> --job-id 750xx000000005sAAA

- Resume the most recently-run bulk export job for an org with alias my-scratch:

  sf data export resume --use-most-recent --target-org my-scratch
